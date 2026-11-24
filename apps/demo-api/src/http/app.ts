/**
 * v1 HTTP surface (docs/FRONTEND-BACKEND-CONTRACT.md): REST snapshots and
 * operator mutations plus one SSE stream per run. Handlers never touch
 * fixtures or timing directly — the runner owns progression.
 */
import { Hono, type Context } from "hono"
import { cors } from "hono/cors"
import { requestId, type RequestIdVariables } from "hono/request-id"
import { streamSSE } from "hono/streaming"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import type { Bus } from "../bus.ts"
import {
  FINAL_WRITEUP_MAX,
  applyClose,
  applyClosingDate,
  isRfc3339,
} from "../domain/ticket.ts"
import {
  DomainError,
  SSE_EVENT,
  runStatusDto,
  stringArray,
  upsertDto,
  type RunRecord,
} from "../domain/types.ts"
import type { Runner } from "../runner.ts"
import type { MutateResult, Store } from "../store/store.ts"

export interface AppDeps {
  store: Store
  runner: Runner
  bus: Bus
  workspaceId: string
  /** Evidence ID → static source card served by the asset route. */
  sources: Map<string, string>
  demoControls: boolean
  corsOrigin?: string | undefined
  heartbeatMs?: number
  now?: () => Date
}

type Env = { Variables: RequestIdVariables }

const MAX_REQUEST_TEXT = 2000
const MAX_KEY_LENGTH = 200

function fail(c: Context<Env>, err: DomainError) {
  return c.json(
    {
      error: {
        code: err.code,
        message: err.message,
        ...(err.fieldErrors ? { fieldErrors: err.fieldErrors } : {}),
        ...(err.currentRevision !== undefined
          ? { currentRevision: err.currentRevision }
          : {}),
        requestId: c.get("requestId"),
      },
    },
    err.status as ContentfulStatusCode
  )
}

async function readJsonObject(
  c: Context<Env>
): Promise<Record<string, unknown>> {
  const text = await c.req.text()
  if (text.trim() === "") return {}
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    throw new DomainError(
      400,
      "malformed_request",
      "Request body is not valid JSON."
    )
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new DomainError(
      400,
      "malformed_request",
      "Request body must be a JSON object."
    )
  }
  return body as Record<string, unknown>
}

function idempotencyKey(c: Context<Env>): string | null {
  const key = c.req.header("Idempotency-Key")?.trim()
  if (!key) return null
  if (key.length > MAX_KEY_LENGTH || !/^[\x21-\x7e]+$/.test(key)) {
    throw new DomainError(
      400,
      "invalid_idempotency_key",
      "Idempotency-Key must be 1–200 visible ASCII characters."
    )
  }
  return key
}

/** Accepts `"7"`, `W/"7"`, or `7`. */
function parseIfMatch(header: string | undefined): number | null {
  const match = header?.trim().match(/^(?:W\/)?"?(\d+)"?$/)
  return match ? Number(match[1]) : null
}

function unwrap(result: MutateResult, ticketId: string) {
  if (result.status === "not_found")
    throw new DomainError(404, "not_found", `Unknown ticket ${ticketId}.`)
  if (result.status === "conflict") {
    throw new DomainError(
      409,
      "stale_revision",
      "The ticket changed since it was loaded. Reload and try again.",
      {
        currentRevision: result.currentRevision,
      }
    )
  }
  return result
}

