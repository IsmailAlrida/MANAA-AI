import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { fixtures, harness, plan } from "./harness.ts"

type Json = Record<string, any>

async function body(res: Response): Promise<Json> {
  return (await res.json()) as Json
}

async function startRun(h: ReturnType<typeof harness>, key = "key-1") {
  const res = await h.call(
    "/runs",
    h.json("POST", {}, { "Idempotency-Key": key })
  )
  return { res, run: await body(res) }
}

test("a new workspace is empty", async () => {
  const h = harness()
  const snap = await body(await h.call("/workspace"))
  assert.deepEqual(
    {
      entities: snap.entities,
      relationships: snap.relationships,
      tickets: snap.tickets,
      run: snap.run,
    },
    { entities: [], relationships: [], tickets: [], run: null }
  )
  assert.equal(snap.workspaceId, fixtures.workspaceId)
})

test("run creation is idempotent and one scenario runs per workspace", async () => {
  const h = harness()
  const first = await startRun(h)
  assert.equal(first.res.status, 202)
  assert.equal(first.run.status, "running")
  assert.deepEqual(first.run.progress, {
    completed: 0,
    total: plan.steps.length,
  })

  const retry = await startRun(h)
  assert.equal(retry.res.status, 200)
  assert.equal(retry.run.runId, first.run.runId)

  const other = await startRun(h, "key-2")
  assert.equal(other.run.runId, first.run.runId)
})

test("pause and resume preserve the reveal cursor and publish run state", async () => {
  const h = harness()
  const { run } = await startRun(h)
  await h.runner.step(run.runId)

  const paused = await h.call("/monitor/pause", h.json("POST", {}))
  assert.equal(paused.status, 200)
  assert.equal((await body(paused)).status, "paused")
  assert.equal((await body(await h.call("/workspace"))).run.progress.completed, 1)
  const retryWhilePaused = await startRun(h, "key-while-paused")
  assert.equal(retryWhilePaused.run.runId, run.runId)
  assert.equal(retryWhilePaused.run.status, "paused")

  // A paused run cannot be advanced by the normal runner step path.
  await h.runner.step(run.runId)
  assert.equal((await body(await h.call("/workspace"))).run.progress.completed, 1)

  const resumed = await h.call("/monitor/resume", h.json("POST", {}))
  assert.equal(resumed.status, 200)
  assert.equal((await body(resumed)).status, "running")
  await h.runToCompletion(run.runId)
  assert.equal((await body(await h.call("/workspace"))).run.status, "complete")

  const completePause = await h.call("/monitor/pause", h.json("POST", {}))
  assert.equal((await body(completePause)).status, "complete")
})

test("the reveal reaches the full fixture workspace with monotonic revisions", async () => {
  const h = harness()
  const { run } = await startRun(h)
  const seen = new Map<string, number>()
  const order: string[] = []
  h.bus.subscribe((e) => {
    order.push(e.type)
    const p = e.payload as { revision?: number; data?: { id: string } }
    if (p.data) {
      const prev = seen.get(p.data.id) ?? 0
      assert.ok(
        p.revision! > prev,
        `${p.data.id} revision went ${prev} → ${p.revision}`
      )
      seen.set(p.data.id, p.revision!)
    }
  })

  // Mid-run the first ticket is visible but its report is not yet published.
  await h.runner.step(run.runId)
  const early = await body(await h.call(`/runs/${run.runId}/snapshot`))
  assert.equal(early.tickets.length, 1)
  assert.notEqual(
    early.tickets[0].reportMarkdown,
    fixtures.tickets.find((t) => t.id === early.tickets[0].id)!.reportMarkdown
  )
  assert.equal(early.run.progress.completed, 1)

  await h.runToCompletion(run.runId)
  const snap = await body(await h.call(`/runs/${run.runId}/snapshot`))
  assert.equal(snap.run.status, "complete")
  assert.deepEqual(
    snap.entities.map((e: Json) => e.id).sort(),
    fixtures.entities.map((e) => e.id).sort()
  )
  assert.deepEqual(
    snap.relationships.map((r: Json) => r.id).sort(),
    fixtures.relationships.map((r) => r.id).sort()
  )
  assert.deepEqual(
    snap.tickets.map((t: Json) => t.id).sort(),
    fixtures.tickets.map((t) => t.id).sort()
  )
  for (const t of snap.tickets) {
    const fixture = fixtures.tickets.find((f) => f.id === t.id)!
    assert.equal(t.status, "open")
    assert.equal(t.reportMarkdown, fixture.reportMarkdown)
    assert.match(t.closingDate, /T23:59:59\+04:00$/)
    assert.ok(t.history.some((h: Json) => h.kind === "report_published"))
    assert.ok(t.revision >= 1)
  }
  assert.equal(order.at(-1), "run.status")

  // Extra steps after completion are no-ops.
  const before = JSON.stringify(snap.tickets)
  await h.runner.step(run.runId)
  assert.equal(
    JSON.stringify((await body(await h.call("/workspace"))).tickets),
    before
  )
})

