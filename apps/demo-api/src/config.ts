import { resolve } from "node:path"

const PACKAGE_ROOT = resolve(import.meta.dirname, "..")
const REPO_ROOT = resolve(PACKAGE_ROOT, "../..")

export interface Config {
  host: string
  port: number
  dbPath: string
  fixturesDir: string
  stepMs: number
  demoControls: boolean
  mode: "fixtures" | "engine"
  guestExecPath: string
  resultsUrl: string
  corsOrigin: string | undefined
}

function int(name: string, fallback: number, min: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw === "") return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < min)
    throw new Error(`${name} must be an integer ≥ ${min}`)
  return value
}

export function loadConfig(): Config {
  return {
    host: process.env.DEMO_API_HOST || "127.0.0.1",
    port: int("DEMO_API_PORT", 4787, 1),
    // The demo backend never persists: every start is a clean slate.
    dbPath: ":memory:",
    fixturesDir:
      process.env.DEMO_FIXTURES_DIR ||
      resolve(REPO_ROOT, "demo/fixtures/generated"),
    stepMs: int("DEMO_STEP_MS", 1500, 0),
    demoControls: process.env.DEMO_CONTROLS !== "off",
    mode: process.env.MANAA_MODE === "engine" ? "engine" : "fixtures",
    guestExecPath:
      process.env.MANAA_GUEST_EXEC_PATH ||
      resolve(REPO_ROOT, "infra/guest-exec.sh"),
    resultsUrl:
      process.env.MANAA_RESULTS_HTTP_URL || "http://10.77.20.1:8083/v1/results",
    corsOrigin: process.env.DEMO_CORS_ORIGIN || undefined,
  }
}
