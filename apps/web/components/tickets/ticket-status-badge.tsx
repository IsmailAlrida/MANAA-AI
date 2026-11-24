"use client"

import { IconAlarm, IconArchive, IconCircleDot } from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"

import { useLocale } from "@/lib/i18n"
import type { TicketViewStatus } from "@/lib/workspace/derive"
import { Hint } from "../hint"

const ICON = { open: IconCircleDot, overdue: IconAlarm, closed: IconArchive }

export function TicketStatusBadge({ status }: { status: TicketViewStatus }) {
  const { t } = useLocale()
  const variant = status === "overdue" ? "destructive" : status === "closed" ? "secondary" : "default"
  const Icon = ICON[status]
  const badge = (
    <Badge variant={variant} tabIndex={status === "overdue" ? 0 : undefined}>
      <Icon />
      {t.tickets[status]}
    </Badge>
  )
  return status === "overdue" ? <Hint label={t.hint.overdue}>{badge}</Hint> : badge
}
