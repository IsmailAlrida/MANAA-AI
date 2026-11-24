"use client"

import * as React from "react"
import { IconMessageCircle, IconRefresh } from "@tabler/icons-react"
import { Direction } from "radix-ui"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@workspace/ui/components/resizable"
import { TooltipProvider } from "@workspace/ui/components/tooltip"

import { useLocale } from "@/lib/i18n"
import { useWorkspace, useWorkspaceActions } from "@/lib/workspace/store"
import { Hint } from "../hint"
import { AgentPanel } from "./agent-panel"
import { ConnectionStatus } from "./connection-status"
import { LocaleToggle } from "./locale-toggle"
import { MonitorControls } from "./monitor-controls"
import { RunScanButton } from "./run-scan-button"
import { TopNav } from "./top-nav"

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const { dir, t } = useLocale()
  const ws = useWorkspace()
  const { setAgentPanel, reload } = useWorkspaceActions()

  return (
    <Direction.Provider dir={dir}>
      <TooltipProvider>
        <div className="flex h-svh flex-col">
          <header className="header-scope flex flex-wrap items-center gap-2 px-3 py-2 shadow-sm">
            <TopNav />
            <div className="flex-1" />
            <ConnectionStatus />
            <RunScanButton />
            <MonitorControls />
            <LocaleToggle />
            <Hint label={t.agent.toggle}>
              <Button
                variant={ws.agentPanelOpen ? "secondary" : "ghost"}
                size="icon"
                aria-label={t.agent.toggle}
                aria-pressed={ws.agentPanelOpen}
                onClick={() => setAgentPanel(!ws.agentPanelOpen)}
              >
                <IconMessageCircle />
              </Button>
            </Hint>
          </header>

          {/* Hard errors only; "offline" is shown non-blockingly in the header. */}
          {ws.load.tag === "error" && (
            <Alert variant="destructive">
              <AlertTitle>{t.load.error}</AlertTitle>
              <AlertDescription>{ws.load.message}</AlertDescription>
              <AlertAction>
                <Button size="sm" variant="outline" onClick={reload}>
                  <IconRefresh />
                  {t.load.retry}
                </Button>
              </AlertAction>
            </Alert>
          )}

          {/* The agent sits on the START side (left in EN, right in AR) — the opposite side from the
                inspector / detail panel, which lives at the end. DOM order = logical order; flex follows dir. */}
          <ResizablePanelGroup
            orientation="horizontal"
            className="min-h-0 flex-1"
          >
            {ws.agentPanelOpen && (
              <>
                <ResizablePanel
                  id="agent"
                  defaultSize="28%"
                  minSize="20%"
                  maxSize="45%"
                >
                  <AgentPanel />
                </ResizablePanel>
                <ResizableHandle withHandle />
              </>
            )}
            <ResizablePanel id="main" minSize="40%">
              <main className="h-full overflow-auto">{children}</main>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </TooltipProvider>
    </Direction.Provider>
  )
}
