"use client"

import { IconPlugConnectedX, IconRefresh } from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"

import { useLocale } from "@/lib/i18n"
import { useWorkspace, useWorkspaceActions } from "@/lib/workspace/store"
import { Hint } from "../hint"

/** Operational status as text (never a toast/bell). role=status for SRs. */
export function ConnectionStatus() {
  const { t } = useLocale()
  const { connection, load } = useWorkspace()
  const { reload } = useWorkspaceActions()

  if (load.tag === "offline")
    return (
      <div role="status" aria-live="polite" className="flex items-center gap-1">
        <Hint label={t.hint.offline}>
          <Badge variant="outline" tabIndex={0}>
            <IconPlugConnectedX />
            {t.load.offline}
          </Badge>
        </Hint>
        <Hint label={t.hint.retry}>
          <Button variant="ghost" size="icon" aria-label={t.hint.retry} onClick={reload}>
            <IconRefresh />
          </Button>
        </Hint>
      </div>
    )

  if (connection === "idle") return null
  const variant = connection === "error" ? "destructive" : connection === "live" ? "secondary" : "outline"
  return (
    <Badge role="status" aria-live="polite" variant={variant}>
      {t.conn[connection]}
    </Badge>
  )
}
