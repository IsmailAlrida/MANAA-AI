/**
 * Backend-side view of the v1 contract (docs/FRONTEND-BACKEND-CONTRACT.md).
 * Artifact payloads stay loosely typed: the demo backend passes fixture
 * fields through unchanged so additive contract fields need no code change.
 */

export type ArtifactKind = "entity" | "relationship" | "ticket"

/** A complete artifact payload. `id` is stable; `revision` is store-assigned. */
export type ArtifactData = Record<string, unknown> & { id: string }

export interface ArtifactRecord {
  kind: ArtifactKind
  id: string
  revision: number
  /** Full payload as served to clients, including `id` and `revision`. */
  data: ArtifactData
}

export type RunState = "running" | "paused" | "complete" | "failed" | "cancelled"

export interface RunError {
  code: string
  message: string
}

export interface RunRecord {
  runId: string
  status: RunState
  /** Number of reveal steps committed so far. */
  completed: number
  total: number
  error: RunError | null
  requestText: string | null
  idempotencyKey: string | null
  createdAt: string
  updatedAt: string
}

export const SSE_EVENT = {
  entity: "graph.entity.upsert",
  relationship: "graph.relationship.upsert",
  ticket: "ticket.upsert",
  run: "run.status",
} as const

export const EVENT_FOR_KIND: Record<ArtifactKind, string> = {
  entity: SSE_EVENT.entity,
  relationship: SSE_EVENT.relationship,
  ticket: SSE_EVENT.ticket,
}

/** `run.status` payload and `POST /runs` response body. Transport metadata only. */
export function runStatusDto(run: RunRecord) {
  return {
    runId: run.runId,
    status: run.status,
    progress: { completed: run.completed, total: run.total },
    error: run.error,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  }
}

/** Upsert event payload: per-artifact revision plus the complete current record. */
export function upsertDto(record: ArtifactRecord) {
  return { revision: record.revision, data: record.data }
}

/** An expected, client-visible failure mapped onto the contract error envelope. */
export class DomainError extends Error {
  readonly status: number
  readonly code: string
  readonly fieldErrors: Record<string, string> | undefined
  readonly currentRevision: number | undefined

  constructor(
    status: number,
    code: string,
    message: string,
    extra: {
      fieldErrors?: Record<string, string>
      currentRevision?: number
    } = {}
  ) {
    super(message)
    this.name = "DomainError"
    this.status = status
    this.code = code
    this.fieldErrors = extra.fieldErrors
    this.currentRevision = extra.currentRevision
  }
}

/** Key-order-independent JSON used to detect no-op upserts. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`
  }
  return JSON.stringify(value)
}

export function withoutKeys(
  obj: Record<string, unknown>,
  keys: readonly string[]
) {
  const out: Record<string, unknown> = { ...obj }
  for (const k of keys) delete out[k]
  return out
}

export function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : []
}
