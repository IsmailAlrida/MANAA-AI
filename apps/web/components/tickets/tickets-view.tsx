"use client"

import { useWorkspace } from "@/lib/workspace/store"
import { WorkspaceGate } from "../shell/workspace-gate"
import { TicketQueue } from "./ticket-queue"

export function TicketsView() {
  const ws = useWorkspace()
  return (
    <WorkspaceGate hasData={Object.keys(ws.tickets).length > 0}>
      <TicketQueue />
    </WorkspaceGate>
  )
}
