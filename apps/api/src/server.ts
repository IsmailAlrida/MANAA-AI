import { serve } from "@hono/node-server"
import {
  createApp,
  createBus,
  createEngineAdapter,
  createFixtureAdapter,
  createRunner,
  openSqliteStore,
} from "demo-api"
import { config } from "./config.ts"

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
  demoControls: config.demoReset,
  corsOrigin: config.corsOrigin,
})

await runner.resumeRunning()

const server = serve(
  { fetch: app.fetch, hostname: config.host, port: config.port },
  (info) => {
    console.log(
      `[api] http://${info.address}:${info.port}/api/v1 · adapter ${engineAdapter?.name ?? fixtureAdapter?.name} · db ${config.dbPath}`
    )
  }
)

let shuttingDown = false
async function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[api] ${signal}: shutting down`)
  runner.stopAll()
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
