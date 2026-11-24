@AGENTS.md
# MANA'A project onboarding

This repository contains the product brief, a separate Next.js frontend scaffold, public-only fictional demo fixtures, and a pinned research submodule. Read the relevant canonical docs before changing product behavior or the API.

## Repository map

- `MANAA-AI/` is a separate nested Git repository containing the frontend monorepo. Work on the Next.js application there; do not create a competing frontend at this repository root.
- `MANAA-AI/apps/web/` is the web app. Shared UI and config packages live in `MANAA-AI/packages/`.
- `docs/` contains the product/API plan, API contract, transport recommendation, and current fictional casebook.
- `demo/fixtures/` contains the deterministic, standard-library Python generator and generated static scenario artifacts. It is data for a future demo service, not a running backend.
- `engine/` is the `manaa` Git submodule, renamed at the path while retaining its existing remote and pinned commit. It currently contains research and superseded planning notes; it is not the production agent runtime or a deployable service.
- `README.MD.md` and root `index.html` are existing outer-repository materials. Keep their history and purpose separate from the nested Next.js app.

The nested frontend repository and this outer repository have separate Git metadata. Check both statuses before editing; never flatten, relocate, or delete either Git history as routine cleanup.

## Canonical product and API requirements

Read these before implementing or changing the product/API boundary:

- [Product and demo plan](docs/WIZARD-OF-OZ-DEMO-PLAN.md)
- [Frontend/backend contract](docs/FRONTEND-BACKEND-CONTRACT.md)
- [SSE transport recommendation](docs/PUSH-TRANSPORT-RECOMMENDATION.md)
- [Fictional casebook](docs/FICTIONAL-CASEBOOK.md)

The operator flow is **Run scan** from an initially empty workspace, then inspect campaign tickets, cited evidence, and the investigation graph. The main flow does not require the operator to enter a URL. The current fictional scenario discovers four separate public-source leads: an organic TAMM typo-squat search result, a LinkedIn-style AED 20,000/month vague-duty job post, a marketplace seller/licence mismatch, and a Maps-style recovery listing. Public portfolio, advertiser, marketplace-terms, and independent-directory captures connect their paths. These are fictional static public captures only; the scenario has no ads purchased, private imports, customer data, or transaction records. Keep attribution and intent uncertain and do not present association as guilt.

The frontend and either backend use one proposed versioned API. The documented contract is not a claim that an API or live agent runtime exists. REST snapshots and operator mutations pair with one-way Server-Sent Events (SSE). Domain updates are ticket upserts and graph entity/relationship upserts; `run.status` is transport metadata. Subscribe to SSE, then load the snapshot and merge by stable ID and monotonically increasing revision on connect/reconnect. Preserve evidence references, source provenance, capture time, language, support, and uncertainty. Render source text safely as data.

The proposed v1 routes are `GET /api/v1/workspace`, `POST /api/v1/runs`, `GET /api/v1/runs/{runId}/events` (SSE), `GET /api/v1/runs/{runId}/snapshot`, `PATCH /api/v1/tickets/{ticketId}`, and `POST /api/v1/tickets/{ticketId}/close`. `POST /api/v1/demo/reset` is demo-only. These are documented contract routes, not confirmed live endpoints; see the contract for request fields, idempotency, revisions, and error behavior.

Do not add an in-app toast, notification bell, unread count, or separate notifications UI. Run progression belongs to the backend. Keep fixture IDs, reveal timing, and demo behavior out of frontend components. The same frontend boundary must support the scripted demo service and a future real agent backend without scenario-specific UI branches.

## Current implementation versus planned system

The frontend is currently a Next.js scaffold: `apps/web/app/page.tsx` is still the template placeholder. Product docs describe the intended experience and proposed contract. The Python fixture generator creates fictional records, but it is not an HTTP API, scan engine, durable workspace service, or agent orchestrator. No live investigation backend, agent runtime, deployment configuration, or project environment-variable contract is present yet.

