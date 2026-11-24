import { TERMINAL_RUN_STATES, type RunStatus } from "@/lib/api/types"

/** Merge records by stable id; never let an older revision overwrite a newer one. */
export type ById<T> = Readonly<Record<string, T>>

export function upsert<T extends { id: string; revision: number }>(map: ById<T>, rec: T): ById<T> {
  const cur = map[rec.id]
  if (cur && cur.revision >= rec.revision) return map
  return { ...map, [rec.id]: rec }
}

export function upsertMany<T extends { id: string; revision: number }>(map: ById<T>, recs: readonly T[]): ById<T> {
  let next = map
  for (const r of recs) next = upsert(next, r)
  return next
}

/**
 * Run status has no revision, so order it by progress: a snapshot read before a
 * later SSE `run.status` must not roll the run back, and a finished run must not
 * reopen (that would restart the stream). A different runId always replaces.
 */
export function mergeRun(cur: RunStatus | null, next: RunStatus | null): RunStatus | null {
  if (!cur || !next || cur.runId !== next.runId) return next
  if (TERMINAL_RUN_STATES.has(cur.status) && !TERMINAL_RUN_STATES.has(next.status)) return cur
  if ((next.progress?.completed ?? 0) < (cur.progress?.completed ?? 0)) return cur
  return next
}
