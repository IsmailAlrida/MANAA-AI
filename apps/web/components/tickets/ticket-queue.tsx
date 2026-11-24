"use client"

import { useRouter } from "next/navigation"
import { IconAlarm, IconArchive, IconCircleDot, IconList, IconSearch } from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"

import { useLocale } from "@/lib/i18n"
import { filterTickets, ticketViewStatus, type QueueFilter } from "@/lib/workspace/derive"
import { ticketText } from "@/lib/api/types"
import { useNow, useWorkspace, useWorkspaceActions } from "@/lib/workspace/store"
import { Hint } from "../hint"
import { PriorityBadge } from "../priority-badge"
import { TicketStatusBadge } from "./ticket-status-badge"

const FILTERS: QueueFilter[] = ["all", "open", "overdue", "closed"]
const FILTER_ICON = { all: IconList, open: IconCircleDot, overdue: IconAlarm, closed: IconArchive }

export function TicketQueue() {
  const { t, fmtDate, locale } = useLocale()
  const ws = useWorkspace()
  const { setQueue } = useWorkspaceActions()
  const router = useRouter()
  const now = useNow()

  const all = Object.values(ws.tickets)
  const rows = filterTickets(all, ws.queue.filter, ws.queue.search, now)
  const count = (f: QueueFilter) => (f === "all" ? all.length : all.filter((tk) => ticketViewStatus(tk, now) === f).length)
  const hasPriority = all.some((tk) => tk.priority)
  const open = (id: string) => router.push(`/tickets/${encodeURIComponent(id)}`)

  return (
    <section aria-label={t.nav.tickets} className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="max-w-xs">
          <InputGroupAddon>
            <IconSearch />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            placeholder={t.tickets.search}
            aria-label={t.tickets.search}
            value={ws.queue.search}
            onChange={(e) => setQueue({ search: e.target.value })}
          />
        </InputGroup>
        <ToggleGroup
          type="single"
          variant="outline"
          value={ws.queue.filter}
          onValueChange={(v) => v && setQueue({ filter: v as QueueFilter })}
        >
          {FILTERS.map((f) => {
            const Icon = FILTER_ICON[f]
            const hint = { all: t.hint.filterAll, open: t.hint.filterOpen, overdue: t.hint.filterOverdue, closed: t.hint.filterClosed }[f]
            return (
              <Hint key={f} label={hint}>
                <ToggleGroupItem value={f}>
                  <Icon />
                  {t.tickets[f]} <Badge variant="secondary">{count(f)}</Badge>
                </ToggleGroupItem>
              </Hint>
            )
          })}
        </ToggleGroup>
      </div>

      <div className="overflow-hidden rounded-xl border shadow-sm" style={{ background: "var(--card)" }}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.tickets.title}</TableHead>
            <TableHead>{t.tickets.status}</TableHead>
            {hasPriority && <TableHead>{t.tickets.priority}</TableHead>}
            <TableHead>{t.tickets.closingDate}</TableHead>
            <TableHead>{t.tickets.updated}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={hasPriority ? 5 : 4}>
                {ws.load.tag === "offline" ? t.empty.offline : t.empty.queueFiltered}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((tk) => {
              const text = ticketText(tk, locale)
              return <TableRow
                key={tk.id}
                tabIndex={0}
                className="cursor-pointer"
                onClick={() => open(tk.id)}
                onKeyDown={(e) => e.key === "Enter" && open(tk.id)}
              >
                <TableCell className="max-w-xl whitespace-normal">
                  <div className="font-medium" dir="auto">{text.title}</div>
                  {text.summary && <small dir="auto" className="line-clamp-2 text-muted-foreground">{text.summary}</small>}
                </TableCell>
                <TableCell>
                  <TicketStatusBadge status={ticketViewStatus(tk, now)} />
                </TableCell>
                {hasPriority && (
                  <TableCell>
                    <PriorityBadge level={tk.priority?.level} reason={text.priorityReason} />
                  </TableCell>
                )}
                <TableCell>{fmtDate(tk.closingDate)}</TableCell>
                <TableCell>{fmtDate(tk.updatedAt, true)}</TableCell>
              </TableRow>
            })
          )}
        </TableBody>
      </Table>
      </div>
    </section>
  )
}
