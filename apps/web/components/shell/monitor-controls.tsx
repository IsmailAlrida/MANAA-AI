"use client"

import * as React from "react"
import { IconPlayerPause, IconPlayerPlay } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"

import { ApiError } from "@/lib/api/client"
import { localizeApiError, useLocale } from "@/lib/i18n"
import { useWorkspace, useWorkspaceActions } from "@/lib/workspace/store"

export function MonitorControls() {
  const { t, locale } = useLocale()
  const { run } = useWorkspace()
  const { pauseMonitor, resumeMonitor } = useWorkspaceActions()
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  if (!run) return null

  const act = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      const kind = e instanceof ApiError ? e.kind : "network"
      setError(localizeApiError(locale, kind, e instanceof Error ? e.message : String(e)))
    } finally {
      setBusy(false)
    }
  }

  if (run.status === "running")
    return (
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          aria-busy={busy}
          onClick={() => void act(pauseMonitor)}
        >
          <IconPlayerPause />
          {busy ? t.monitor.pausing : t.monitor.pause}
        </Button>
        {error && <span role="alert" className="text-xs text-destructive">{error}</span>}
      </div>
    )

  if (run.status === "paused")
    return (
      <div className="flex items-center gap-1">
        <span role="status" className="text-sm text-muted-foreground">{t.monitor.paused}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          aria-busy={busy}
          onClick={() => void act(resumeMonitor)}
        >
          <IconPlayerPlay />
          {busy ? t.monitor.resuming : t.monitor.resume}
        </Button>
        {error && <span role="alert" className="text-xs text-destructive">{error}</span>}
      </div>
    )

  if (run.status === "complete")
    return <span role="status" className="text-sm text-muted-foreground">{t.monitor.complete}</span>

  return null
}
