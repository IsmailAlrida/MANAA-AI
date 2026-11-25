import assert from "node:assert/strict"
import { test } from "node:test"
import { createBus } from "../src/bus.ts"
import { createEngineAdapter } from "../src/engine-adapter.ts"
import { createApp } from "../src/http/app.ts"
import { createRunner } from "../src/runner.ts"
import { openSqliteStore } from "../src/store/sqlite.ts"

const findingId = "finding-run_engine_1"
const result: Record<string, any> = {
  finding_summary: "Controlled synthetic review; human assessment is required.",
  candidate_dispositions: [
    {
      host: "www.dubaipolice.gov.ae",
      disposition: "protected",
      status: "excluded",
      evidence_id: "ev-protected",
      source_ref: "fixture://controlled-case.json#protected",
      reason:
        "Matches protected catalogue entry; excluded from candidate assessment.",
    },
    {
      host: "www.dubaipolice-gov.ae",
      disposition: "near_match",
      status: "review_required",
      evidence_id: "ev-near",
      source_ref: "fixture://controlled-case.json#near-match",
      reason:
        "Saved fixture describes a near-match payment claim; attribution and intent remain unverified.",
    },
    {
      host: "dxb-police-check.ae",
      disposition: "unresolved",
      status: "insufficient_evidence",
      evidence_id: "ev-unresolved",
      source_ref: "fixture://controlled-case.json#unresolved",
      reason: "No inspectable capture or independent source is available.",
    },
  ],
  cited_source_observations: [
    {
      evidence_id: "ev-protected",
      source_ref: "fixture://controlled-case.json#protected",
      observed_at: "2026-11-24T10:05:00Z",
      claim: "Exact protected reference host",
      source_name: "Dubai Police official reference",
      source_name_ar: "شرطة دبي",
    },
    {
      evidence_id: "ev-near",
      source_ref: "fixture://controlled-case.json#near-match",
      observed_at: "2026-11-24T10:05:00Z",
      claim: "Synthetic payment prompt",
      source_name: "Dubai Police official reference",
      source_name_ar: "شرطة دبي",
    },
    {
      evidence_id: "ev-unresolved",
      source_ref: "fixture://controlled-case.json#unresolved",
      observed_at: "2026-11-24T10:05:00Z",
      claim: "No saved capture",
      source_name: "Dubai Police official reference",
      source_name_ar: "شرطة دبي",
    },
  ],
  source_names: { en: "Dubai Police official reference", ar: "شرطة دبي" },
  uncertainties: ["Synthetic controlled data only."],
  provenance: {
    fixture_only: true,
    method: "OpenCode bounded controlled-case review",
  },
  model_review: {
    status: "completed",
    model: "local-model",
    review_only: true,
    assessment:
      "The near-match is reviewable but attribution remains unresolved.",
    uncertainties: ["No live domain evidence was collected."],
  },
}
result.artifacts = [
  {
    id: 1,
    kind: "controlled_case_result",
    source_ref: "fixture://controlled-case.json#official-reference",
    captured_at: "2026-11-24T10:05:00Z",
    media_type: "application/json",
    payload: {
      cited_source_observations: result.cited_source_observations,
      source_names: result.source_names,
      candidate_dispositions: result.candidate_dispositions,
    },
  },
]

