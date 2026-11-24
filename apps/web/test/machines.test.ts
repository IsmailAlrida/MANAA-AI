import { describe, expect, it } from "vitest"

import { closeTicketReducer, type CloseTicketState } from "@/lib/machines/close-ticket"
import { closingDateReducer } from "@/lib/machines/closing-date"
import { connectionReducer } from "@/lib/machines/connection"
import { deriveRunButton, runRequestReducer } from "@/lib/machines/run-scan"

describe("close-ticket machine", () => {
  const editing = (draft: string): CloseTicketState => ({ tag: "editing", draft, key: "k", invalid: false })

  it("rejects a blank write-up without submitting", () => {
    expect(closeTicketReducer(editing("   "), { type: "SUBMIT" })).toMatchObject({ tag: "editing", invalid: true })
  })
  it("submits a valid write-up and finishes", () => {
    const sub = closeTicketReducer(editing("Takedown done"), { type: "SUBMIT" })
    expect(sub.tag).toBe("submitting")
    expect(closeTicketReducer(sub, { type: "SUCCESS" }).tag).toBe("done")
  })
  it("cannot be cancelled while the request is in flight", () => {
    const sub = closeTicketReducer(editing("ok"), { type: "SUBMIT" })
    expect(closeTicketReducer(sub, { type: "CANCEL" })).toBe(sub)
  })
  it("retries with the same idempotency key after a failure", () => {
    const sub = closeTicketReducer(editing("ok"), { type: "SUBMIT" })
    const err = closeTicketReducer(sub, { type: "FAILURE", kind: "network", message: "x" })
    const retry = closeTicketReducer(err, { type: "SUBMIT" })
    expect(retry).toMatchObject({ tag: "submitting", key: "k" })
  })
})

describe("closing-date machine", () => {
  it("routes a 409 to conflict and other failures to error", () => {
    const saving = { tag: "saving", value: null } as const
    expect(closingDateReducer(saving, { type: "FAILURE", kind: "conflict", message: "m" }).tag).toBe("conflict")
    expect(closingDateReducer(saving, { type: "FAILURE", kind: "server", message: "m" }).tag).toBe("error")
  })
  it("returns to viewing after the operator reloads", () => {
    expect(closingDateReducer({ tag: "conflict", value: null, message: "m" }, { type: "RELOADED" }).tag).toBe("viewing")
  })
})

describe("connection machine", () => {
  it("snapshots on every open and goes live only after the snapshot", () => {
    let s = connectionReducer("idle", { type: "SUBSCRIBE" })
    s = connectionReducer(s, { type: "OPEN" })
    expect(s).toBe("syncing")
    expect(connectionReducer(s, { type: "SNAPSHOT_OK" })).toBe("live")
  })
  it("re-syncs after a drop and reopen", () => {
    const live = connectionReducer(connectionReducer(connectionReducer("idle", { type: "SUBSCRIBE" }), { type: "OPEN" }), { type: "SNAPSHOT_OK" })
    const dropped = connectionReducer(live, { type: "DROPPED" })
    expect(dropped).toBe("reconnecting")
    expect(connectionReducer(dropped, { type: "OPEN" })).toBe("syncing")
  })
})

describe("run button", () => {
  const run = (status: string) => ({ runId: "r1", status })
  it("derives scanning from backend run state, not local memory", () => {
    expect(deriveRunButton("ready", { tag: "idle" }, run("running")).tag).toBe("running")
  })
  it("is offline-aware", () => {
    expect(deriveRunButton("offline", { tag: "idle" }, null).tag).toBe("offline")
  })
  it("reuses the key only after a network failure", () => {
    const failedNet = { tag: "failed", key: "old", kind: "network", message: "m" } as const
    const failedVal = { tag: "failed", key: "old", kind: "validation", message: "m" } as const
    expect(runRequestReducer(failedNet, { type: "START", key: "new" })).toMatchObject({ key: "old" })
    expect(runRequestReducer(failedVal, { type: "START", key: "new" })).toMatchObject({ key: "new" })
  })
})
