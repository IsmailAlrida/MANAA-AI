/**
 * Close-ticket dialog machine.
 *
 *   closed ──OPEN──▶ editing ──SUBMIT(valid)──▶ submitting ──SUCCESS──▶ done ──(auto)──▶ closed
 *     ▲                │  ▲                        │
 *     └────CANCEL──────┘  └──────EDIT───── error ◀─┘ FAILURE
 *
 * The write-up is the only required field (no outcome dropdown, per PRD).
 * The idempotency key is minted on OPEN and reused across retries, so a
 * retried submit can never double-close.
 */
import type { ApiErrorKind } from "@/lib/api/client"

export const WRITEUP_MAX = 2000

export type CloseTicketState =
  | { tag: "closed" }
  | { tag: "editing"; draft: string; key: string; invalid: boolean }
  | { tag: "submitting"; draft: string; key: string }
  | { tag: "error"; draft: string; key: string; kind: ApiErrorKind; message: string }
  | { tag: "done" }

export type CloseTicketEvent =
  | { type: "OPEN"; key: string }
  | { type: "EDIT"; draft: string }
  | { type: "SUBMIT" }
  | { type: "SUCCESS" }
  | { type: "FAILURE"; kind: ApiErrorKind; message: string }
  | { type: "CANCEL" }
  | { type: "RESET" }

export const closeTicketInitial: CloseTicketState = { tag: "closed" }

const valid = (s: string) => s.trim().length > 0 && s.length <= WRITEUP_MAX

export function closeTicketReducer(s: CloseTicketState, e: CloseTicketEvent): CloseTicketState {
  switch (s.tag) {
    case "closed":
      return e.type === "OPEN" ? { tag: "editing", draft: "", key: e.key, invalid: false } : s
    case "editing":
      if (e.type === "EDIT") return { ...s, draft: e.draft, invalid: false }
      if (e.type === "SUBMIT")
        return valid(s.draft) ? { tag: "submitting", draft: s.draft, key: s.key } : { ...s, invalid: true }
      if (e.type === "CANCEL") return { tag: "closed" }
      return s
    case "submitting":
      // CANCEL ignored: request is in flight; the dialog stays modal until it settles.
      if (e.type === "SUCCESS") return { tag: "done" }
      if (e.type === "FAILURE") return { tag: "error", draft: s.draft, key: s.key, kind: e.kind, message: e.message }
      return s
    case "error":
      if (e.type === "EDIT") return { tag: "editing", draft: e.draft, key: s.key, invalid: false }
      if (e.type === "SUBMIT") return valid(s.draft) ? { tag: "submitting", draft: s.draft, key: s.key } : s
      if (e.type === "CANCEL") return { tag: "closed" }
      return s
    case "done":
      return e.type === "RESET" || e.type === "CANCEL" ? { tag: "closed" } : s
  }
}

export const isCloseDialogOpen = (s: CloseTicketState) => s.tag !== "closed"
export const canSubmitClose = (s: CloseTicketState) =>
  (s.tag === "editing" || s.tag === "error") && valid(s.draft)
