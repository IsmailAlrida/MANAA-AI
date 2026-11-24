/**
 * Demo Store on Node's built-in node:sqlite. Single process, single writer:
 * transactions use BEGIN IMMEDIATE so the write lock is taken up front, which
 * mirrors the row locks the PostgreSQL implementation takes per artifact.
 */
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { DatabaseSync } from "node:sqlite"
import type {
  ArtifactData,
  ArtifactKind,
  ArtifactRecord,
  RunError,
  RunRecord,
  RunState,
} from "../domain/types.ts"
import type {
  ArtifactMutation,
  CreateRunInput,
  MutateResult,
  RevealResult,
  Store,
  WorkspaceRows,
} from "./store.ts"

const SCHEMA = `
CREATE TABLE IF NOT EXISTS artifacts (
  kind       TEXT    NOT NULL CHECK (kind IN ('entity', 'relationship', 'ticket')),
  id         TEXT    NOT NULL,
  revision   INTEGER NOT NULL CHECK (revision > 0),
  data       TEXT    NOT NULL,
  updated_at TEXT    NOT NULL,
  PRIMARY KEY (kind, id)
);
CREATE TABLE IF NOT EXISTS runs (
  run_id          TEXT    PRIMARY KEY,
  idempotency_key TEXT    UNIQUE,
  status          TEXT    NOT NULL CHECK (status IN ('running', 'paused', 'complete', 'failed', 'cancelled')),
  completed       INTEGER NOT NULL,
  total           INTEGER NOT NULL,
  error           TEXT,
  request_text    TEXT,
  created_at      TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS runs_one_running ON runs (status) WHERE status = 'running';
CREATE TABLE IF NOT EXISTS idempotency_keys (
  scope      TEXT NOT NULL,
  key        TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (scope, key)
);
`

type Row = Record<string, unknown>

