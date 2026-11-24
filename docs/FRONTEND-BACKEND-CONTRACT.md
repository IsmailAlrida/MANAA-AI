# Frontend/backend contract

**Status:** proposed integration contract, dated 2026-11-24. This document defines the boundary the production-intended frontend and either backend must honor. It does not claim that a real investigation API or live agent backend already exists.

## Product boundary

The frontend is one operator application with two pages: **Network** and **Tickets**. A ticket opens in the same central viewport, replacing the current page while preserving a clear return path. A single closeable Agent sidebar sits on the right in English and on the left in Arabic; no more than two sidebars may be open at once. The optional assistant chat is a separate, real `assistant-ui` integration configured with its own provider and transport. It is not the source of investigation data.

The frontend speaks one API whether it is connected to the demo backend or a future real agent backend. Select the backend using endpoint/configuration, not frontend imports or backend-specific UI branches. The demo is a Wizard of Oz presentation of a **synthetic scenario**: the backend owns fixture records, reveal timing, run state, and durable workspace state. The UI must disclose the synthetic scenario in project/demo documentation; the operational workspace itself must not display fake, simulation, or Wizard of Oz badges. Evidence provenance, confidence, and uncertainty are normal operator content and remain visible in both modes.

The backend publishes exactly two domain artifact families:

1. **Campaign tickets.** Each ticket represents a campaign-level review, with a freeform Markdown report and typed evidence, plot, and comparison blocks. Blocks and report sections link to evidence/artifact references and relevant graph IDs.
2. **Investigation graph.** Entities and relationships, each with stable IDs, typed attributes, temporal/source provenance, support or uncertainty, and artifact references.

Run status, progress, and transport state are operational metadata, not a third domain artifact family. A financial chart is a view of graph account and transaction records; it must not carry a second, independently maintained set of amounts.

## Request examples

Start a run with the operator's request. Use an `Idempotency-Key` header so a retried submission does not create a duplicate run. The backend returns the run identifier and operational status; subsequent ticket/graph data arrives through the run snapshot and SSE upserts.

```json
{"requestText":"Investigate the reported payment link https://pay.example.test/notice"}
```

```json
{"runId":"run_01JTEST0001","status":"running"}
```

Edit the proposed campaign closing date with the current ticket revision:

```http
PATCH /api/v1/tickets/ticket_01JTEST0001
If-Match: "7"
Content-Type: application/json
```

```json
{"closingDate":"2026-11-27T12:00:00Z"}
```

## Proposed transport

Use versioned JSON REST endpoints for snapshots/mutations and a server-sent event stream for backend push. These paths are a proposed contract, not an existing service URL:

The [push transport recommendation](PUSH-TRANSPORT-RECOMMENDATION.md) records the SSE/library choice and its delivery limits.

| Method and path | Purpose |
| --- | --- |
| `GET /api/v1/workspace` | Return the current durable workspace snapshot. A new workspace starts with no tickets or graph records. |
| `POST /api/v1/runs` | Start a scan from operator input. The request is idempotent by `Idempotency-Key`; the backend owns all incremental reveals. |
| `GET /api/v1/runs/{runId}/events` | Subscribe to run updates using SSE. |
| `GET /api/v1/runs/{runId}/snapshot` | Return the run's current graph/ticket state and run status for initial load and reconnect recovery. |
| `PATCH /api/v1/tickets/{ticketId}` | Change editable ticket fields, currently the proposed closing date. |
| `POST /api/v1/tickets/{ticketId}/close` | Archive a reviewed ticket with the required operator write-up. |
| `POST /api/v1/demo/reset` | Explicitly reset demo-owned durable state to a clean scenario. Unsupported by a real backend unless it has an authorized equivalent. |

SSE is one-way backend push; it is not a durable event log. On each successful stream open or reconnect, the client subscribes first and then fetches the run snapshot. This ordering prevents a gap between the snapshot read and subscription. Merge snapshot rows and pushed upserts by stable artifact ID and monotonically increasing per-artifact `revision`; never let an older snapshot or duplicate event overwrite a newer revision. The workspace snapshot is also the source for restoring durable state after a page refresh or returning to the app. No custom cursor, replay store, retry queue, or event broker is required.

The current frontend scaffold does not include TanStack Query. Do not add a cache dependency only to deliver events; update the existing workspace state. If a query-cache library is adopted separately, event upserts may update its cache. For a same-origin demo API, use browser `EventSource`; use a maintained client such as `@microsoft/fetch-event-source` only if authentication headers or explicit reconnect hooks require it. In a TypeScript/Hono demo backend, use Hono's `streamSSE()` helper rather than hand-building stream framing. Backend push updates workspace data; no toast, bell, or other in-app notification UI is required.

The server emits entity upserts before relationships that reference them and emits ticket upserts after their graph/evidence references are present. The snapshot is internally consistent at read time. Clients must render unresolved references safely rather than silently dropping an artifact. Updates in this demo contract are upserts; graph deletions/tombstones are out of scope. Closed tickets remain as archived records rather than being deleted. If a future backend needs deletions, add explicit tombstones and revision semantics before implementation. Identifiers are stable across runs and reconnects.

