/**
 * Persistence boundary for the demo backend.
 *
 * The interface is written for the production shape — PostgreSQL shared by
 * many API/worker processes appending evidence concurrently — even though the
 * demo ships a single-process SQLite implementation. Rules every
 * implementation must keep:
 *
 * - Every method is async and each mutating call is one atomic transaction.
 * - Revisions are assigned by the store, per artifact, inside the transaction
 *   (`revision = revision + 1` under a row lock). Callers never pick them.
 * - Mutators run inside the transaction against the locked current row, so
 *   read-modify-write merges (scan content vs. operator fields) cannot lose
 *   concurrent updates. Mutators must be synchronous and side-effect free;
 *   they may be re-run if the database retries the transaction.
 * - A mutator returning `null` means "no change": no write, no revision bump.
 * - Reveal steps are compare-and-set on the run's committed step count, so two
 *   workers racing on the same run apply each step exactly once.
 * - Idempotency keys are recorded in the same transaction as the write they
 *   guard.
 *
 * See postgres-schema.sql for the equivalent PostgreSQL tables and locking.
 */
import type {
  ArtifactData,
  ArtifactKind,
  ArtifactRecord,
  RunError,
  RunRecord,
} from "../domain/types.ts"

export type Mutator = (current: ArtifactData | null) => ArtifactData | null

export interface ArtifactMutation {
  kind: ArtifactKind
  id: string
  mutate: Mutator
}

export interface WorkspaceRows {
  entities: ArtifactData[]
  relationships: ArtifactData[]
  tickets: ArtifactData[]
}

export type MutateResult =
  | {
      status: "ok"
      record: ArtifactRecord
      changed: boolean
      replayed: boolean
    }
  | { status: "not_found" }
  | { status: "conflict"; currentRevision: number }

export interface RevealResult {
  /** False when the run is gone, finished, or another worker already applied this step. */
  applied: boolean
  /** Artifacts written in this step, in mutation order. */
  changed: ArtifactRecord[]
  run: RunRecord | null
}

export interface CreateRunInput {
  runId: string
  idempotencyKey: string | null
  requestText: string | null
  total: number
  now: string
}

export interface Store {
  /** Consistent point-in-time read of all artifacts, in first-insert order. */
  readWorkspace(): Promise<WorkspaceRows>
  getArtifact(kind: ArtifactKind, id: string): Promise<ArtifactRecord | null>

  /**
   * Operator mutation of one existing artifact.
   * `expectedRevision` gives optimistic concurrency (HTTP If-Match).
   * `idempotency` makes a retried request return the current record unchanged.
   */
  mutateArtifact(input: {
    kind: ArtifactKind
    id: string
    expectedRevision?: number
    idempotency?: { scope: string; key: string }
    mutate: (current: ArtifactData) => ArtifactData | null
  }): Promise<MutateResult>

  /**
   * Start a run, or return the run this request maps to. Demo policy: the same
   * idempotency key returns its run; otherwise an existing running, paused, or complete
   * run is returned (one scenario per workspace until reset).
   */
  createRun(
    input: CreateRunInput
  ): Promise<{ run: RunRecord; created: boolean }>
  getRun(runId: string): Promise<RunRecord | null>
  latestRun(): Promise<RunRecord | null>
  runningRuns(): Promise<RunRecord[]>

  /** Change run scheduling state without changing its committed reveal cursor. */
  pauseRun(runId: string, now: string): Promise<RunRecord | null>
  resumeRun(runId: string, now: string): Promise<RunRecord | null>

  /** Atomically apply one reveal step if the run is still at `expectedCompleted`. */
  applyRevealStep(input: {
    runId: string
    expectedCompleted: number
    mutations: ArtifactMutation[]
    now: string
  }): Promise<RevealResult>
  failRun(
    runId: string,
    error: RunError,
    now: string
  ): Promise<RunRecord | null>

  /** Demo-only: erase all workspace and run state. */
  reset(): Promise<void>
  close(): Promise<void>
}
