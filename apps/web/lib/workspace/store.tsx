"use client"

/**
 * Workspace store: domain records from the API + transient view state.
 * Context + useReducer; no fixture imports, no reveal timing — the backend
 * owns progression and we only merge what it sends.
 */
import * as React from "react"

import { api, ApiError, newIdempotencyKey } from "@/lib/api/client"
import {
  entityUpsertSchema,
  relationshipUpsertSchema,
  runStatusSchema,
  SSE_EVENTS,
  TERMINAL_RUN_STATES,
  ticketUpsertSchema,
  type GraphEntity,
  type GraphRelationship,
  type RunStatus,
  type Snapshot,
  type Ticket,
} from "@/lib/api/types"
import {
  connectionReducer,
  type ConnectionEvent,
  type ConnectionState,
} from "@/lib/machines/connection"
import {
  runRequestReducer,
  type RunRequestEvent,
  type RunRequestState,
} from "@/lib/machines/run-scan"
import type { QueueFilter } from "./derive"
import { mergeRun, upsert, upsertMany, type ById } from "./merge"

/**
 * `offline` = backend unreachable/unconfigured. Non-blocking: the shell and
 * empty viewports still render; Retry re-runs the load.
 */
export type NetworkViewId = "graph" | "entities" | "relationships"

type LoadState =
  | { tag: "loading" }
  | { tag: "ready" }
  | { tag: "offline"; message: string }
  | { tag: "error"; message: string }

export interface WorkspaceState {
  load: LoadState
  workspaceId?: string
  entities: ById<GraphEntity>
  relationships: ById<GraphRelationship>
  tickets: ById<Ticket>
  run: RunStatus | null
  connection: ConnectionState
  runRequest: RunRequestState
  // transient view state (preserved across Network ↔ Tickets ↔ detail)
  queue: { filter: QueueFilter; search: string }
  selectedEntityId: string | null
  networkView: NetworkViewId
  legendOpen: boolean
  agentPanelOpen: boolean
}

type Action =
  | { type: "LOAD_START" }
  | { type: "LOAD_OK"; snapshot: Snapshot }
  | { type: "LOAD_FAIL"; message: string; offline: boolean }
  | { type: "MERGE_SNAPSHOT"; snapshot: Snapshot }
  | { type: "UPSERT_ENTITY"; entity: GraphEntity }
  | { type: "UPSERT_RELATIONSHIP"; relationship: GraphRelationship }
  | { type: "UPSERT_TICKET"; ticket: Ticket }
  | { type: "RUN_STATUS"; run: RunStatus }
  | { type: "CONNECTION"; event: ConnectionEvent }
  | { type: "RUN_REQUEST"; event: RunRequestEvent }
  | { type: "SET_QUEUE"; queue: Partial<WorkspaceState["queue"]> }
  | { type: "SELECT_ENTITY"; id: string | null }
  | { type: "SET_AGENT_PANEL"; open: boolean }
  | { type: "SET_NETWORK_VIEW"; view: NetworkViewId }
  | { type: "SET_LEGEND"; open: boolean }

const initial: WorkspaceState = {
  load: { tag: "loading" },
  entities: {},
  relationships: {},
  tickets: {},
  run: null,
  connection: "idle",
  runRequest: { tag: "idle" },
  queue: { filter: "all", search: "" },
  selectedEntityId: null,
  networkView: "graph",
  legendOpen: true,
  agentPanelOpen: false,
}

function mergeSnapshot(s: WorkspaceState, snap: Snapshot): WorkspaceState {
  return {
    ...s,
    workspaceId: snap.workspaceId ?? s.workspaceId,
    entities: upsertMany(s.entities, snap.entities),
    relationships: upsertMany(s.relationships, snap.relationships),
    tickets: upsertMany(s.tickets, snap.tickets),
    run: snap.run === undefined ? s.run : mergeRun(s.run, snap.run),
  }
}