test("closing date edits use If-Match and reject stale revisions", async () => {
  const h = harness()
  const { run } = await startRun(h)
  await h.runToCompletion(run.runId)
  const ticket = (await body(await h.call("/workspace"))).tickets[0]
  const path = `/tickets/${ticket.id}`

  assert.equal(
    (
      await h.call(
        path,
        h.json("PATCH", { closingDate: "2026-12-01T12:00:00Z" })
      )
    ).status,
    428
  )

  const bad = await h.call(
    path,
    h.json(
      "PATCH",
      { closingDate: "tomorrow" },
      { "If-Match": `"${ticket.revision}"` }
    )
  )
  assert.equal(bad.status, 422)
  assert.ok((await body(bad)).error.fieldErrors.closingDate)

  const ok = await h.call(
    path,
    h.json(
      "PATCH",
      { closingDate: "2026-12-01T12:00:00Z" },
      { "If-Match": `"${ticket.revision}"` }
    )
  )
  assert.equal(ok.status, 200)
  const updated = await body(ok)
  assert.equal(updated.revision, ticket.revision + 1)
  assert.equal(updated.closingDate, "2026-12-01T12:00:00Z")
  assert.equal(updated.history.at(-1).kind, "closing_date_changed")

  const stale = await h.call(
    path,
    h.json(
      "PATCH",
      { closingDate: null },
      { "If-Match": `"${ticket.revision}"` }
    )
  )
  assert.equal(stale.status, 409)
  const err = (await body(stale)).error
  assert.equal(err.currentRevision, updated.revision)
  assert.ok(err.requestId)

  assert.equal(
    (
      await h.call(
        "/tickets/NOPE",
        h.json("PATCH", { closingDate: null }, { "If-Match": '"1"' })
      )
    ).status,
    404
  )
})

test("operator closing date survives later scan updates", async () => {
  const h = harness()
  const { run } = await startRun(h)
  await h.runner.step(run.runId)
  const ticket = (await body(await h.call("/workspace"))).tickets[0]
  await h.call(
    `/tickets/${ticket.id}`,
    h.json(
      "PATCH",
      { closingDate: "2026-12-05T09:00:00+04:00" },
      { "If-Match": `"${ticket.revision}"` }
    )
  )
  await h.runToCompletion(run.runId)
  const final = (await body(await h.call("/workspace"))).tickets.find(
    (t: Json) => t.id === ticket.id
  )
  assert.equal(final.closingDate, "2026-12-05T09:00:00+04:00")
  assert.equal(
    final.reportMarkdown,
    fixtures.tickets.find((t) => t.id === ticket.id)!.reportMarkdown
  )
})

test("closing requires a write-up, archives the ticket, and is idempotent by key", async () => {
  const h = harness()
  const { run } = await startRun(h)
  await h.runToCompletion(run.runId)
  const ticket = (await body(await h.call("/workspace"))).tickets[0]
  const path = `/tickets/${ticket.id}/close`

  const missing = await h.call(path, h.json("POST", { finalWriteup: "   " }))
  assert.equal(missing.status, 422)
  assert.equal((await body(missing)).error.fieldErrors.finalWriteup, "Required")

  const closed = await h.call(
    path,
    h.json(
      "POST",
      { finalWriteup: "Takedown reference REF-TEST-01." },
      { "Idempotency-Key": "close-1" }
    )
  )
  assert.equal(closed.status, 200)
  const archived = await body(closed)
  assert.equal(archived.status, "closed")
  assert.equal(archived.finalWriteup, "Takedown reference REF-TEST-01.")
  assert.equal(archived.history.at(-1).kind, "closed")

  const replay = await h.call(
    path,
    h.json(
      "POST",
      { finalWriteup: "Takedown reference REF-TEST-01." },
      { "Idempotency-Key": "close-1" }
    )
  )
  assert.equal(replay.status, 200)
  assert.equal((await body(replay)).revision, archived.revision)

  assert.equal(
    (
      await h.call(
        path,
        h.json(
          "POST",
          { finalWriteup: "again" },
          { "Idempotency-Key": "close-2" }
        )
      )
    ).status,
    409
  )

  const snap = await body(await h.call("/workspace"))
  assert.equal(
    snap.tickets.find((t: Json) => t.id === ticket.id).status,
    "closed"
  )
})