export function createApp(deps: AppDeps) {
  const { store, runner, bus, workspaceId, sources } = deps
  const now = deps.now ?? (() => new Date())
  const heartbeatMs = deps.heartbeatMs ?? 15_000

  const app = new Hono<Env>()
  app.use(
    "*",
    requestId({
      generator: () => `req_${crypto.randomUUID().replaceAll("-", "")}`,
    })
  )
  if (deps.corsOrigin) {
    app.use(
      "/api/*",
      cors({
        origin: deps.corsOrigin,
        allowHeaders: ["Content-Type", "If-Match", "Idempotency-Key"],
        allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
        exposeHeaders: ["ETag", "X-Request-Id"],
      })
    )
  }

  app.onError((err, c) => {
    if (err instanceof DomainError) return fail(c, err)
    console.error(
      `[api] ${c.req.method} ${c.req.path} ${c.get("requestId")}`,
      err
    )
    return fail(
      c,
      new DomainError(
        500,
        "internal_error",
        "The investigation service failed to handle this request."
      )
    )
  })
  app.notFound((c) =>
    fail(c, new DomainError(404, "not_found", "Unknown route."))
  )

  app.get("/healthz", (c) => c.json({ ok: true }))

  const api = new Hono<Env>()

  async function snapshot(run: RunRecord | null) {
    const rows = await store.readWorkspace()
    return { workspaceId, ...rows, run: run ? runStatusDto(run) : null }
  }

  async function requireRun(runId: string) {
    const run = await store.getRun(runId)
    if (!run) throw new DomainError(404, "not_found", `Unknown run ${runId}.`)
    return run
  }

  api.get("/workspace", async (c) =>
    c.json(await snapshot(await store.latestRun()))
  )

  api.post("/runs", async (c) => {
    const key = idempotencyKey(c)
    const body = await readJsonObject(c)
    const requestText = body.requestText
    if (requestText !== undefined && requestText !== null) {
      if (
        typeof requestText !== "string" ||
        requestText.length > MAX_REQUEST_TEXT
      ) {
        throw new DomainError(422, "validation_error", "Invalid run request.", {
          fieldErrors: {
            requestText: `Must be text of at most ${MAX_REQUEST_TEXT} characters.`,
          },
        })
      }
    }
    const text =
      typeof requestText === "string" && requestText.trim()
        ? requestText.trim()
        : null
    const { run, created } = await runner.start({
      idempotencyKey: key,
      requestText: text,
    })
    return c.json(runStatusDto(run), created ? 202 : 200)
  })

  api.get("/runs/:runId/snapshot", async (c) =>
    c.json(await snapshot(await requireRun(c.req.param("runId"))))
  )

  api.post("/monitor/pause", async (c) => {
    const run = await store.latestRun()
    if (!run)
      throw new DomainError(409, "no_active_run", "There is no active scenario to pause.")
    const updated = await runner.pause(run.runId)
    if (!updated)
      throw new DomainError(404, "not_found", `Unknown run ${run.runId}.`)
    return c.json(runStatusDto(updated))
  })

  api.post("/monitor/resume", async (c) => {
    const run = await store.latestRun()
    if (!run)
      throw new DomainError(409, "no_active_run", "There is no paused scenario to resume.")
    const updated = await runner.resume(run.runId)
    if (!updated)
      throw new DomainError(404, "not_found", `Unknown run ${run.runId}.`)
    return c.json(runStatusDto(updated))
  })

  api.get("/runs/:runId/events", async (c) => {
    const runId = c.req.param("runId")
    await requireRun(runId)
    c.header("Cache-Control", "no-cache, no-transform")
    c.header("X-Accel-Buffering", "no")
    return streamSSE(c, async (stream) => {
      // Serialize writes; bus callbacks are synchronous.
      let chain: Promise<unknown> = Promise.resolve()
      const enqueue = (write: () => Promise<unknown>) => {
        chain = chain.then(write).catch(() => {})
      }
      const unsubscribe = bus.subscribe((event) => {
        if (event.type === SSE_EVENT.run && event.runId !== runId) return
        enqueue(() =>
          stream.writeSSE({
            event: event.type,
            data: JSON.stringify(event.payload),
          })
        )
      })
      const heartbeat = setInterval(
        () => enqueue(() => stream.write(": keepalive\n\n")),
        heartbeatMs
      )
      const closed = new Promise<void>((resolve) => stream.onAbort(resolve))

      // Subscribed first; now report current run state. Clients fetch the snapshot themselves.
      const current = await store.getRun(runId)
      if (current)
        enqueue(() =>
          stream.writeSSE({
            event: SSE_EVENT.run,
            data: JSON.stringify(runStatusDto(current)),
          })
        )

      await closed
      clearInterval(heartbeat)
      unsubscribe()
    })
  })

  api.patch("/tickets/:ticketId", async (c) => {
    const ticketId = c.req.param("ticketId")
    const expected = parseIfMatch(c.req.header("If-Match"))
    if (expected === null) {
      throw new DomainError(
        428,
        "precondition_required",
        'Send If-Match with the current ticket revision, e.g. "3".'
      )
    }
    const body = await readJsonObject(c)
    const fieldErrors: Record<string, string> = {}
    for (const key of Object.keys(body)) {
      if (key !== "closingDate")
        fieldErrors[key] = "This field cannot be edited."
    }
    if (!("closingDate" in body)) fieldErrors.closingDate = "Required"
    const closingDate = body.closingDate
    if (
      closingDate !== null &&
      closingDate !== undefined &&
      (typeof closingDate !== "string" || !isRfc3339(closingDate))
    ) {
      fieldErrors.closingDate =
        "Must be an RFC 3339 timestamp with a timezone offset, or null."
    }
    if (Object.keys(fieldErrors).length) {
      throw new DomainError(422, "validation_error", "Invalid ticket update.", {
        fieldErrors,
      })
    }

    const result = unwrap(
      await store.mutateArtifact({
        kind: "ticket",
        id: ticketId,
        expectedRevision: expected,
        mutate: (current) =>
          applyClosingDate(
            current,
            (closingDate as string | null) ?? null,
            now().toISOString()
          ),
      }),
      ticketId
    )
    if (result.changed)
      bus.publish({ type: SSE_EVENT.ticket, payload: upsertDto(result.record) })
    c.header("ETag", `"${result.record.revision}"`)
    return c.json(result.record.data)
  })

  api.post("/tickets/:ticketId/close", async (c) => {
    const ticketId = c.req.param("ticketId")
    const key = idempotencyKey(c)
    const body = await readJsonObject(c)
    const writeup =
      typeof body.finalWriteup === "string" ? body.finalWriteup.trim() : ""
    if (!writeup || writeup.length > FINAL_WRITEUP_MAX) {
      throw new DomainError(
        422,
        "validation_error",
        "A short final write-up is required to close the ticket.",
        {
          fieldErrors: {
            finalWriteup: writeup
              ? `At most ${FINAL_WRITEUP_MAX} characters.`
              : "Required",
          },
        }
      )
    }

    const result = unwrap(
      await store.mutateArtifact({
        kind: "ticket",
        id: ticketId,
        ...(key ? { idempotency: { scope: `close:${ticketId}`, key } } : {}),
        mutate: (current) => applyClose(current, writeup, now().toISOString()),
      }),
      ticketId
    )
    if (result.changed)
      bus.publish({ type: SSE_EVENT.ticket, payload: upsertDto(result.record) })
    c.header("ETag", `"${result.record.revision}"`)
    return c.json(result.record.data)
  })

  /** Static source cards referenced by evidence blocks. Only served once published in a ticket. */
  api.get("/assets/:evidenceId", async (c) => {
    const evidenceId = c.req.param("evidenceId")
    const body = sources.get(evidenceId)
    const { tickets } = await store.readWorkspace()
    const published = tickets.some((t) =>
      stringArray(t.evidenceIds).includes(evidenceId)
    )
    if (body === undefined || !published)
      throw new DomainError(404, "not_found", `Unknown asset ${evidenceId}.`)
    c.header("X-Content-Type-Options", "nosniff")
    c.header("Content-Security-Policy", "default-src 'none'; sandbox")
    c.header("Cache-Control", "private, max-age=300")
    return c.body(body, 200, { "Content-Type": "text/markdown; charset=utf-8" })
  })

  if (deps.demoControls) {
    api.post("/demo/reset", async (c) => {
      runner.stopAll()
      await store.reset()
      return c.json(await snapshot(null))
    })
  }

  app.route("/api/v1", api)
  return app
}
