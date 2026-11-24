/**
 * Typed REST client for the v1 contract. Same-origin `/api/v1/*`; next.config
 * rewrites to the backend selected by MANAA_API_ORIGIN (demo or real).
 */
import {
  errorEnvelopeSchema,
  runStatusSchema,
  snapshotSchema,
  ticketSchema,
  type RunStatus,
  type Snapshot,
  type Ticket,
} from "./types"

export const API_BASE = "/api/v1"

export type ApiErrorKind =
  | "network"
  | "validation" // 400 / 422
  | "unauthorized" // 401 / 403
  | "not_found" // 404
  | "conflict" // 409 stale revision
  | "rate_limited" // 429
  | "server" // 500 / other 5xx
  | "unavailable" // 502 / 503 / 504 — backend missing or down
  | "malformed" // response failed schema validation

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status?: number,
    readonly fieldErrors?: Record<string, string>,
    readonly currentRevision?: number,
    readonly requestId?: string
  ) {
    super(message)
    this.name = "ApiError"
  }
}

function kindForStatus(status: number): ApiErrorKind {
  if (status === 400 || status === 422) return "validation"
  if (status === 401 || status === 403) return "unauthorized"
  if (status === 404) return "not_found"
  if (status === 409) return "conflict"
  if (status === 429) return "rate_limited"
  if (status === 502 || status === 503 || status === 504) return "unavailable"
  return "server"
}

async function request<T>(
  path: string,
  init: RequestInit & { parse: (json: unknown) => T }
): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      credentials: "same-origin",
      ...init,
      headers: { Accept: "application/json", ...init.headers },
    })
  } catch {
    throw new ApiError("network", "Unable to reach the investigation service.")
  }

  const body: unknown = await res.json().catch(() => null)

  if (!res.ok) {
    const env = errorEnvelopeSchema.safeParse(body)
    const e = env.success ? env.data.error : undefined
    throw new ApiError(
      kindForStatus(res.status),
      e?.message ?? `Request failed (${res.status}).`,
      res.status,
      e?.fieldErrors,
      e?.currentRevision,
      e?.requestId
    )
  }

  try {
    return init.parse(body)
  } catch (err) {
    console.warn("[api] malformed response", path, err)
    throw new ApiError(
      "malformed",
      "The service returned data in an unexpected format."
    )
  }
}

const json = (body: unknown, headers: Record<string, string> = {}) => ({
  body: JSON.stringify(body),
  headers: { "Content-Type": "application/json", ...headers },
})

export const newIdempotencyKey = () => crypto.randomUUID()

export const api = {
  getWorkspace: () =>
    request<Snapshot>("/workspace", { parse: (j) => snapshotSchema.parse(j) }),

  /** Main flow needs no URL; requestText is optional operator input. */
  startRun: (idempotencyKey: string, requestText?: string) =>
    request<RunStatus>("/runs", {
      method: "POST",
      ...json(requestText ? { requestText } : {}, {
        "Idempotency-Key": idempotencyKey,
      }),
      parse: (j) => runStatusSchema.parse(j),
    }),

  pauseMonitor: () =>
    request<RunStatus>("/monitor/pause", {
      method: "POST",
      ...json({}),
      parse: (j) => runStatusSchema.parse(j),
    }),

  resumeMonitor: () =>
    request<RunStatus>("/monitor/resume", {
      method: "POST",
      ...json({}),
      parse: (j) => runStatusSchema.parse(j),
    }),

  getRunSnapshot: (runId: string) =>
    request<Snapshot>(`/runs/${encodeURIComponent(runId)}/snapshot`, {
      parse: (j) => snapshotSchema.parse(j),
    }),

  runEventsUrl: (runId: string) =>
    `${API_BASE}/runs/${encodeURIComponent(runId)}/events`,

  patchTicket: (
    ticketId: string,
    revision: number,
    patch: { closingDate: string | null }
  ) =>
    request<Ticket>(`/tickets/${encodeURIComponent(ticketId)}`, {
      method: "PATCH",
      ...json(patch, { "If-Match": `"${revision}"` }),
      parse: (j) => ticketSchema.parse(j),
    }),

  closeTicket: (
    ticketId: string,
    finalWriteup: string,
    idempotencyKey: string
  ) =>
    request<Ticket>(`/tickets/${encodeURIComponent(ticketId)}/close`, {
      method: "POST",
      ...json({ finalWriteup }, { "Idempotency-Key": idempotencyKey }),
      parse: (j) => ticketSchema.parse(j),
    }),

  /** Demo-backend only; not wired into operator navigation. */
  resetDemo: () =>
    request<Snapshot>("/demo/reset", {
      method: "POST",
      parse: (j) => snapshotSchema.parse(j),
    }),
}