test("assets resolve only after their evidence is published", async () => {
  const h = harness()
  const evidenceId = fixtures.revealOrder[0]!
  assert.equal((await h.call(`/assets/${evidenceId}`)).status, 404)
  const { run } = await startRun(h)
  await h.runner.step(run.runId)
  const res = await h.call(`/assets/${evidenceId}`)
  assert.equal(res.status, 200)
  assert.match(res.headers.get("content-type")!, /text\/markdown/)
  assert.equal(res.headers.get("x-content-type-options"), "nosniff")
  assert.equal(await res.text(), fixtures.sources.get(evidenceId))
  assert.equal(
    (await h.call(`/assets/${fixtures.revealOrder.at(-1)}`)).status,
    404
  )
  assert.equal((await h.call(`/assets/..%2Fworkspace.json`)).status, 404)
})

test("SSE stream sends run status on open, then live upserts", async () => {
  const h = harness()
  const { run } = await startRun(h)
  assert.equal((await h.call("/runs/run_missing/events")).status, 404)

  const res = await h.call(`/runs/${run.runId}/events`)
  assert.equal(res.status, 200)
  assert.match(res.headers.get("content-type")!, /text\/event-stream/)
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let text = ""
  const readUntil = async (needle: string) => {
    while (!text.includes(needle)) {
      const { value, done } = await reader.read()
      if (done) throw new Error(`stream ended before ${needle}`)
      text += decoder.decode(value, { stream: true })
    }
  }

  await readUntil("event: run.status")
  await h.runner.step(run.runId)
  await readUntil("event: ticket.upsert")
  assert.ok(
    text.indexOf("event: graph.entity.upsert") <
      text.indexOf("event: ticket.upsert")
  )
  const ticketFrame = text
    .split("\n\n")
    .find((f) => f.includes("event: ticket.upsert"))!
  const payload = JSON.parse(
    ticketFrame
      .split("\n")
      .find((l) => l.startsWith("data: "))!
      .slice(6)
  )
  assert.equal(payload.revision, 1)
  assert.equal(payload.data.revision, 1)
  await reader.cancel()
})

test("demo reset returns an empty workspace and allows a fresh run", async () => {
  const h = harness()
  const { run } = await startRun(h)
  await h.runToCompletion(run.runId)
  const reset = await body(await h.call("/demo/reset", { method: "POST" }))
  assert.equal(
    reset.tickets.length + reset.entities.length + reset.relationships.length,
    0
  )
  assert.equal(reset.run, null)
  const again = await startRun(h, "key-1")
  assert.equal(again.res.status, 202)
  assert.notEqual(again.run.runId, run.runId)
})

test("errors use the contract envelope", async () => {
  const h = harness()
  const res = await h.call("/runs", {
    method: "POST",
    body: "{not json",
    headers: { "Content-Type": "application/json" },
  })
  assert.equal(res.status, 400)
  const { error } = await body(res)
  assert.equal(error.code, "malformed_request")
  assert.match(error.requestId, /^req_/)
  assert.equal((await h.call("/nope")).status, 404)
})

test("workspace and in-progress runs survive a process restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "manaa-demo-"))
  const dbPath = join(dir, "demo.sqlite")
  try {
    const a = harness(dbPath)
    const { run } = await startRun(a)
    await a.runner.step(run.runId)
    await a.runner.step(run.runId)
    await a.store.close()

    const b = harness(dbPath)
    const resumed = await body(await b.call("/workspace"))
    assert.equal(resumed.run.runId, run.runId)
    assert.equal(resumed.run.progress.completed, 2)
    await b.runToCompletion(run.runId)
    const done = await body(await b.call("/workspace"))
    assert.equal(done.run.status, "complete")
    assert.equal(done.tickets.length, fixtures.tickets.length)
    await b.store.close()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
