import * as React from "react"
import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { deriveRunButton } from "@/lib/machines/run-scan"
import { useWorkspace, useWorkspaceActions, WorkspaceProvider } from "@/lib/workspace/store"

/* ---------- fakes ---------- */

class FakeES {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSED = 2
  static instances: FakeES[] = []
  readyState = 0
  closed = false
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  private listeners = new Map<string, ((e: { data: string }) => void)[]>()
  constructor(readonly url: string) {
    FakeES.instances.push(this)
    log.push(`es:new ${url}`)
  }
  addEventListener(name: string, fn: (e: { data: string }) => void) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), fn])
  }
  close() {
    this.closed = true
    this.readyState = FakeES.CLOSED
  }
  open() {
    this.readyState = FakeES.OPEN
    this.onopen?.()
  }
  emit(name: string, payload: unknown) {
    const data = typeof payload === "string" ? payload : JSON.stringify(payload)
    this.listeners.get(name)?.forEach((fn) => fn({ data }))
  }
}

let log: string[] = []
let routes: Record<string, () => Response | Promise<Response>> = {}

const ticket = (revision: number, title = "T") => ({
  id: "TKT-1",
  revision,
  title,
  status: "open",
  createdAt: "2026-11-24T08:00:00Z",
  updatedAt: "2026-11-24T08:00:00Z",
})
const snap = (over: Record<string, unknown> = {}) => ({
  workspaceId: "ws",
  entities: [],
  relationships: [],
  tickets: [],
  run: null,
  ...over,
})
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
const running = { runId: "r1", status: "running", progress: { completed: 1, total: 12 } }

beforeEach(() => {
  log = []
  routes = {}
  FakeES.instances = []
  vi.stubGlobal("EventSource", FakeES)
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const path = String(input)
      log.push(`fetch:${init?.method ?? "GET"} ${path}`)
      const handler = routes[path]
      if (!handler) throw new TypeError("network down")
      return handler()
    })
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const wrapper = ({ children }: { children: React.ReactNode }) => <WorkspaceProvider>{children}</WorkspaceProvider>
const mount = () =>
  renderHook(() => ({ ws: useWorkspace(), actions: useWorkspaceActions() }), { wrapper })

/* ---------- tests ---------- */

