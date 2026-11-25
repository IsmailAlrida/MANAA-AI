"use client"

import * as React from "react"
import { IconPlayerPause, IconPlayerPlay, IconRefresh, IconRepeat } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"

import { localizeApiError, useLocale } from "@/lib/i18n"
import { deriveRunButton, runButtonEnabled } from "@/lib/machines/run-scan"
import { useWorkspace, useWorkspaceActions } from "@/lib/workspace/store"
import { Hint } from "../hint"

export function RunScanButton() {
  const { t, locale } = useLocale()
  const ws = useWorkspace()
  const { startRun } = useWorkspaceActions()
  const view = deriveRunButton(ws.load.tag, ws.runRequest, ws.run)

  const label = {
    loading: t.run.loading,
    offline: t.run.scan,
    ready: t.run.scan,
    starting: t.run.starting,
    running:
      ws.run?.status === "paused"
        ? t.monitor.paused
        : view.tag === "running" && view.progress != null
        ? `${t.run.scanning} ${view.progress}%`
        : t.run.scanning,
    complete: t.run.newScan,
    failed: t.run.retry,
  }[view.tag]

  const hint = {
    loading: undefined,
    offline: t.hint.offline,
    ready: t.hint.runReady,
    starting: t.hint.runBusy,
    running: t.hint.runBusy,
    complete: view.tag === "complete" && view.unchanged ? t.hint.runUnchanged : t.hint.runComplete,
    failed:
      view.tag === "failed"
        ? localizeApiError(
            locale,
            ws.runRequest.tag === "failed" ? ws.runRequest.kind : "server",
            view.message
          )
        : undefined,
  }[view.tag]

  const busy =
    view.tag === "starting" ||
    (view.tag === "running" && ws.run?.status !== "paused") ||
    view.tag === "loading"
  const icon = ws.run?.status === "paused" ? (
    <IconPlayerPause />
  ) : busy ? (
    <Spinner />
  ) : view.tag === "failed" ? (
    <IconRefresh />
  ) : view.tag === "complete" ? (
    <IconRepeat />
  ) : (
    <IconPlayerPlay />
  )

  const enabled = runButtonEnabled(view)

  // A click closes the tooltip, so when the service says "nothing new started"
  // the explanation must open by itself, briefly, then fall back to hover.
  const unchanged = view.tag === "complete" && !!view.unchanged
  const [hovered, setHovered] = React.useState(false)
  const [announce, setAnnounce] = React.useState(false)
  React.useEffect(() => {
    if (!unchanged) return
    setAnnounce(true)
    const id = setTimeout(() => setAnnounce(false), 4000)
    return () => clearTimeout(id)
  }, [unchanged])

  return (
    <Hint label={hint} open={hovered || announce} onOpenChange={setHovered}>
      {/* Disabled buttons swallow pointer events; the span keeps the hover label working while busy. */}
      <span tabIndex={enabled ? undefined : 0}>
        <Button
          onClick={() => void startRun()}
          disabled={!enabled}
          variant={view.tag === "failed" ? "destructive" : "default"}
          aria-busy={busy}
        >
          {icon}
          {label}
        </Button>
      </span>
    </Hint>
  )
}
