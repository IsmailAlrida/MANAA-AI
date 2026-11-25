import { resolve } from "node:path"

const PACKAGE_ROOT = resolve(import.meta.dirname, "..")
const REPO_ROOT = resolve(PACKAGE_ROOT, "../..")

function int(name: string, fallback: number, min: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw === "") return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < min)
    throw new Error(`${name} must be an integer ≥ ${min}`)
  return value
}

export const config = {
  host: process.env.API_HOST || "127.0.0.1",
  port: int("API_PORT", 4787, 1),
  /** Durable workspace. Delete the directory to start over. PostgreSQL is the planned production store. */
  dbPath: process.env.API_DB_PATH || resolve(PACKAGE_ROOT, ".data/api.sqlite"),
  /** Stub adapter input; a real agent adapter replaces this. */
  fixturesDir:
    process.env.API_FIXTURES_DIR ||
    resolve(REPO_ROOT, "demo/fixtures/generated"),
  stepMs: int("API_STEP_MS", 1500, 0),
  /** POST /api/v1/demo/reset is a demo-only route; off for the real backend. */
  demoReset: process.env.API_DEMO_RESET === "on",
  mode:
    process.env.MANAA_MODE === "engine"
      ? ("engine" as const)
      : ("fixtures" as const),
  guestExecPath:
    process.env.MANAA_GUEST_EXEC_PATH ||
    resolve(REPO_ROOT, "infra/guest-exec.sh"),
  resultsUrl:
    process.env.MANAA_RESULTS_HTTP_URL || "http://10.77.20.1:8083/v1/results",
  corsOrigin: process.env.API_CORS_ORIGIN || undefined,
}