describe("workspace store", () => {
  it("subscribes before it fetches the run snapshot, and resumes a running run from the workspace snapshot", async () => {
    routes["/api/v1/workspace"] = () => json(snap({ run: running }))
    routes["/api/v1/runs/r1/snapshot"] = () => json(snap({ run: running }))
    const { result } = mount()

    await waitFor(() => expect(FakeES.instances).toHaveLength(1))
    expect(result.current.ws.load.tag).toBe("ready")
    expect(log.indexOf("es:new /api/v1/runs/r1/events")).toBeGreaterThan(log.indexOf("fetch:GET /api/v1/workspace"))
    expect(log).not.toContain("fetch:GET /api/v1/runs/r1/snapshot") // not before the stream opens

    await act(async () => FakeES.instances[0]!.open())
    await waitFor(() => expect(log).toContain("fetch:GET /api/v1/runs/r1/snapshot"))
    await waitFor(() => expect(result.current.ws.connection).toBe("live"))
  })

  it("never lets a stale snapshot roll back a newer streamed revision", async () => {
    routes["/api/v1/workspace"] = () => json(snap({ run: running }))
    routes["/api/v1/runs/r1/snapshot"] = () => json(snap({ run: running, tickets: [ticket(2, "old")] }))
    const { result } = mount()
    await waitFor(() => expect(FakeES.instances).toHaveLength(1))
    const es = FakeES.instances[0]!

    act(() => es.emit("ticket.upsert", { revision: 3, data: ticket(3, "new") }))
    await act(async () => es.open()) // snapshot (rev 2) arrives after the rev 3 upsert
    await waitFor(() => expect(result.current.ws.connection).toBe("live"))
    expect(result.current.ws.tickets["TKT-1"]?.title).toBe("new")
  })

  it("refetches the snapshot on every reconnect", async () => {
    routes["/api/v1/workspace"] = () => json(snap({ run: running }))
    routes["/api/v1/runs/r1/snapshot"] = () => json(snap({ run: running }))
    mount()
    await waitFor(() => expect(FakeES.instances).toHaveLength(1))
    const es = FakeES.instances[0]!
    await act(async () => es.open())
    await act(async () => es.onerror?.()) // browser will auto-retry
    await act(async () => es.open())
    await waitFor(() =>
      expect(log.filter((l) => l === "fetch:GET /api/v1/runs/r1/snapshot")).toHaveLength(2)
    )
  })

  it("closes the stream when the run reaches a terminal state", async () => {
    routes["/api/v1/workspace"] = () => json(snap({ run: running }))
    routes["/api/v1/runs/r1/snapshot"] = () => json(snap({ run: running }))
    const { result } = mount()
    await waitFor(() => expect(FakeES.instances).toHaveLength(1))
    const es = FakeES.instances[0]!
    act(() => es.emit("run.status", { runId: "r1", status: "complete", progress: { completed: 12, total: 12 } }))
    await waitFor(() => expect(es.closed).toBe(true))
    expect(result.current.ws.run?.status).toBe("complete")
  })

  it("ignores malformed events without crashing", async () => {
    routes["/api/v1/workspace"] = () => json(snap({ run: running }))
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const { result } = mount()
    await waitFor(() => expect(FakeES.instances).toHaveLength(1))
    act(() => FakeES.instances[0]!.emit("ticket.upsert", "{not json"))
    act(() => FakeES.instances[0]!.emit("ticket.upsert", { revision: 1, data: { id: 5 } }))
    expect(Object.keys(result.current.ws.tickets)).toHaveLength(0)
  })

  it("treats an unreachable or unconfigured backend as offline, not as a hard error", async () => {
    const down = mount()
    await waitFor(() => expect(down.result.current.ws.load.tag).toBe("offline"))

    routes["/api/v1/workspace"] = () => json({ error: { code: "backend_unavailable", message: "none" } }, 503)
    const unavailable = mount()
    await waitFor(() => expect(unavailable.result.current.ws.load.tag).toBe("offline"))
  })
})

describe("run again after a completed run", () => {
  const complete = { runId: "r1", status: "complete", progress: { completed: 12, total: 12 } }

  it("flags that no new scan started when the service returns the same completed run", async () => {
    routes["/api/v1/workspace"] = () => json(snap({ run: complete }))
    routes["/api/v1/runs"] = () => json(complete, 200) // demo-api: existing run reused
    const { result } = mount()
    await waitFor(() => expect(result.current.ws.load.tag).toBe("ready"))

    await act(async () => result.current.actions.startRun())

    const view = deriveRunButton(result.current.ws.load.tag, result.current.ws.runRequest, result.current.ws.run)
    expect(view).toMatchObject({ tag: "complete", unchanged: true })
    expect(FakeES.instances).toHaveLength(0) // nothing to stream
  })

  it("does not flag a genuinely new run", async () => {
    routes["/api/v1/workspace"] = () => json(snap({ run: complete }))
    routes["/api/v1/runs"] = () => json({ runId: "r2", status: "running" }, 202)
    routes["/api/v1/runs/r2/snapshot"] = () => json(snap({ run: { runId: "r2", status: "running" } }))
    const { result } = mount()
    await waitFor(() => expect(result.current.ws.load.tag).toBe("ready"))

    await act(async () => result.current.actions.startRun())

    const view = deriveRunButton(result.current.ws.load.tag, result.current.ws.runRequest, result.current.ws.run)
    expect(view.tag).toBe("running")
    await waitFor(() => expect(FakeES.instances).toHaveLength(1))
  })
})
