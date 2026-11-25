@AGENTS.md
# MANA'A project onboarding

This repository contains a Next.js frontend, fixture replay backend, managed synthetic VM workflow, generated fictional fixtures, and a pinned agent-engine submodule. Read the relevant canonical docs before changing product behavior or the API.

## Repository map

- The npm/Turborepo monorepo lives at the repository root. Work on the Next.js application in `apps/web/`; do not create a competing frontend elsewhere.
- `apps/web/` is the web app and `apps/demo-api/` is the demo backend. Shared UI and config packages live in `packages/`.
- `docs/` contains the product/API plan, API contract, transport recommendation, and current fictional casebook.
- `demo/fixtures/` contains the deterministic, standard-library Python generator and generated static scenario artifacts used by the demo backend.
- `engine/` is the `manaa` Git submodule, renamed at the path while retaining its existing remote and pinned commit. It contains agent workflow templates, offline tools, controlled-case logic, and the Python transfer service; its managed VM workflow is synthetic and does not perform live discovery.
- `README.MD.md` and root `index.html` are existing repository materials. Keep their purpose separate from the Next.js app.

## Canonical product and API requirements

Read these before implementing or changing the product/API boundary:

- [Product and demo plan](docs/WIZARD-OF-OZ-DEMO-PLAN.md)
- [Frontend/backend contract](docs/FRONTEND-BACKEND-CONTRACT.md)
- [SSE transport recommendation](docs/PUSH-TRANSPORT-RECOMMENDATION.md)
- [Fictional casebook](docs/FICTIONAL-CASEBOOK.md)
- [Fraud agent-fabric architecture](docs/AGENT-FABRIC-ARCHITECTURE.md)

The operator flow is **Run scan** from an initially empty workspace, then inspect campaign tickets, cited evidence, and the investigation graph. The main flow does not require the operator to enter a URL. The current fictional scenario discovers four separate public-source leads: an organic TAMM typo-squat search result, a LinkedIn-style AED 20,000/month vague-duty job post, a marketplace seller/licence mismatch, and a Maps-style recovery listing. Public portfolio, advertiser, marketplace-terms, and independent-directory captures connect their paths. These are fictional static records: public captures plus one assumed-authorized police API mock record with a synthetic person. It contains no real identifiers and calls no API; there are no ads purchased, customer data, or transaction records. Keep attribution and intent uncertain and do not present association as guilt.

The frontend uses one versioned API contract across the fixture replay backend and managed synthetic backend. REST snapshots and operator mutations pair with one-way Server-Sent Events (SSE). Domain updates are ticket upserts and graph entity/relationship upserts; `run.status` is transport metadata. Subscribe to SSE, then load the snapshot and merge by stable ID and monotonically increasing revision on connect/reconnect. Preserve evidence references, source provenance, capture time, language, support, and uncertainty. Render source text safely as data.

Every published ticket/report from either backend must include Arabic (`ar`) and English (`en`) variants in the same validated revision. Preserve all observed person/company name forms verbatim, with language tags and source provenance, through collection, transfer, analysis, entity linking, final translation, and publication. Never translate, transliterate, reconstruct, or “correct” names; optional search keys are derived only. Translate narrative only after the final orchestrator has combined findings. Protect names, identifiers, citations, raw source quotations, and shared values/IDs across variants. If Arabic source form is missing, retain the original available name in Arabic output. Publish both variants atomically or keep the new revision incomplete and the last valid pair current.

The proposed v1 routes are `GET /api/v1/workspace`, `POST /api/v1/runs`, `GET /api/v1/runs/{runId}/events` (SSE), `GET /api/v1/runs/{runId}/snapshot`, `PATCH /api/v1/tickets/{ticketId}`, and `POST /api/v1/tickets/{ticketId}/close`. `POST /api/v1/demo/reset` is demo-only. These are documented contract routes; the local demo implements them where applicable, and no production endpoint is deployed. See the contract for request fields, idempotency, revisions, and error behavior.

Do not add an in-app toast, notification bell, unread count, or separate notifications UI. Run progression belongs to the backend. Keep fixture IDs, reveal timing, and demo behavior out of frontend components. The same frontend boundary must support the scripted demo service and a future real agent backend without scenario-specific UI branches.

## Current implementation versus planned system

`apps/web/` implements the Next.js Network and Tickets surfaces, central entity Evidence tab, and API client. `apps/demo-api/` is the non-persistent fictional replay backend. `apps/api/` is the persistent managed dashboard API: fixture mode is the local development default, while the managed launcher selects its controlled engine adapter. That adapter invokes fixed OSINT and police guest actions, reads synthetic results through host transfer services, and maps them into the dashboard contract. The engine has OpenCode runtime and agent workflow templates, but the current run is bounded synthetic processing, not live discovery or restricted-system enrichment. See the root README, app READMEs, and `engine/README.md` for current operation.