Example SSE event data (all IDs and hostnames below are illustrative and use `.test`; the SSE event name is `graph.entity.upsert`):

```json
{
  "revision": 1,
  "data": {
    "id": "url_01JTEST0001",
    "kind": "url",
    "url": "https://pay.example.test/notice",
    "host": "pay.example.test",
    "observedAt": "2026-11-24T10:00:00Z",
    "provenance": [{"evidenceId": "ev_01JTEST0001"}],
    "support": "observed"
  }
}
```

SSE event names are `graph.entity.upsert`, `graph.relationship.upsert`, `ticket.upsert`, and `run.status`. Each upsert event has a per-artifact `revision` and a `data` object containing the stable ID and complete current payload. `run.status` contains operational state, progress, or error metadata only. A relationship contains `fromEntityId`, `toEntityId`, `kind`, temporal scope, support (`observed`, `possible`, or `disputed`), rationale, and one or more evidence references. Graph entity kinds include people, URLs/websites, ads, social posts, social accounts, servers, bank accounts, money transactions, and companies. New kinds are additive and clients should render unknown kinds as inspectable generic records.

## Ticket and evidence shape

A ticket is a campaign-level unit with a stable `id`, editable `title`, `createdAt`, `updatedAt`, AI-proposed `closingDate`, `status` (`open` or `closed`), `reportMarkdown`, `blocks`, and links to graph entity/relationship IDs. The operator can edit the proposed closing date through `PATCH`; overdue is derived: it means the ticket is open and the current time is past its closing date. The date is a proposed deadline, not a classification result. Closed tickets remain available in the archive and retain their report, evidence references, due-date history, and closure write-up.

`blocks` is an ordered discriminated union. Initial block kinds are:

- `markdown`: narrative/report section with Markdown text and optional evidence references.
- `evidence`: typed evidence item, including source URL or source description, observed/captured time, collection method, provenance, content hash where available, support/uncertainty, and an asset reference.
- `plot`: chart specification and data references. A financial-flow plot references transaction and account IDs; it does not duplicate authoritative values.
- `comparison`: two or more evidence/entity references, labeled fields being compared, and the result with its uncertainty.

Asset references use an API-relative or signed URL, MIME type, byte length, optional SHA-256, and access scope. The browser fetches the asset through the backend contract and does not assume local fixture paths. Report Markdown may refer to block IDs using the renderer's explicit link syntax; untrusted source text is rendered safely and is never treated as executable HTML.

Core graph transaction fields include transaction ID, source account ID, destination account ID, amount as a decimal string, ISO currency code, timestamp, and transaction provenance/evidence. Accounts are graph entities. Dates are RFC 3339 timestamps with timezone offsets. Missing values are omitted or explicitly `null`; they are never invented by the client. Source observations, analytical inferences, and operator conclusions are distinguishable and retain their provenance.

## Run, persistence, and operator actions

The initial workspace is empty. **Run scan** submits the operator's request and creates a run; the backend then pushes incremental graph and ticket upserts. In the demo backend, scripted timing and scenario fixtures are server-owned. In a future backend, live agent work owns the same output stream. The frontend does not import scenario fixtures, schedule reveal timers, or expose simulated playback controls.

Workspace state is durable across page navigation, browser refresh, and returning to the app. Active and closed tickets remain. Resetting to the demo's clean slate is an explicit backend operation; refresh is never a reset. Demo reset clears only the demo backend's workspace/run state and returns the new empty snapshot.

An operator investigates outside this app and makes the threat/no-threat judgment as part of that work. The only required in-app close action is one short freeform write-up describing the raid/takedown, why it was closed, or why it was a false positive. Closing archives the campaign ticket. There is no outcome dropdown, separate assessment endpoint, or referral workflow. The client must not infer a closure reason from other fields.

Suggested request:

```json
{
  "finalWriteup": "Reviewed the cited evidence and recorded the external takedown reference REF-TEST-01."
}
```

Suggested errors use a stable envelope: `{"error":{"code":"validation_error","message":"...","fieldErrors":{"finalWriteup":"Required"},"requestId":"req_01JTEST0001"}}`. Use appropriate HTTP codes: `400` malformed request, `401/403` unauthorized, `404` unknown ticket, `409` stale artifact revision, `422` field validation, `429` rate limit, and `5xx` server failure. Ticket patches include `If-Match` with the current ticket revision; stale changes return `409` with the current revision so the operator can reload or reconcile. Run creation and closing accept an idempotency key; closing records actor/time/write-up in the audit history.

## Compatibility and implementation notes

The demo adapter and future real-backend adapter must pass the same frontend contract. Transport configuration is environment/deployment configuration; do not encode demo fixture behavior into frontend components. Unknown additive fields and event types should be tolerated with a logged diagnostic; malformed records should surface a recoverable connection/data error. Do not equate “no result yet” with a negative result, or `possible`/`disputed` evidence with a verified identity.

The current product boundary specifies behavior and DTOs only. It does not freeze database tables, choose a backend framework, claim a production API exists, or settle authentication/deployment details. Those belong to the backend implementation and deployment decisions.