function toRun(row: Row | undefined): RunRecord | null {
  if (!row) return null
  return {
    runId: String(row.run_id),
    status: String(row.status) as RunState,
    completed: Number(row.completed),
    total: Number(row.total),
    error: row.error ? (JSON.parse(String(row.error)) as RunError) : null,
    requestText: row.request_text == null ? null : String(row.request_text),
    idempotencyKey:
      row.idempotency_key == null ? null : String(row.idempotency_key),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function toArtifact(row: Row | undefined): ArtifactRecord | null {
  if (!row) return null
  return {
    kind: String(row.kind) as ArtifactKind,
    id: String(row.id),
    revision: Number(row.revision),
    data: JSON.parse(String(row.data)) as ArtifactData,
  }
}

export function openSqliteStore(path: string): Store {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec(
    "PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;"
  )
  db.exec(SCHEMA)

  // Older local demo databases predate the paused state. Rebuild only the
  // small run table so existing workspace artifacts and progress survive.
  const runSql = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'runs'")
    .get() as Row | undefined
  if (!String(runSql?.sql ?? "").includes("'paused'")) {
    db.exec(`
      DROP INDEX IF EXISTS runs_one_running;
      ALTER TABLE runs RENAME TO runs_before_pause;
      CREATE TABLE runs (
        run_id TEXT PRIMARY KEY,
        idempotency_key TEXT UNIQUE,
        status TEXT NOT NULL CHECK (status IN ('running', 'paused', 'complete', 'failed', 'cancelled')),
        completed INTEGER NOT NULL,
        total INTEGER NOT NULL,
        error TEXT,
        request_text TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO runs SELECT * FROM runs_before_pause;
      DROP TABLE runs_before_pause;
      CREATE UNIQUE INDEX runs_one_running ON runs (status) WHERE status = 'running';
    `)
  }

  const q = {
    allArtifacts: db.prepare("SELECT kind, data FROM artifacts ORDER BY rowid"),
    getArtifact: db.prepare(
      "SELECT kind, id, revision, data FROM artifacts WHERE kind = ? AND id = ?"
    ),
    insertArtifact: db.prepare(
      "INSERT INTO artifacts (kind, id, revision, data, updated_at) VALUES (?, ?, 1, ?, ?)"
    ),
    updateArtifact: db.prepare(
      "UPDATE artifacts SET revision = ?, data = ?, updated_at = ? WHERE kind = ? AND id = ? AND revision = ?"
    ),
    getRun: db.prepare("SELECT * FROM runs WHERE run_id = ?"),
    runByKey: db.prepare("SELECT * FROM runs WHERE idempotency_key = ?"),
    reusableRun: db.prepare(
      "SELECT * FROM runs WHERE status IN ('running', 'paused', 'complete') ORDER BY created_at DESC, rowid DESC LIMIT 1"
    ),
    latestRun: db.prepare(
      "SELECT * FROM runs ORDER BY created_at DESC, rowid DESC LIMIT 1"
    ),
    runningRuns: db.prepare(
      "SELECT * FROM runs WHERE status = 'running' ORDER BY created_at"
    ),
    pauseRun: db.prepare(
      "UPDATE runs SET status = 'paused', updated_at = ? WHERE run_id = ? AND status = 'running'"
    ),
    resumeRun: db.prepare(
      "UPDATE runs SET status = 'running', updated_at = ? WHERE run_id = ? AND status = 'paused'"
    ),
    insertRun: db.prepare(
      `INSERT INTO runs (run_id, idempotency_key, status, completed, total, error, request_text, created_at, updated_at)
       VALUES (?, ?, 'running', 0, ?, NULL, ?, ?, ?)`
    ),
    advanceRun: db.prepare(
      "UPDATE runs SET completed = ?, status = ?, updated_at = ? WHERE run_id = ? AND completed = ? AND status = 'running'"
    ),
    failRun: db.prepare(
      "UPDATE runs SET status = 'failed', error = ?, updated_at = ? WHERE run_id = ? AND status = 'running'"
    ),
    getKey: db.prepare(
      "SELECT 1 FROM idempotency_keys WHERE scope = ? AND key = ?"
    ),
    putKey: db.prepare(
      "INSERT INTO idempotency_keys (scope, key, created_at) VALUES (?, ?, ?)"
    ),
  }

  function tx<T>(fn: () => T): T {
    db.exec("BEGIN IMMEDIATE")
    try {
      const result = fn()
      db.exec("COMMIT")
      return result
    } catch (err) {
      db.exec("ROLLBACK")
      throw err
    }
  }

  /** Write `next` over `current` and bump the revision. Caller holds the transaction. */
  function write(
    kind: ArtifactKind,
    id: string,
    current: ArtifactRecord | null,
    next: ArtifactData,
    now: string
  ) {
    const revision = current ? current.revision + 1 : 1
    const data: ArtifactData = { ...next, id, revision }
    if (current) {
      const res = q.updateArtifact.run(
        revision,
        JSON.stringify(data),
        now,
        kind,
        id,
        current.revision
      )
      if (Number(res.changes) !== 1)
        throw new Error(`Concurrent write to ${kind} ${id}`)
    } else {
      q.insertArtifact.run(kind, id, JSON.stringify(data), now)
    }
    return { kind, id, revision, data } satisfies ArtifactRecord
  }

  function get(kind: ArtifactKind, id: string) {
    return toArtifact(q.getArtifact.get(kind, id) as Row | undefined)
  }

  const store: Store = {
    async readWorkspace() {
      const rows: WorkspaceRows = {
        entities: [],
        relationships: [],
        tickets: [],
      }
      for (const row of q.allArtifacts.all() as Row[]) {
        const data = JSON.parse(String(row.data)) as ArtifactData
        if (row.kind === "entity") rows.entities.push(data)
        else if (row.kind === "relationship") rows.relationships.push(data)
        else rows.tickets.push(data)
      }
      return rows
    },

    async getArtifact(kind, id) {
      return get(kind, id)
    },

    async mutateArtifact({
      kind,
      id,
      expectedRevision,
      idempotency,
      mutate,
    }): Promise<MutateResult> {
      const now = new Date().toISOString()
      return tx(() => {
        const current = get(kind, id)
        if (!current) return { status: "not_found" } as const
        if (idempotency && q.getKey.get(idempotency.scope, idempotency.key)) {
          return {
            status: "ok",
            record: current,
            changed: false,
            replayed: true,
          } as const
        }
        if (
          expectedRevision !== undefined &&
          expectedRevision !== current.revision
        ) {
          return {
            status: "conflict",
            currentRevision: current.revision,
          } as const
        }
        const next = mutate(current.data)
        const record = next ? write(kind, id, current, next, now) : current
        if (idempotency) q.putKey.run(idempotency.scope, idempotency.key, now)
        return {
          status: "ok",
          record,
          changed: next !== null,
          replayed: false,
        } as const
      })
    },

    async createRun({ runId, idempotencyKey, requestText, total, now }) {
      return tx(() => {
        if (idempotencyKey) {
          const existing = toRun(
            q.runByKey.get(idempotencyKey) as Row | undefined
          )
          if (existing) return { run: existing, created: false }
        }
        const reusable = toRun(q.reusableRun.get() as Row | undefined)
        if (reusable) return { run: reusable, created: false }
        q.insertRun.run(runId, idempotencyKey, total, requestText, now, now)
        return { run: toRun(q.getRun.get(runId) as Row)!, created: true }
      })
    },

    async getRun(runId) {
      return toRun(q.getRun.get(runId) as Row | undefined)
    },

    async latestRun() {
      return toRun(q.latestRun.get() as Row | undefined)
    },

    async runningRuns() {
      return (q.runningRuns.all() as Row[]).map((r) => toRun(r)!)
    },

    async pauseRun(runId, now) {
      return tx(() => {
        q.pauseRun.run(now, runId)
        return toRun(q.getRun.get(runId) as Row | undefined)
      })
    },

    async resumeRun(runId, now) {
      return tx(() => {
        q.resumeRun.run(now, runId)
        return toRun(q.getRun.get(runId) as Row | undefined)
      })
    },

    async applyRevealStep({
      runId,
      expectedCompleted,
      mutations,
      now,
    }): Promise<RevealResult> {
      return tx(() => {
        const run = toRun(q.getRun.get(runId) as Row | undefined)
        if (
          !run ||
          run.status !== "running" ||
          run.completed !== expectedCompleted
        ) {
          return { applied: false, changed: [], run }
        }
        const changed: ArtifactRecord[] = []
        for (const m of mutations) {
          const current = get(m.kind, m.id)
          const next = m.mutate(current ? current.data : null)
          if (next) changed.push(write(m.kind, m.id, current, next, now))
        }
        const completed = expectedCompleted + 1
        const status: RunState = completed >= run.total ? "complete" : "running"
        q.advanceRun.run(completed, status, now, runId, expectedCompleted)
        return {
          applied: true,
          changed,
          run: toRun(q.getRun.get(runId) as Row)!,
        }
      })
    },

    async failRun(runId, error, now) {
      return tx(() => {
        q.failRun.run(JSON.stringify(error), now, runId)
        return toRun(q.getRun.get(runId) as Row | undefined)
      })
    },

    async reset() {
      tx(() =>
        db.exec(
          "DELETE FROM artifacts; DELETE FROM runs; DELETE FROM idempotency_keys;"
        )
      )
    },

    async close() {
      if (db.isOpen) db.close()
    },
  }
  return store
}
