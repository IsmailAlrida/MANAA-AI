@AGENTS.md
# MANA'A project onboarding

This repository contains the product brief, a Next.js frontend, a REST/SSE demo backend, generated fictional demo fixtures, and a pinned research submodule. Read the relevant canonical docs before changing product behavior or the API.

## Repository map

- The npm/Turborepo monorepo lives at the repository root. Work on the Next.js application in `apps/web/`; do not create a competing frontend elsewhere.
- `apps/web/` is the web app and `apps/demo-api/` is the demo backend. Shared UI and config packages live in `packages/`.
- `docs/` contains the product/API plan, API contract, transport recommendation, and current fictional casebook.
- `demo/fixtures/` contains the deterministic, standard-library Python generator and generated static scenario artifacts used by the demo backend.
- `engine/` is the `manaa` Git submodule, renamed at the path while retaining its existing remote and pinned commit. It currently contains research and superseded planning notes; it is not the production agent runtime or a deployable service.
- `README.MD.md` and root `index.html` are existing repository materials. Keep their purpose separate from the Next.js app.

## Canonical product and API requirements

Read these before implementing or changing the product/API boundary:

- [Product and demo plan](docs/WIZARD-OF-OZ-DEMO-PLAN.md)
- [Frontend/backend contract](docs/FRONTEND-BACKEND-CONTRACT.md)
- [SSE transport recommendation](docs/PUSH-TRANSPORT-RECOMMENDATION.md)
- [Fictional casebook](docs/FICTIONAL-CASEBOOK.md)
- [Fraud agent-fabric architecture](docs/AGENT-FABRIC-ARCHITECTURE.md)

The operator flow is **Run scan** from an initially empty workspace, then inspect campaign tickets, cited evidence, and the investigation graph. The main flow does not require the operator to enter a URL. The current fictional scenario discovers four separate public-source leads: an organic TAMM typo-squat search result, a LinkedIn-style AED 20,000/month vague-duty job post, a marketplace seller/licence mismatch, and a Maps-style recovery listing. Public portfolio, advertiser, marketplace-terms, and independent-directory captures connect their paths. These are fictional static records: public captures plus one assumed-authorized police API mock record with a synthetic person. It contains no real identifiers and calls no API; there are no ads purchased, customer data, or transaction records. Keep attribution and intent uncertain and do not present association as guilt.

The frontend uses one versioned API contract across the implemented demo backend and a future production backend. The local demo API implements that contract; it is not a production investigation service and no live agent runtime exists. REST snapshots and operator mutations pair with one-way Server-Sent Events (SSE). Domain updates are ticket upserts and graph entity/relationship upserts; `run.status` is transport metadata. Subscribe to SSE, then load the snapshot and merge by stable ID and monotonically increasing revision on connect/reconnect. Preserve evidence references, source provenance, capture time, language, support, and uncertainty. Render source text safely as data.

Every published ticket/report from either backend must include Arabic (`ar`) and English (`en`) variants in the same validated revision. Preserve all observed person/company name forms verbatim, with language tags and source provenance, through collection, transfer, analysis, entity linking, final translation, and publication. Never translate, transliterate, reconstruct, or “correct” names; optional search keys are derived only. Translate narrative only after the final orchestrator has combined findings. Protect names, identifiers, citations, raw source quotations, and shared values/IDs across variants. If Arabic source form is missing, retain the original available name in Arabic output. Publish both variants atomically or keep the new revision incomplete and the last valid pair current.

The proposed v1 routes are `GET /api/v1/workspace`, `POST /api/v1/runs`, `GET /api/v1/runs/{runId}/events` (SSE), `GET /api/v1/runs/{runId}/snapshot`, `PATCH /api/v1/tickets/{ticketId}`, and `POST /api/v1/tickets/{ticketId}/close`. `POST /api/v1/demo/reset` is demo-only. These are documented contract routes; the local demo implements them where applicable, and no production endpoint is deployed. See the contract for request fields, idempotency, revisions, and error behavior.

Do not add an in-app toast, notification bell, unread count, or separate notifications UI. Run progression belongs to the backend. Keep fixture IDs, reveal timing, and demo behavior out of frontend components. The same frontend boundary must support the scripted demo service and a future real agent backend without scenario-specific UI branches.

## Current implementation versus planned system

`apps/web/` implements the Next.js Network and Tickets surfaces, central entity Evidence tab, and API client; the demo API includes pause/resume controls. `apps/demo-api/` is the implemented demo backend: a Hono + `node:sqlite` service that replays the generated fictional public captures and one synthetic internal API mock through the v1 REST/SSE contract (see its README). Its `Store` interface is designed for a future PostgreSQL implementation; no PostgreSQL adapter exists yet. The Python fixture generator creates fictional records; it is not itself an HTTP API, production scan engine, or agent orchestrator. No production fraud-intelligence fabric or deployment configuration is implemented.