function testStack(
  fetcher: typeof fetch,
  runGuest: (layer: "osint" | "police", id: string) => Promise<void>
) {
  const adapter = createEngineAdapter({
    guestExecPath: "/unused-in-test",
    resultsUrl: "http://results.test/v1/results",
    fetch: fetcher,
    runGuest,
  })
  const store = openSqliteStore(":memory:")
  const bus = createBus()
  const runner = createRunner({
    store,
    bus,
    plan: { workspaceId: "workspace-controlled-case", steps: [] },
    prepareRun: adapter.prepareRun,
    stepMs: 0,
    autoSchedule: false,
    newRunId: () => "run_engine_1",
  })
  const app = createApp({
    store,
    runner,
    bus,
    workspaceId: "workspace-controlled-case",
    sources: adapter.sources,
    demoControls: true,
  })
  return {
    adapter,
    runner,
    store,
    async call(path: string, body: unknown = {}) {
      return app.request(`/api/v1${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "engine-test-1",
        },
        body: JSON.stringify(body),
      })
    },
    async snapshot(path: string) {
      return app.request(`/api/v1${path}`)
    },
  }
}

test("engine run bridges one bounded OSINT/police replay into bilingual ticket and graph DTOs", async () => {
  const guestCalls: string[] = []
  const fetchUrls: string[] = []
  const h = testStack(
    async (input) => {
      fetchUrls.push(String(input))
      return Response.json({
        run_id: "transfer-run",
        finding_id: findingId,
        status: "completed",
        completed_at: "2026-11-24T10:10:00Z",
        result,
      })
    },
    async (layer, id) => {
      guestCalls.push(`${layer}:${id}`)
    }
  )
  const started = await h.call("/runs")
  assert.equal(started.status, 202)
  const run = (await started.json()) as {
    runId: string
    status: string
    progress: { total: number }
  }
  assert.equal(run.status, "running")
  assert.equal(run.progress.total, 1)
  assert.deepEqual(guestCalls, ["osint:run_engine_1", "police:run_engine_1"])
  assert.deepEqual(fetchUrls, [
    "http://results.test/v1/results/finding-run_engine_1",
  ])

  await h.runner.step(run.runId)
  const snapshotResponse = await h.snapshot(`/runs/${run.runId}/snapshot`)
  const snapshot = (await snapshotResponse.json()) as any
  assert.equal(snapshot.run.status, "complete")
  assert.equal(snapshot.tickets.length, 1)
  const ticket = snapshot.tickets[0]
  assert.equal(ticket.contentVariants.en.title, "Controlled UAE brand review")
  assert.equal(
    ticket.contentVariants.ar.title,
    "مراجعة العلامة التجارية المطابقة في الإمارات"
  )
  assert.equal(ticket.modelReview.assessment, result.model_review.assessment)
  assert.deepEqual(ticket.evidenceIds, [
    "ev-protected",
    "ev-near",
    "ev-unresolved",
  ])
  for (const evidenceId of ticket.evidenceIds) {
    assert.match(
      ticket.reportMarkdown,
      new RegExp(`/api/v1/assets/${evidenceId}`)
    )
    const asset = await h.snapshot(`/assets/${evidenceId}`)
    assert.equal(asset.status, 200)
    assert.match(
      await asset.text(),
      new RegExp(`"evidence_id": "${evidenceId}"`)
    )
  }
  assert.equal(snapshot.entities.length, 4)
  assert.equal(
    snapshot.entities
      .find((e: any) => e.id === "ENT-CTRL-ORG-OFFICIAL")
      .nameVariants.find((v: any) => v.languageTag === "ar").value,
    "شرطة دبي"
  )
  assert.equal(snapshot.relationships.length, 1)
  assert.equal(snapshot.relationships[0].support, "possible")

  // A key retry returns its original run and does not trigger either VM again.
  const retry = await h.call("/runs")
  assert.equal(retry.status, 200)
  assert.deepEqual(guestCalls, ["osint:run_engine_1", "police:run_engine_1"])
  await h.store.close()
})

test("engine mode rejects requests outside the controlled case without fixture replay", async () => {
  const guestCalls: string[] = []
  const h = testStack(
    async () => {
      throw new Error("must not fetch a result")
    },
    async (layer, id) => {
      guestCalls.push(`${layer}:${id}`)
    }
  )
  const response = await h.call("/runs", {
    requestText: "scan unrelated private target",
  })
  assert.equal(response.status, 422)
  assert.deepEqual(guestCalls, [])
  const snap = await h.snapshot("/workspace")
  const state = (await snap.json()) as any
  assert.equal(state.entities.length, 0)
  assert.equal(state.tickets.length, 0)
  assert.equal(state.run.status, "failed")
  await h.store.close()
})

test("a paused engine run rebuilds its plan after runner restart before resuming", async () => {
  const guestCalls: string[] = []
  const h = testStack(
    async () =>
      Response.json({
        run_id: "transfer-run",
        finding_id: findingId,
        status: "completed",
        completed_at: "2026-11-24T10:10:00Z",
        result,
      }),
    async (layer, id) => {
      guestCalls.push(`${layer}:${id}`)
    }
  )
  const started = await h.call("/runs")
  const run = (await started.json()) as { runId: string }
  await h.runner.pause(run.runId)

  // A new runner has no process-local plan cache; resume must reissue the
  // idempotent guest actions and fetch the exact same persisted result.
  const adapter = h.adapter
  const restartedRunner = createRunner({
    store: h.store,
    bus: createBus(),
    plan: { workspaceId: "workspace-controlled-case", steps: [] },
    prepareRun: adapter.prepareRun,
    stepMs: 0,
    autoSchedule: false,
  })
  assert.equal((await restartedRunner.resume(run.runId))?.status, "running")
  await restartedRunner.step(run.runId)
  assert.equal(
    ((await h.snapshot("/workspace").then((r) => r.json())) as any).run.status,
    "complete"
  )
  assert.deepEqual(guestCalls, [
    "osint:run_engine_1",
    "police:run_engine_1",
    "osint:run_engine_1",
    "police:run_engine_1",
  ])
  await h.store.close()
})
