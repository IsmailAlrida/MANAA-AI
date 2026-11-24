import { resolve } from "node:path"
import { createBus } from "../src/bus.ts"
import { loadFixtures } from "../src/fixtures/load.ts"
import { buildRevealPlan } from "../src/fixtures/plan.ts"
import { createApp } from "../src/http/app.ts"
import { createRunner } from "../src/runner.ts"
import { openSqliteStore } from "../src/store/sqlite.ts"

export const FIXTURES_DIR = resolve(
  import.meta.dirname,
  "../../../demo/fixtures/generated"
)
export const fixtures = loadFixtures(FIXTURES_DIR)
export const plan = buildRevealPlan(fixtures)

/** App over a store with manual stepping (no timers). */
export function harness(dbPath = ":memory:") {
  const store = openSqliteStore(dbPath)
  const bus = createBus()
  let n = 0
  const runner = createRunner({
    store,
    bus,
    plan,
    stepMs: 0,
    autoSchedule: false,
    newRunId: () => `run_test_${++n}`,
  })
  const app = createApp({
    store,
    runner,
    bus,
    workspaceId: plan.workspaceId,
    sources: fixtures.sources,
    demoControls: true,
    heartbeatMs: 60_000,
  })
  const call = (path: string, init?: RequestInit) =>
    app.request(`/api/v1${path}`, init)
  const json = (
    method: string,
    body: unknown,
    headers: Record<string, string> = {}
  ): RequestInit => ({
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...headers },
  })
  async function runToCompletion(runId: string) {
    for (let i = 0; i < plan.steps.length + 1; i++) await runner.step(runId)
  }
  return { store, bus, runner, app, call, json, runToCompletion }
}
