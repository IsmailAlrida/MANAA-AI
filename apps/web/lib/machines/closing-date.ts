/**
 * Proposed-closing-date editor machine.
 *
 *   viewing ──EDIT──▶ picking ──PICK──▶ saving ──SUCCESS──▶ viewing
 *      ▲                │                 │
 *      └─────CANCEL─────┘                 ├─FAILURE(conflict)──▶ conflict ──RELOADED──▶ viewing
 *                                         └─FAILURE(other)─────▶ error ──RETRY──▶ saving / CANCEL ──▶ viewing
 *
 * PATCH carries If-Match with the ticket revision; a 409 means someone (or the
 * backend) changed the ticket. We never auto-overwrite — the operator reloads.
 */
import type { ApiErrorKind } from "@/lib/api/client"

export type ClosingDateState =
  | { tag: "viewing" }
  | { tag: "picking" }
  | { tag: "saving"; value: string | null }
  | { tag: "conflict"; value: string | null; message: string }
  | { tag: "error"; value: string | null; message: string }

export type ClosingDateEvent =
  | { type: "EDIT" }
  | { type: "PICK"; value: string | null }
  | { type: "SUCCESS" }
  | { type: "FAILURE"; kind: ApiErrorKind; message: string }
  | { type: "RETRY" }
  | { type: "RELOADED" }
  | { type: "CANCEL" }

export const closingDateInitial: ClosingDateState = { tag: "viewing" }

export function closingDateReducer(s: ClosingDateState, e: ClosingDateEvent): ClosingDateState {
  switch (s.tag) {
    case "viewing":
      return e.type === "EDIT" ? { tag: "picking" } : s
    case "picking":
      if (e.type === "PICK") return { tag: "saving", value: e.value }
      if (e.type === "CANCEL") return { tag: "viewing" }
      return s
    case "saving":
      if (e.type === "SUCCESS") return { tag: "viewing" }
      if (e.type === "FAILURE")
        return e.kind === "conflict"
          ? { tag: "conflict", value: s.value, message: e.message }
          : { tag: "error", value: s.value, message: e.message }
      return s
    case "conflict":
      return e.type === "RELOADED" || e.type === "CANCEL" ? { tag: "viewing" } : s
    case "error":
      if (e.type === "RETRY") return { tag: "saving", value: s.value }
      if (e.type === "CANCEL") return { tag: "viewing" }
      return s
  }
}
