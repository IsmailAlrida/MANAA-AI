/**
 * Run-scan button. Two inputs:
 *   - the local request machine (POST /runs lifecycle)
 *   - the backend-owned run status (from snapshot/SSE)
 * The visible button state is *derived* from both so a reload mid-run shows
 * "Scanning" without the client remembering it started anything.
 *
 *   request:  idle ──START──▶ starting ──ACCEPTED──▶ idle
 *                               ├──UNCHANGED─▶ unchanged ──START──▶ starting
 *                               └──REJECTED──▶ failed ──START──▶ starting
 *
 * UNCHANGED = the service answered with the run we already knew to be finished,
 * i.e. it started nothing. Backend-agnostic: no demo-specific branching.
 */
import type { ApiErrorKind } from "@/lib/api/client"
import { TERMINAL_RUN_STATES, type RunStatus } from "@/lib/api/types"

export type RunRequestState =
  | { tag: "idle" }
  | { tag: "starting"; key: string }
  | { tag: "unchanged" }
  | { tag: "failed"; key: string; kind: ApiErrorKind; message: string }

export type RunRequestEvent =
  | { type: "START"; key: string }
  | { type: "ACCEPTED" }
  | { type: "UNCHANGED" }
  | { type: "REJECTED"; kind: ApiErrorKind; message: string }

export function runRequestReducer(s: RunRequestState, e: RunRequestEvent): RunRequestState {
  switch (s.tag) {
    case "idle":
      return e.type === "START" ? { tag: "starting", key: e.key } : s
    case "starting":
      if (e.type === "ACCEPTED") return { tag: "idle" }
      if (e.type === "UNCHANGED") return { tag: "unchanged" }
      if (e.type === "REJECTED") return { tag: "failed", key: s.key, kind: e.kind, message: e.message }
      return s
    case "unchanged":
      return e.type === "START" ? { tag: "starting", key: e.key } : s
    case "failed":
      // Retrying a rejected start reuses the key only for network errors (request may have landed).
      return e.type === "START"
        ? { tag: "starting", key: s.kind === "network" ? s.key : e.key }
        : s
  }
}

export type RunButtonView =
  | { tag: "loading" } //   workspace not loaded yet           → disabled
  | { tag: "offline" } //   backend unreachable                → disabled, hint explains
  | { tag: "ready" } //     no run yet                         → "Run scan"
  | { tag: "starting" } //  POST in flight                     → disabled + spinner
  | { tag: "running"; progress?: number } // backend running   → disabled + progress
  | { tag: "complete"; unchanged?: boolean } // finished → "Run new scan"; unchanged = last click started nothing
  | { tag: "failed"; message: string } // start or run failed  → "Retry scan"

export function deriveRunButton(
  load: "loading" | "ready" | "offline" | "error",
  req: RunRequestState,
  run: RunStatus | null
): RunButtonView {
  if (load === "offline") return { tag: "offline" }
  if (load !== "ready") return { tag: "loading" }
  if (req.tag === "starting") return { tag: "starting" }
  if (req.tag === "failed") return { tag: "failed", message: req.message }
  if (!run) return { tag: "ready" }
  if (!TERMINAL_RUN_STATES.has(run.status)) {
    const p = run.progress
    return {
      tag: "running",
      progress: p?.total ? Math.round((p.completed / p.total) * 100) : undefined,
    }
  }
  if (run.status === "complete") return { tag: "complete", unchanged: req.tag === "unchanged" }
  return { tag: "failed", message: run.error?.message ?? run.status }
}

export const runButtonEnabled = (v: RunButtonView) =>
  v.tag === "ready" || v.tag === "complete" || v.tag === "failed"