function reducer(s: WorkspaceState, a: Action): WorkspaceState {
  switch (a.type) {
    case "LOAD_START":
      return { ...s, load: { tag: "loading" } }
    case "LOAD_OK":
      return { ...mergeSnapshot(s, a.snapshot), load: { tag: "ready" } }
    case "LOAD_FAIL":
      return { ...s, load: { tag: a.offline ? "offline" : "error", message: a.message } }
    case "MERGE_SNAPSHOT":
      return mergeSnapshot(s, a.snapshot)
    case "UPSERT_ENTITY":
      return { ...s, entities: upsert(s.entities, a.entity) }
    case "UPSERT_RELATIONSHIP":
      return { ...s, relationships: upsert(s.relationships, a.relationship) }
    case "UPSERT_TICKET":
      return { ...s, tickets: upsert(s.tickets, a.ticket) }
    case "RUN_STATUS":
      return { ...s, run: mergeRun(s.run, a.run) }
    case "CONNECTION":
      return { ...s, connection: connectionReducer(s.connection, a.event) }
    case "RUN_REQUEST":
      return { ...s, runRequest: runRequestReducer(s.runRequest, a.event) }
    case "SET_QUEUE":
      return { ...s, queue: { ...s.queue, ...a.queue } }
    case "SELECT_ENTITY":
      return { ...s, selectedEntityId: a.id }
    case "SET_AGENT_PANEL":
      return { ...s, agentPanelOpen: a.open }
    case "SET_NETWORK_VIEW":
      return { ...s, networkView: a.view }
    case "SET_LEGEND":
      return { ...s, legendOpen: a.open }
  }
}

interface WorkspaceActions {
  reload: () => void
  startRun: () => Promise<void>
  pauseMonitor: () => Promise<RunStatus>
  resumeMonitor: () => Promise<RunStatus>
  upsertTicket: (t: Ticket) => void
  setQueue: (q: Partial<WorkspaceState["queue"]>) => void
  selectEntity: (id: string | null) => void
  setAgentPanel: (open: boolean) => void
  setNetworkView: (view: NetworkViewId) => void
  setLegendOpen: (open: boolean) => void
}

const StateCtx = React.createContext<WorkspaceState | null>(null)
const ActionsCtx = React.createContext<WorkspaceActions | null>(null)

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

