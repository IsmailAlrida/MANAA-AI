"use client"

import * as React from "react"
import { IconCalendar, IconCalendarX, IconRefresh, IconX } from "@tabler/icons-react"
import { Alert, AlertAction, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import { Spinner } from "@workspace/ui/components/spinner"

import { api, ApiError } from "@/lib/api/client"
import type { Ticket } from "@/lib/api/types"
import { localizeApiError, useLocale } from "@/lib/i18n"
import { closingDateInitial, closingDateReducer } from "@/lib/machines/closing-date"
import { useWorkspaceActions } from "@/lib/workspace/store"
import { Hint } from "../hint"

/** Keep the original time-of-day; only the calendar date changes. */
function withDate(prevIso: string | null | undefined, day: Date): string {
  const base = prevIso ? new Date(prevIso) : new Date(Date.UTC(2000, 0, 1, 12))
  return new Date(
    Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), base.getUTCHours(), base.getUTCMinutes())
  ).toISOString()
}

export function ClosingDateEditor({ ticket }: { ticket: Ticket }) {
  const { t, fmtDate, locale } = useLocale()
  const { upsertTicket, reload } = useWorkspaceActions()
  const [s, send] = React.useReducer(closingDateReducer, closingDateInitial)
  const disabled = ticket.status === "closed"

  // Side effect for the `saving` state.
  React.useEffect(() => {
    if (s.tag !== "saving") return
    let cancelled = false
    api
      .patchTicket(ticket.id, ticket.revision, { closingDate: s.value })
      .then((updated) => {
        if (cancelled) return
        upsertTicket(updated)
        send({ type: "SUCCESS" })
      })
      .catch((e) => {
        if (cancelled) return
        const kind = e instanceof ApiError ? e.kind : "network"
        send({
          type: "FAILURE",
          kind,
          message: localizeApiError(locale, kind, e instanceof Error ? e.message : String(e)),
        })
      })
    return () => {
      cancelled = true
    }
    // ticket.revision intentionally captured at transition time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s])

  const selected = ticket.closingDate ? new Date(ticket.closingDate) : undefined

  return (
    <div className="flex flex-col gap-2">
      <Popover
        open={s.tag === "picking"}
        onOpenChange={(o) => send(o ? { type: "EDIT" } : { type: "CANCEL" })}
      >
        <Hint label={disabled ? t.hint.closingDateLocked : t.hint.closingDate}>
          <span tabIndex={disabled ? 0 : undefined}>
            <PopoverTrigger asChild>
              <Button variant="outline" disabled={disabled || s.tag === "saving"} aria-busy={s.tag === "saving"}>
                {s.tag === "saving" ? <Spinner /> : <IconCalendar />}
                {s.tag === "saving" ? t.closingDate.saving : fmtDate(ticket.closingDate) || t.closingDate.none}
              </Button>
            </PopoverTrigger>
          </span>
        </Hint>
        <PopoverContent align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(day) => day && send({ type: "PICK", value: withDate(ticket.closingDate, day) })}
          />
          <Button variant="ghost" size="sm" onClick={() => send({ type: "PICK", value: null })}>
            <IconCalendarX />
            {t.closingDate.clear}
          </Button>
        </PopoverContent>
      </Popover>

      {s.tag === "conflict" && (
        <Alert variant="destructive">
          <AlertDescription>{t.closingDate.conflict}</AlertDescription>
          <AlertAction>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                reload()
                send({ type: "RELOADED" })
              }}
            >
              <IconRefresh />
              {t.closingDate.reload}
            </Button>
          </AlertAction>
        </Alert>
      )}
      {s.tag === "error" && (
        <Alert variant="destructive">
          <AlertDescription>{s.message}</AlertDescription>
          <AlertAction>
            <Button size="sm" variant="outline" onClick={() => send({ type: "RETRY" })}>
              <IconRefresh />
              {t.closingDate.retry}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => send({ type: "CANCEL" })}>
              <IconX />
              {t.closingDate.cancel}
            </Button>
          </AlertAction>
        </Alert>
      )}
    </div>
  )
}
