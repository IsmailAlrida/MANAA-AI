/**
 * Ticket lifecycle rules shared by the scan runner and operator mutations.
 *
 * Field ownership: the scan owns report content, blocks, and graph/evidence
 * references. The operator owns `status`, `closingDate` after creation,
 * `finalWriteup`, and `closedAt`. `history` is append-only and written by both.
 */
import {
  DomainError,
  stableStringify,
  stringArray,
  type ArtifactData,
} from "./types.ts"

export const FINAL_WRITEUP_MAX = 2000

/** Fields the scan may never overwrite once a ticket exists. */
const OPERATOR_OWNED = [
  "status",
  "closingDate",
  "createdAt",
  "updatedAt",
  "history",
  "finalWriteup",
  "closedAt",
] as const

export interface HistoryEntry {
  at: string
  kind: string
  actor: "scan" | "operator"
  note?: string
  evidenceIds?: string[]
}

function history(ticket: ArtifactData): HistoryEntry[] {
  return Array.isArray(ticket.history) ? (ticket.history as HistoryEntry[]) : []
}

function contentOf(ticket: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...ticket }
  for (const k of [...OPERATOR_OWNED, "revision"]) delete out[k]
  return out
}

/**
 * Merge a scan-produced ticket view into the stored ticket.
 * Returns `null` when nothing changed so the store does not bump the revision.
 */
export function mergeScanTicket(
  current: ArtifactData | null,
  view: ArtifactData,
  options: { complete: boolean; now: string }
): ArtifactData | null {
  const { now, complete } = options
  const evidenceIds = stringArray(view.evidenceIds)

  if (!current) {
    const entries: HistoryEntry[] = [
      { at: now, kind: "created", actor: "scan", evidenceIds },
    ]
    if (complete)
      entries.push({ at: now, kind: "report_published", actor: "scan" })
    return {
      ...view,
      status: "open",
      createdAt: now,
      updatedAt: now,
      history: entries,
    }
  }

  const nextContent = contentOf(view)
  if (stableStringify(contentOf(current)) === stableStringify(nextContent))
    return null

  const seen = new Set(stringArray(current.evidenceIds))
  const added = evidenceIds.filter((id) => !seen.has(id))
  const entries = [...history(current)]
  if (added.length)
    entries.push({
      at: now,
      kind: "evidence_added",
      actor: "scan",
      evidenceIds: added,
    })
  if (complete && !entries.some((e) => e.kind === "report_published")) {
    entries.push({ at: now, kind: "report_published", actor: "scan" })
  }

  const operatorFields: Record<string, unknown> = {}
  for (const k of OPERATOR_OWNED) operatorFields[k] = current[k]
  return {
    ...nextContent,
    ...operatorFields,
    id: current.id,
    updatedAt: now,
    history: entries,
  }
}

const RFC3339 =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

export function isRfc3339(value: string): boolean {
  return RFC3339.test(value) && !Number.isNaN(Date.parse(value))
}

/** Operator edit of the proposed closing date. `null` clears the proposal. */
export function applyClosingDate(
  current: ArtifactData,
  closingDate: string | null,
  now: string
): ArtifactData | null {
  if (current.status === "closed") {
    throw new DomainError(
      409,
      "ticket_closed",
      "Closed tickets cannot be edited."
    )
  }
  const previous = (current.closingDate as string | null | undefined) ?? null
  if (previous === closingDate) return null
  return {
    ...current,
    closingDate,
    updatedAt: now,
    history: [
      ...history(current),
      {
        at: now,
        kind: "closing_date_changed",
        actor: "operator",
        note: `${previous ?? "none"} → ${closingDate ?? "none"}`,
      },
    ],
  }
}

/** Archive a ticket with the operator's required free-text write-up. */
export function applyClose(
  current: ArtifactData,
  finalWriteup: string,
  now: string
): ArtifactData {
  if (current.status === "closed") {
    throw new DomainError(
      409,
      "ticket_closed",
      "This ticket is already closed."
    )
  }
  return {
    ...current,
    status: "closed",
    finalWriteup,
    closedAt: now,
    updatedAt: now,
    history: [
      ...history(current),
      { at: now, kind: "closed", actor: "operator", note: finalWriteup },
    ],
  }
}