Keep this distinction clear in code and documentation. Do not imply that the app currently scans real sites, uses an LLM, receives private provider data, or is deployed. Do not introduce real collection or offensive capabilities while implementing the fictional demo.

## Frontend stack and local commands

The app monorepo at the repository root uses npm workspaces and Turborepo, with Next.js `16.4.6`, React `19.3.1`, TypeScript, Tailwind CSS 4, and shared shadcn/ui components. Its `package.json` requires Node.js `>=20.9.0` and declares npm `11.19.1` as the package manager. Install from the monorepo root:

```sh
npm ci
npm run dev        # web on :3000 + apps/api on :4787 (persistent; stub adapter replays fixtures)
npm run dev:demo   # web on :3000 + apps/demo-api on :4787 (in-memory, non-persistent)
```

The root scripts `dev`, `build`, `lint`, `format`, `typecheck`, and `test` run through Turborepo across all workspaces; see `README.md` for copy-paste commands. Only `apps/demo-api` has tests. The web app reads server-side `MANAA_API_ORIGIN` to proxy `/api/v1` to the selected backend (defaults to `http://127.0.0.1:4787`, served by `apps/api` or `apps/demo-api`, outside production builds). No other frontend/API environment variables are declared; inspect code and documentation before adding them. Keep secrets server-side, never in `NEXT_PUBLIC_*` variables, and never commit local `.env` files.

## Backend and future agent-runtime direction

Keep responsibilities separate:

- **Frontend:** render API DTOs, cited evidence, uncertainty, run state, and operator edits. It does not crawl, call agent tools, own fixture timing, connect to intelligence databases, or store provider credentials.
- **Demo backend:** `apps/demo-api/` replays four fictional cases through REST/SSE; reports now carry paired Arabic/English variants. The fixture includes a static assumed-authorized police API mock record to exercise automatic enrichment; it calls no live API and has no real PII.
- **Production fraud backend (proposed):** follow the [fraud agent-fabric architecture](docs/AGENT-FABRIC-ARCHITECTURE.md). One VPS is one autonomous node with its own orchestrator; a node may spawn many specialized subagents. Public OSINT nodes and internal fraud-intelligence nodes belong to separate fabrics. Published findings move one way through the transfer database; the internal fabric automatically enriches them through authorized read-only internal APIs, then writes derived tickets, graph, and entity Evidence-tab dossiers to a separate final-results database served by the existing API. Internal access is deployment-provisioned; no manual upload/request queue is assumed.

“Air-gapped” is shorthand for internal nodes having no public internet route and no upstream write/control channel; it is not a claim of literal physical air-gapping or perfect isolation. OSINT collection is limited to authorized public fraud-relevant material, starting from a future curated/verified UAE organization and official-domain catalogue while also scanning relevant public social sources. Internal enrichment is automatic through provisioned read-only APIs. The production monitor persists when the UI is disconnected; pause stops new scheduling and lets in-flight work finish/publish, with resume supported. Internal nodes cannot control OSINT nodes. Entity Evidence tabs use the ticket report renderer, preserve graph state on return, show missing facts as unknown, and keep source-backed relationship strength as backend data. The checked-in demo includes four public campaigns and one synthetic static internal API mock record; no live integration is implemented. Government or banking API examples apply only when a deployment explicitly provisions lawful access; UAE PASS is not a general identity-lookup API. Keep human review for consequential judgments because isolation cannot prevent model or source errors.

Each node role has a dedicated multi-step workflow directory based on its ICM folder/catalogue, with permitted inputs/tools, provenance rules, scratchpad boundaries, checks, and a final artifact schema/publish target. Use smaller specialist models where appropriate. Keep scratchpads internal and publish validated cited findings, not hidden reasoning. Reuse mature queue, notification, database, and API/SSE libraries; do not add bespoke pipeline infrastructure or mandate technology without a concrete need. The full deployment-neutral boundary, one-way handoff, database roles, and optional DigitalOcean/Ansible direction are in the linked architecture document.

The proposed fabric and internal enrichment are future architecture only. Do not deploy nodes, connect internal APIs, or add real-world collection as part of demo work unless the task explicitly requests implementation and provides the required authorization and environment. Keep API state changes such as deadline edits and closure notes in the backend/results store; never route them as commands to OSINT nodes.

## Change discipline

- Preserve unrelated staged, unstaged, and untracked work.
- Verify the actual package scripts and existing types before writing commands or setup steps.
- Keep the frontend/backend contract in `docs/FRONTEND-BACKEND-CONTRACT.md` authoritative for DTOs and routes; update dependent docs when a contract changes.
- Keep all visible demo evidence fictional, static, noninteractive, cited, and consistent with the casebook and generator.
- Do not claim tests, integrations, deployment, or real-world sourcing that have not been implemented and verified.
