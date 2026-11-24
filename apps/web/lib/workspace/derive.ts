import type { Ticket } from "@/lib/api/types"

/** View status: overdue is derived, never stored; lifecycle stays open/closed. */
export type TicketViewStatus = "open" | "overdue" | "closed"

export function ticketViewStatus(t: Ticket, now: number): TicketViewStatus {
  if (t.status === "closed") return "closed"
  if (t.closingDate && Date.parse(t.closingDate) < now) return "overdue"
  return "open"
}

export type QueueFilter = "all" | TicketViewStatus

export function filterTickets(tickets: Ticket[], filter: QueueFilter, search: string, now: number) {
  const q = search.trim().toLowerCase()
  return tickets
    .filter((t) => filter === "all" || ticketViewStatus(t, now) === filter)
    .filter((t) => !q || t.title.toLowerCase().includes(q) || t.id.toLowerCase().includes(q))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}