Keep this distinction clear in code and documentation. The managed synthetic police review can call the configured OpenAI-compatible inference endpoint, but it does not scan real sites or receive private provider data. Do not describe the prototype as deployed or introduce real collection while implementing the synthetic workflow.

## Frontend stack and local commands

The app monorepo at the repository root uses npm workspaces and Turborepo, with Next.js `16.4.6`, React `19.3.1`, TypeScript, Tailwind CSS 4, and shared shadcn/ui components. Its `package.json` requires Node.js `>=20.9.0` and declares npm `11.19.1` as the package manager. Install from the monorepo root:

```sh
npm ci
npm start          # managed Ubuntu host/VM workflow
npm run dev        # web + apps/api (persistent SQLite; fixture adapter by default)
npm run dev:demo   # web + apps/demo-api (in-memory fictional replay)
```

The root scripts `dev`, `build`, `lint`, `format`, `typecheck`, and `test` run through Turborepo across all workspaces; see `README.md` for copy-paste commands. `apps/demo-api` and launcher tests are available. The web app reads server-side `MANAA_API_ORIGIN` to proxy `/api/v1` to the selected backend (defaults to `http://127.0.0.1:4787`). The managed launcher also reads provider, service, VM, and model endpoint settings from the root `.env`; consult the root README and `infra/` before adding or changing variables. Keep secrets server-side, never in `NEXT_PUBLIC_*` variables, and never commit local `.env` files.

## Backend and future agent-runtime direction

Keep responsibilities separate:

- **Frontend:** render API DTOs, cited evidence, uncertainty, run state, and operator edits. It does not crawl, call agent tools, own fixture timing, connect to intelligence databases, or store provider credentials.
- **Fictional replay backend:** `apps/demo-api/` replays fictional cases through REST/SSE and does not persist or call an agent.
- **Managed synthetic backend:** `apps/api/` and its guest adapter invoke the controlled OSINT/police workflow and transfer synthetic evidence through PostgreSQL before publishing dashboard results. The app API stores dashboard state in SQLite. This is implemented, but full VM startup has not been verified on a supported host.
- **Future live fraud service:** broader real-world monitoring, restricted integrations, and a production fraud-intelligence fabric remain proposed. Follow the [fraud agent-fabric architecture](docs/AGENT-FABRIC-ARCHITECTURE.md) for that design; do not describe it as running today.

“Air-gapped” is shorthand for internal nodes having no public internet route and no upstream write/control channel; it is not a claim of literal physical air-gapping or perfect isolation. OSINT collection is limited to authorized public fraud-relevant material, starting from a future curated/verified UAE organization and official-domain catalogue while also scanning relevant public social sources. Internal enrichment is automatic through provisioned read-only APIs. The production monitor persists when the UI is disconnected; pause stops new scheduling and lets in-flight work finish/publish, with resume supported. Internal nodes cannot control OSINT nodes. Entity Evidence tabs use the ticket report renderer, preserve graph state on return, show missing facts as unknown, and keep source-backed relationship strength as backend data. The checked-in demo includes four public campaigns and one synthetic static internal API mock record; no live integration is implemented. Government or banking API examples apply only when a deployment explicitly provisions lawful access; UAE PASS is not a general identity-lookup API. Keep human review for consequential judgments because isolation cannot prevent model or source errors.

Each node role has a dedicated multi-step workflow directory based on its ICM folder/catalogue, with permitted inputs/tools, provenance rules, scratchpad boundaries, checks, and a final artifact schema/publish target. Use smaller specialist models where appropriate. Keep scratchpads internal and publish validated cited findings, not hidden reasoning. Reuse mature queue, notification, database, and API/SSE libraries; do not add bespoke pipeline infrastructure or mandate technology without a concrete need. The full deployment-neutral boundary, one-way handoff, database roles, and optional DigitalOcean/Ansible direction are in the linked architecture document.

The managed VM workflow is a controlled synthetic case and must stay clearly distinguished from future live monitoring or internal enrichment. Do not connect restricted APIs or add real-world collection unless the task explicitly requests implementation and provides the required authorization and environment. Keep API state changes such as deadline edits and closure notes in the backend/results store; never route them as commands to OSINT nodes.

## Change discipline

- Preserve unrelated staged, unstaged, and untracked work.
- Verify the actual package scripts and existing types before writing commands or setup steps.
- Keep the frontend/backend contract in `docs/FRONTEND-BACKEND-CONTRACT.md` authoritative for DTOs and routes; update dependent docs when a contract changes.
- Keep all visible demo evidence fictional, static, noninteractive, cited, and consistent with the casebook and generator.
- Do not claim tests, integrations, deployment, or real-world sourcing that have not been implemented and verified.
