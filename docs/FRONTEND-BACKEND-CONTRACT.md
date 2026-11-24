# Frontend/backend contract

**Status:** proposed integration contract, dated 2026-11-24. The local demo API implements this contract; it defines the boundary the frontend and a future production backend must honor. It does not claim a production investigation API or live agent runtime exists. The future fraud-node topology is described in [fraud agent-fabric architecture](AGENT-FABRIC-ARCHITECTURE.md).

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
| `POST /api/v1/monitor/pause` | Request that the application control service stop scheduling new OSINT work; in-flight work settles and publishes before status becomes paused. |
| `POST /api/v1/monitor/resume` | Resume OSINT scheduling. |
| `GET /api/v1/assets/{evidenceId}` | Resolve an evidence asset referenced by a ticket block's `asset.url`. Served as inert data (for the demo, `text/markdown` source cards) and only once the evidence is published in a ticket. |
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

SSE event names are `graph.entity.upsert`, `graph.relationship.upsert`, `ticket.upsert`, and `run.status`. Each upsert event has a per-artifact `revision` and a `data` object containing the stable ID and complete current payload. `run.status` contains operational state, progress, or error metadata only. A relationship contains `fromEntityId`, `toEntityId`, `kind`, temporal scope, support (`observed`, `possible`, or `disputed`), an evidence-cited rationale, and one or more evidence references. The backend may provide relationship strength as `strong`, `medium`, or `weak`, with its rationale; the frontend only renders this value and a legend. It must not score edges or merge identities, and a weak relationship never establishes identity. Graph entity kinds include people, organizations, URLs/websites, ads, social posts, social accounts, servers/logs, bank accounts, money transactions, communities, services, and ports. New kinds are additive and clients should render unknown kinds as inspectable generic records. Each entity resolves to a compiled dossier in the central Network viewport using the same report renderer as tickets; Back restores graph pan, zoom, and selection. Dossier fields are evidence-backed and unavailable values are explicitly unknown.

## Bilingual publication and name-preserving schema

Every published ticket/report artifact, for both the demo API and a future production backend, must provide an Arabic and English content pair. The pair uses canonical locale keys `ar` and `en` in a single ticket revision; neither language is an optional fallback. A production-ready or demo-ready revision is published only when both variants validate together. If either translation or validation fails, do not publish the new revision as ready; retain the previous valid bilingual revision.

The ticket payload carries a `contentVariants` map keyed by locale. Each locale entry contains its translated `title`, `summary`, `reportMarkdown`, and localized narrative text for shared blocks (keyed by block ID). The ticket ID/revision, block IDs, evidence IDs, entity/relationship IDs, citation targets, numeric values, and date values are shared, not recreated per language. Both variants must cite the same source/evidence set. Locale-specific number/date formatting may change presentation, but not the underlying value. A compatibility `reportMarkdown` field alone is not a bilingual publication.

Graph entities retain stable IDs and add name provenance as language-tagged variants, for example `nameVariants: [{value, languageTag, evidenceIds, sourceReference}]`. Preserve every observed name form exactly as sourced across collection, transfer, analysis, linking, report composition, translation, and publication. Never use an LLM or another process to translate, reconstruct, transliterate, normalize destructively, or correct a person/company name. Optional normalized search keys are derived-only and never replace the original variants or prove identity. Entity IDs are separate from names and aliases. If no Arabic source name exists, keep the available source name verbatim in the Arabic content; do not invent one.

Every entity type has an AI-constructed dossier presented as its **Evidence tab** (one concept, not a separate product view), rendered by the same safe block renderer as a ticket. Selecting the Evidence tab occupies the central Network viewport; returning restores graph pan, zoom, and selection. Keep the graph flat with one record per entity ID; community clustering/outlines are navigational aids and cross-community relationships remain visible. Person dossiers may contain source-backed photo, EID issue/expiry, residence/visa/passport, employment, phone, bank account/activity, public-post, and suspicious-transaction material only when authorized evidence supplies it. Organization, log, website/server, URL, community, service, and port entities use the same evidence-backed dossier pattern. Missing data is explicitly unknown. These examples do not authorize collection by themselves.

Translation is the final narrative step, after the production internal orchestrator has combined specialist findings and completed entity linking. For the scripted demo, the corresponding final-composition step follows complete fixture-backed ticket assembly. There is no requirement to translate intermediate workflow stages. Translate narrative, explanations, headings, and block descriptions only. Protect observed names, identifiers, citations, and raw source quotations. Any translated quotation must be labeled as a translation and kept beside the unchanged source quotation. Evidence assets retain their original source language and text.

The checked-in generated demo workspace now carries paired `ar` and `en` ticket variants, shared block IDs, source-backed name variants, and unchanged original source captures. The generator validates both locales and their citations before writing outputs. The current fixture storyline includes one inert, synthetic assumed-authorized police API mock record; it exercises the same evidence/provenance shape without a live API integration.

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

The initial workspace is empty. **Run scan** submits the operator's request and creates a run; the backend then pushes incremental graph and ticket upserts. In the demo backend, scripted timing and scenario fixtures are server-owned. Both the intended demo and production flow automatically enrich public OSINT through an explicitly modeled, assumed authorized police internal API source; no manual evidence upload or provider-request wait is a prerequisite. The current demo uses one static assumed-authorized police API mock record to exercise this shape; it does not call a live API. The frontend does not import scenario fixtures, schedule reveal timers, or expose simulated playback controls. Continuous monitoring persists while the browser is disconnected. Pause/resume commands go through the application control service to the OSINT orchestrator: pause stops new scheduling, lets in-flight tasks finish and publish, and reports `Pausing` until complete. Internal agents cannot command OSINT nodes. No notification UI is required.

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

The demo backend in [`apps/demo-api`](../apps/demo-api/README.md) implements this contract and records the choices it had to make where this document is silent: run reuse, the `run.status` payload, ticket `history`, `428` for a missing `If-Match`, and closing-date normalisation. Promote those choices here if a real backend should share them.

The demo adapter and future real-backend adapter must pass the same frontend contract. Transport configuration is environment/deployment configuration; do not encode demo fixture behavior into frontend components. Unknown additive fields and event types should be tolerated with a logged diagnostic; malformed records should surface a recoverable connection/data error. Do not equate “no result yet” with a negative result, or `possible`/`disputed` evidence with a verified identity.

The proposed production fraud fabric boundary is documented in [fraud agent-fabric architecture](AGENT-FABRIC-ARCHITECTURE.md): separate public OSINT and private internal nodes publish and consume findings without a reverse control path. That topology does not change these frontend DTOs, routes, or SSE semantics. The current demo backend replays four public campaigns plus one inert assumed-authorized police API mock record. It contains no real person identifiers and makes no API call, but exercises internal enrichment and a cited synthetic dated residence/visa dossier field without manual upload or provider-request waiting. This contract does not choose database schemas, a backend framework, queue, model runtime, or deployment tooling, and it does not claim that a production service exists.
