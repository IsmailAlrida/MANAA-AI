import { serve } from "@hono/node-server"
import { createBus } from "./bus.ts"
import { loadConfig } from "./config.ts"
import { createFixtureAdapter } from "./adapter.ts"
import { createEngineAdapter } from "./engine-adapter.ts"
import { createApp } from "./http/app.ts"
import { createRunner } from "./runner.ts"
import { openSqliteStore } from "./store/sqlite.ts"

const config = loadConfig()
const fixtureAdapter =
  config.mode === "fixtures" ? createFixtureAdapter(config.fixturesDir) : null
const engineAdapter =
  config.mode === "engine"
    ? createEngineAdapter({
        guestExecPath: config.guestExecPath,
        resultsUrl: config.resultsUrl,
      })
    : null
const { plan, sources } = fixtureAdapter
  ? await fixtureAdapter.loadPlan()
  : {
      plan: { workspaceId: "workspace-controlled-case", steps: [] },
      sources: engineAdapter!.sources,
    }
const store = openSqliteStore(config.dbPath)
const bus = createBus((err) => console.error("[bus] listener failed", err))
const runner = createRunner({
  store,
  bus,
  plan,
  stepMs: config.stepMs,
  ...(engineAdapter ? { prepareRun: engineAdapter.prepareRun } : {}),
})
const app = createApp({
  store,
  runner,
  bus,
  workspaceId: plan.workspaceId,
  sources,
  demoControls: config.demoControls,
  corsOrigin: config.corsOrigin,
})

await runner.resumeRunning()

const server = serve(
  { fetch: app.fetch, hostname: config.host, port: config.port },
  (info) => {
    console.log(
      `[demo-api] in-memory · http://${info.address}:${info.port}/api/v1 · ${config.mode === "engine" ? "controlled engine" : `${plan.steps.length} fixture reveal steps`} · ${config.stepMs} ms`
    )
  }
)

let shuttingDown = false
async function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[demo-api] ${signal}: shutting down`)
  runner.stopAll()
  // Open SSE streams never end on their own; don't wait on them forever.
  const force = setTimeout(() => process.exit(0), 3000)
  force.unref()
  server.close(async () => {
    await store.close()
    process.exit(0)
  })
  if ("closeAllConnections" in server) server.closeAllConnections()
}
process.on("SIGINT", () => void shutdown("SIGINT"))
process.on("SIGTERM", () => void shutdown("SIGTERM"))