/** Subscribe-first, then snapshot on every open. Merges by id/revision. */
function useRunStream(runId: string | null, dispatch: React.Dispatch<Action>) {
  React.useEffect(() => {
    if (!runId) return
    const conn = (event: ConnectionEvent) =>
      dispatch({ type: "CONNECTION", event })
    conn({ type: "SUBSCRIBE" })

    const es = new EventSource(api.runEventsUrl(runId), {
      withCredentials: true,
    })
    let disposed = false
    const warn = (name: string, raw: string) =>
      console.warn(`[sse] malformed ${name} payload`, raw.slice(0, 200))

    es.onopen = () => {
      conn({ type: "OPEN" })
      api
        .getRunSnapshot(runId)
        .then((snapshot) => {
          if (disposed) return
          dispatch({ type: "MERGE_SNAPSHOT", snapshot })
          conn({ type: "SNAPSHOT_OK" })
        })
        .catch(() => {
          if (!disposed) conn({ type: "SNAPSHOT_FAIL" })
        })
    }

    es.onerror = () => {
      // CONNECTING → browser is retrying; CLOSED → server rejected (e.g. 4xx), stop.
      conn(
        es.readyState === EventSource.CLOSED
          ? { type: "CLOSED_BY_SERVER" }
          : { type: "DROPPED" }
      )
    }

    es.addEventListener(SSE_EVENTS.entity, (ev) => {
      const r = entityUpsertSchema.safeParse(parseJson(ev.data))
      if (r.success) dispatch({ type: "UPSERT_ENTITY", entity: r.data.data })
      else warn(SSE_EVENTS.entity, ev.data)
    })
    es.addEventListener(SSE_EVENTS.relationship, (ev) => {
      const r = relationshipUpsertSchema.safeParse(parseJson(ev.data))
      if (r.success)
        dispatch({ type: "UPSERT_RELATIONSHIP", relationship: r.data.data })
      else warn(SSE_EVENTS.relationship, ev.data)
    })
    es.addEventListener(SSE_EVENTS.ticket, (ev) => {
      const r = ticketUpsertSchema.safeParse(parseJson(ev.data))
      if (r.success) dispatch({ type: "UPSERT_TICKET", ticket: r.data.data })
      else warn(SSE_EVENTS.ticket, ev.data)
    })
    es.addEventListener(SSE_EVENTS.run, (ev) => {
      // run.status may arrive bare or wrapped in {data}
      const raw = parseJson(ev.data) as { data?: unknown } | undefined
      const r = runStatusSchema.safeParse(raw?.data ?? raw)
      if (r.success) dispatch({ type: "RUN_STATUS", run: r.data })
      else warn(SSE_EVENTS.run, ev.data)
    })

    return () => {
      disposed = true
      es.close()
      conn({ type: "STOP" })
    }
  }, [runId, dispatch])
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, initial)

  const reload = React.useCallback(() => {
    dispatch({ type: "LOAD_START" })
    api
      .getWorkspace()
      .then((snapshot) => dispatch({ type: "LOAD_OK", snapshot }))
      .catch((e) =>
        dispatch({
          type: "LOAD_FAIL",
          message: errMsg(e),
          offline: !(e instanceof ApiError) || e.kind === "network" || e.kind === "unavailable",
        })
      )
  }, [])

  React.useEffect(reload, [reload])

  // Stream only while the backend reports a non-terminal run.
  const activeRunId =
    state.run && !TERMINAL_RUN_STATES.has(state.run.status)
      ? state.run.runId
      : null
  useRunStream(activeRunId, dispatch)

  const runRequestRef = React.useRef(state.runRequest)
  const runRef = React.useRef(state.run)
  React.useEffect(() => {
    runRequestRef.current = state.runRequest
    runRef.current = state.run
  }, [state.runRequest, state.run])

  const actions = React.useMemo<WorkspaceActions>(
    () => ({
      reload,
      startRun: async () => {
        const cur = runRequestRef.current
        if (cur.tag === "starting") return
        const key = newIdempotencyKey() // reducer keeps the old key on network-failure retries
        dispatch({ type: "RUN_REQUEST", event: { type: "START", key } })
        const usedKey =
          cur.tag === "failed" && cur.kind === "network" ? cur.key : key
        runRequestRef.current = { tag: "starting", key: usedKey }
        try {
          const known = runRef.current
          const run = await api.startRun(usedKey)
          // Same finished run back = the service started nothing new.
          const unchanged =
            !!known && known.runId === run.runId && TERMINAL_RUN_STATES.has(run.status)
          dispatch({ type: "RUN_STATUS", run })
          dispatch({
            type: "RUN_REQUEST",
            event: { type: unchanged ? "UNCHANGED" : "ACCEPTED" },
          })
        } catch (e) {
          const kind = e instanceof ApiError ? e.kind : "network"
          dispatch({
            type: "RUN_REQUEST",
            event: { type: "REJECTED", kind, message: errMsg(e) },
          })
        }
      },
      pauseMonitor: async () => {
        const run = await api.pauseMonitor()
        dispatch({ type: "RUN_STATUS", run })
        return run
      },
      resumeMonitor: async () => {
        const run = await api.resumeMonitor()
        dispatch({ type: "RUN_STATUS", run })
        return run
      },
      upsertTicket: (ticket) => dispatch({ type: "UPSERT_TICKET", ticket }),
      setQueue: (queue) => dispatch({ type: "SET_QUEUE", queue }),
      selectEntity: (id) => dispatch({ type: "SELECT_ENTITY", id }),
      setAgentPanel: (open) => dispatch({ type: "SET_AGENT_PANEL", open }),
      setNetworkView: (view) => dispatch({ type: "SET_NETWORK_VIEW", view }),
      setLegendOpen: (open) => dispatch({ type: "SET_LEGEND", open }),
    }),
    [reload]
  )

  return (
    <ActionsCtx.Provider value={actions}>
      <StateCtx.Provider value={state}>{children}</StateCtx.Provider>
    </ActionsCtx.Provider>
  )
}

export function useWorkspace() {
  const s = React.useContext(StateCtx)
  if (!s) throw new Error("useWorkspace must be used inside WorkspaceProvider")
  return s
}

export function useWorkspaceActions() {
  const a = React.useContext(ActionsCtx)
  if (!a)
    throw new Error("useWorkspaceActions must be used inside WorkspaceProvider")
  return a
}

/** "now" that ticks each minute so derived overdue status stays fresh. */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