Keep this distinction clear in code and documentation. Do not imply that the app currently scans real sites, uses an LLM, receives private provider data, or is deployed. Do not introduce real collection or offensive capabilities while implementing the fictional demo.

## Frontend stack and local commands

The app monorepo under `MANAA-AI/` uses npm workspaces and Turborepo, with Next.js `16.4.6`, React `19.3.1`, TypeScript, Tailwind CSS 4, and shared shadcn/ui components. Its `package.json` requires Node.js `>=20.9.0` and declares npm `11.19.1` as the package manager. Install from the monorepo root:

```sh
cd MANAA-AI
npm ci
npm run dev --workspace=web
```

The web app's package scripts are `dev`, `build`, `start`, `lint`, `format`, and `typecheck`. The monorepo root also provides Turborepo `build`, `dev`, `lint`, `format`, and `typecheck` scripts. There is no test script in the current root or web package manifest. No frontend/API environment variables are currently declared; inspect code and documentation before adding them. Keep secrets server-side, never in `NEXT_PUBLIC_*` variables, and never commit local `.env` files.

## Backend and future agent-runtime direction

Keep responsibilities separate:

- **Frontend:** render API DTOs, evidence, uncertainty, run state, and operator edits. It does not crawl, call agent tools, own fixture timing, or store provider credentials.
- **Demo backend (future implementation):** serve the deterministic fictional fixtures, persist the demo workspace, run the scripted reveal, and implement the same REST/SSE contract. Fixture generation alone does not provide this service.
- **Real API/orchestrator (future):** authenticate and authorize requests, persist workspace/run state, validate and enqueue scan jobs, and translate results into the same ticket and graph DTOs.
- **Agent workers (future):** run independently from the public web process. Use an external durable job queue for multiple workers/hosts, explicit concurrency and timeout limits, least-privilege service identities, health checks, and graceful shutdown. Treat public pages and returned content as untrusted input; do not execute captured page scripts, downloaded programs, or source text as shell commands. Any collection tools should be documented, allowlisted, and limited to authorized public sources.

For one or many self-hosted Linux VPSes, keep the web/API entry point separate from worker processes. Use one versioned release artifact and configuration schema across hosts; scale worker instances independently. Put secrets in a host secret store or encrypted deployment inventory, inject them at runtime, restrict inbound ports, terminate TLS at a maintained reverse proxy, and send logs/metrics to a central place without logging credentials or unnecessary source content.

A DigitalOcean Droplet is only an example topology: an Ubuntu LTS Droplet can host a containerized web/API edge behind Caddy or another maintained TLS proxy; a separate Droplet or pool can run isolated workers. Prefer managed PostgreSQL/object storage when available, and keep durable run state and artifacts outside ephemeral worker disks. Firewall the API/database/worker paths so only required service traffic is allowed. This is architecture guidance, not an approved deployment or a set of commands to provision infrastructure.

An optional general Ansible direction is to define reusable roles for base packages/hardening, container runtime, application release, secret injection, reverse proxy/TLS, and health checks. Keep inventories environment-specific, encrypt secrets with Ansible Vault or an equivalent, pin release images by digest, validate templates before rollout, and make service changes repeatable and reversible. Do not add an Ansible playbook or deploy anything unless the task explicitly asks for implementation.

## Change discipline

- Preserve unrelated staged, unstaged, and untracked work. Check the outer and nested repositories separately.
- Verify the actual package scripts and existing types before writing commands or setup steps.
- Keep the frontend/backend contract in `docs/FRONTEND-BACKEND-CONTRACT.md` authoritative for DTOs and routes; update dependent docs when a contract changes.
- Keep all visible demo evidence fictional, static, noninteractive, cited, and consistent with the casebook and generator.
- Do not claim tests, integrations, deployment, or real-world sourcing that have not been implemented and verified.
