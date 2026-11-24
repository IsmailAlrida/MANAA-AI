import { serve } from "@hono/node-server"
import {
  createApp,
  createBus,
  createFixtureAdapter,
  createRunner,
  openSqliteStore,
} from "demo-api"
import { config } from "./config.ts"

// Swap this one line for a real agent adapter; nothing else changes.
const adapter = createFixtureAdapter(config.fixturesDir)

const { plan, sources } = await adapter.loadPlan()
const store = openSqliteStore(config.dbPath)
const bus = createBus((err) => console.error("[bus] listener failed", err))
const runner = createRunner({ store, bus, plan, stepMs: config.stepMs })
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
      `[api] http://${info.address}:${info.port}/api/v1 · adapter ${adapter.name} · db ${config.dbPath}`
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
