# MANA'A Security Operations Demo — Frozen Product and API Contract

**Status:** Product intent and proposed frontend/backend contract frozen for implementation.  
**Product:** MANA'A / مناعة — an investigation dashboard for a fictional UAE cyber-fraud operation.  
**Audience:** English- and Arabic-speaking operators presenting the investigation on laptop or desktop.  
**Frontend base:** the existing shadcn/ui and Next.js monorepo in `MANAA-AI/`.  
**Backend contract:** a versioned public frontend API defined in this plan. The contract is proposed here for both demo and future real backends; it is not an existing or implemented service.

## Judging criteria (verbatim)

These are the competition requirements. Preserve the wording verbatim in planning and evaluation; the detailed scenario/evidence design is in [`FICTIONAL-CASEBOOK.md`](FICTIONAL-CASEBOOK.md).

1. Detection accuracy: preciosion adn recall on a hiddne test set of fraud and leigitamee URLS. flase psotoiove sare kept low so banks and governments arent flagged. resists evasion sich as redirects, URL shortners, and cloaking
2. Early detection and coverage: catches threats before they report them. e.g by watching newley registered domains, look alike domains and fresh ads. covers both search engine results nad maps listings.
3. Explainiability and aciton: each flag has a risk score with clear reasons. output is ready to uise as a police eviedence (screenshots, WHOIS and hosting data, timestamps, etc...) can be xported for takedown
4. UAE relevance and innovation: Hnadles arabic and bilingual content and impresonation of local brands (uae banks, tamm, uae pass, traffice fine payments, etc..). Uses a novel technique, e.g. visual page similarity, LLM-based analysis or linking scam domains as a network.

## 1. Product promise

Build a polished, calm, white-and-blue security operations interface that makes a complex investigation understandable at a glance and credible during a live walkthrough. It should let an operator follow an investigation, inspect how evidence supports campaign-level cases, decide what to do, leave the dashboard to coordinate real-world action, and return later to record a concise closure note.

The frontend is a real API client from its first implementation. Its ordinary data source is an opaque service behind a stable versioned contract. The service returns two domain output families: **individual campaign tickets** (with their reports and evidence references) and **graph entities and relationships**. The frontend must not import demo fixtures, own scripted scan timing, or contain scenario-specific presentation branches. It renders the domain objects and accepts transport/run metadata from the API.

For the demo, a separate demo backend implements the same contract as the future agent backend. It owns the fictional dataset, event timing, run progression, persistence, and API behavior. Replacing it with a real service means changing backend deployment/configuration, not teaching the frontend a second data model. This document proposes that contract; it does not claim a backend already exists or that a real agent service has agreed to it.

The README owns the disclosure that the current demo backend uses a scripted fictional scenario. The operator-facing UI should feel like the intended product and focus on the investigation. Do not plaster Wizard of Oz, fake, mock, simulated, synthetic, or test-data disclaimers across operational screens or individual graph nodes. The evidence itself must retain source, capture time, language, provenance, and uncertainty as ordinary investigation content. Do not invent provenance or certainty to make the story more convincing.

A visitor should be able to answer these questions in about ten seconds, in this order:

1. **What is happening?** Name the campaign and concise threat pattern.
2. **Who or what is implicated?** Show relevant people, organization, accounts, domains, and channels with uncertainty visible.
3. **What is the strongest evidence?** Put useful source material beside the claim it supports.
4. **What remains unknown?** Show gaps and confidence without implying guilt from association.
5. **What happened next?** Preserve operator decisions, external follow-up, and final disposition.

The report is authored freely by the hypothetical air-gapped reporting orchestrator from the evidence available in the investigation. It is not assembled from a mandatory set of AI-generated prose fields. The frontend renders a flexible, versioned document with a small set of safe typed block formats.

## 2. Frozen product scope

### Exactly two primary pages

1. **Network** — the campaign graph and a compact monetary activity view.
2. **Tickets** — the campaign-level case queue. Selecting a ticket replaces the queue in the same central viewport with its report/detail view; it does not create a third primary page.

A proper shadcn sidebar provides navigation and a small amount of current-workspace context. The graph is the main investigation surface. Ticket evidence and report content can open beside it in a resizable panel while the operator inspects Network. Do not render the entire graph, a full ticket board, and a full report as three competing primary screens at once. A board is a focused Tickets mode, not an always-visible third column.

### Panels and navigation

- Use the scaffold's shadcn sidebar pattern for main navigation.
- Panels resize within sensible minimum/maximum widths and can collapse, close, and restore without losing selection.
- At most two secondary sidebars may be open at once. English defaults: agent/chat on the right and optional context/evidence on the left. Arabic mirrors the primary agent panel to the left; omit the opposite panel rather than crowding the screen.
- Ticket detail occupies the same central viewport as the queue. Provide a clear return-to-queue affordance and preserve queue filters/scroll position.
- On smaller screens, panels become drawers or stacked regions with the same information hierarchy. Laptop/desktop is the design target.

### Investigation and operator journey

This numbered journey is the behavioral contract:

1. The operator opens the app and sees the active workspace and current open work.
2. They press **Run scan**. No URL entry is required for the principal story.
3. The backend begins the investigation and streams updates while its future agent service examines websites and social media. The UI consumes tickets, graph updates, and run metadata from the API.
4. Campaign tickets appear progressively as evidence is available.
5. The operator opens a ticket.
6. They read its report and evidence, including source provenance, competing hypotheses, and uncertainty.
7. They decide whether the case represents a threat or no threat. This is an operator decision; the app does not require a selector or a recorded judgment before they continue.
8. If it is a threat, the operator leaves the app and alerts colleagues to coordinate a raid. This action happens outside this product; the UI does not claim to alert police or colleagues.
9. The raid or other real-world response happens outside the app. Keep the ticket open during this activity.
10. The operator returns to the app later.
11. The app loads the same active work from the backend; the ticket is still open with its evidence and prior ticket history.
12. They close the ticket with one required, small free-text final writeup. It can say a raid/takedown occurred or that the lead was a false positive/dismissed; no mandatory disposition dropdown or referral workflow.

Refresh and navigation must not silently erase the operator's work. The demo backend persists the workspace and investigation state so the return journey is real through the frontend API. **Run scan** starts a run through the service; reload resumes persisted work. If an implementation offers a fresh scenario, make it a new scan/workspace action with clear meaning. Dataset reset, clock advance, and fixture reseeding are developer/demo-backend controls, not ordinary operator navigation. A refresh is never a reset.

### Ticket priority, dates, and lifecycle

- A ticket represents a campaign/investigation, not an individual post or URL.
- The service may propose a review or closing date. The operator can edit it through the frontend and API.
- Priority is explainable from evidence of growing harm, such as rising transaction volume, new victims, or increasing activity. Show the reason and underlying evidence/time range; do not present an unexplained score.
- An open ticket past its closing date displays as **overdue**, a derived view state. It remains open until the operator closes it.
- **Closed** means archived/resolved in this workflow. Preserve the ticket and final writeup in history.
- Reopen behavior is not required. If added later, preserve the prior close event and record an explicit reopen event.

## 3. Proposed public API contract (version 1)

The frontend consumes a single versioned API from its first implementation. The detailed proposed endpoint, DTO, event, and recovery contract is maintained in [`FRONTEND-BACKEND-CONTRACT.md`](FRONTEND-BACKEND-CONTRACT.md); this plan freezes the product-level boundary and required semantics. Both documents describe a proposed contract, not an existing service or an already-agreed real backend. Keep them aligned as implementation choices are refined.

The boundary has exactly two domain output families:

1. **Campaign tickets.** Each is an individual campaign-level investigation with its report, evidence references, related graph IDs, and operator history within the ticket payload. Reports use a versioned document format with Markdown and typed evidence/plot/comparison blocks.
2. **Investigation graph.** Typed entities and relationships with stable IDs, evidence references, source provenance, observed/inferred support, and uncertainty. Entity kinds include people, companies, websites/URLs, links, ads, social posts/accounts, servers, bank accounts, and money transactions. Transaction/account records are authoritative for financial plots.

Run lifecycle, progress, errors, and connectivity are operational metadata, not another domain output family. Object revisions support merging records but are not a separate output family. The only domain update events are ticket upserts and graph entity/relationship upserts. The frontend must not expect a separate finding, evidence-feed, or chart-data domain stream. Evidence and report content travel in ticket blocks/references; graph facts and transaction data travel in graph entities/relationships. A scoped artifact/source link may resolve bytes referenced by those records but does not create a third finding family.

The proposed transport uses REST snapshots/mutations plus SSE for one-way backend-to-browser updates. The demo service should use its server framework’s existing SSE support (Hono `streamSSE()` if Hono is chosen); the browser uses native `EventSource` for same-origin cookie auth, or `@microsoft/fetch-event-source` only if custom headers/reconnect hooks are needed. It covers workspace resume, starting a run, receiving backend updates, editing the proposed closing date, closing a ticket with a required final writeup, and explicit demo-only reset. See the linked technical contract for canonical routes and exact fields. The main **Run scan** flow does not require a URL. Subscribe first, then fetch and merge a REST workspace snapshot on each stream open/reconnect; merge records by stable ID and monotonic object revision. Do not build a durable event log, custom cursor/replay framework, async message broker, or in-app notification UI.

Ticket lifecycle is `open` or `closed`; closed means archived/retained in the product queue. A proposed closing date may be edited by the operator. Overdue is derived when an open ticket's effective closing date has passed, and does not change its lifecycle. The close operation appends a closure record and requires one non-empty, short free-text writeup. There is no required outcome selector or referral workflow.

The demo service and future agent service implement this same contract. The demo service owns scripted timing, fictional scenario records, persistence, source artifacts, and reset/reseed controls; the frontend API client and components remain neutral. Reset is an explicit demo-backend control outside ordinary operator navigation. The real backend can replace the demo service without a frontend-specific scenario model.

## 4. Information architecture and screen contracts

### Shared shell

- Product identity, current workspace, and **Run scan** with current run status.
- Primary navigation limited to **Network** and **Tickets**.
- Language control for English / العربية and direction-aware layout.
- Compact accessible agent/chat launcher and optional provider setup.
- Operational status labels describe meaningful API states (connecting, running, complete, failed, reconnecting), not the backend's implementation technique.

### Network page

The graph is the main spatial view. Support pan, zoom, fit-to-content, keyboard-accessible selection/list alternatives, and stable node placement. Selecting an entity opens a compact inspector with identity, type, claims, evidence references, and relationships. Clicking a citation opens its source/report block and preserves graph context.

Entity types include **People, Companies, Bank accounts, Transactions, Websites, Links/URLs, Ads, Social media posts, Social accounts, and Servers**. Bank accounts can link victims/customers to suspected beneficiaries and other accounts only when evidence supports the link. Make edge labels and evidential basis legible; distinguish observed facts from inferred or possible relationships. Graph membership, shared servers, or proximity alone do not establish culpability.

Avoid an unreadable hairball. Show a useful campaign subgraph with sensible grouping/filters. Represent account-to-account flow with a directional aggregated edge by period, amount, and currency; allow expansion to individual transaction records. Do not add values across currencies without explicit conversion provenance. The monetary chart and graph read the same transaction entities. A chart point opens underlying transactions and exposes units, date range, and currency. Streamed updates preserve positions and never yank the camera or steal focus from a report.

### Tickets queue and detail

The queue supports search/filter and clear open, overdue, and closed status. Each campaign-level row/card shows concise title, status, priority and reason, closing date, and short evidence-based summary. Selecting a ticket replaces the queue with report/detail in the central viewport; returning restores queue state.

Ticket detail keeps the report readable and scannable: title/status, why it matters, strongest evidence, uncertainties, investigation/history timeline, related entities, and editable proposed closing date. Source citations are actionable and preserve original language. Operator actions are modest and explicit: edit the proposed closing date and close with the required small final writeup. Keep the ticket open during external action; do not imply that the product performed it.

### Flexible report document

Use a versioned, typed, discriminated block model rather than executable HTML or fixed AI prose fields. A report combines ordinary Markdown text and links with custom blocks for image comparisons/grids, plots/charts, facts tables, evidence/source cards, timelines, and related-entity summaries. Every factual claim and block retains evidence references. A plot drills into the underlying transaction entities. Render safe Markdown and validated block types; never evaluate report-provided HTML or scripts. Preserve original Arabic/English evidence text separately from translated narrative. Label translation without replacing the original.

## 5. Scenario content and evidence requirements

### Story shape

The proactive run discovers four separate tickets through public-source captures: (1) an organic-search TAMM typo-squat result and archived bilingual page, linked by a matching host/project reference in Cedar Spire's public portfolio; (2) a LinkedIn-style AED 20,000/month job post with vague duties and a public advertiser disclosure naming Cedar Spire; (3) a marketplace seller/licence mismatch linked by public marketplace terms to Dune Fulfilment, then by an independent public directory to Cedar Spire's Cedar Select programme; and (4) a Maps-style recovery listing linked through archived site terms to Dune Fulfilment and the same independent directory. See [`FICTIONAL-CASEBOOK.md`](FICTIONAL-CASEBOOK.md) for fixed IDs, evidence, scores, and reveal sequence. All links are public-record associations; they do not establish personal involvement, intent, completed transactions, or wrongdoing.

Treat each ticket as a distinct finding. Do not merge the four campaigns into one vague accusation. Relationships must cite the public evidence that supports them and retain uncertainty. The marketplace licence mismatch, AED 20,000/month salary, vague job duties, and recovery fee are review signals, not findings of fraud. No victims, customer-loss destinations, complaints, or transaction records are part of this fixture. Do not infer culpability from a public business relationship or directory entry. This visible story does not include a separate benign-control set or claim to measure false-positive rates.

Make evidence ready for a hypothetical review export: cited static cards, capture timestamps, source references, and provenance for the public records available in the fixture. Do not imply that private WHOIS, hosting, account, financial, or law-enforcement records are available. The export is a report artifact, not a claim of legal admissibility or chain-of-custody validation.

Evidence artifacts are descriptive, static, and nonfunctional. Never implement a working credential/payment/recovery form, authentication impersonation flow, redirect, cloaking behavior, or operational instructions for evasion. Do not exactly clone a proprietary government, bank, LinkedIn, or Maps interface. Use original stylized capture cards and synthetic `.test` hostnames. Store Arabic and English source text separately and show the original beside any labeled translation.

### Fixture scale and source policy

Keep the initial world small enough to explain: four campaign tickets, two fictional organizations (Cedar Spire and Dune Fulfilment), public portfolio and advertiser disclosures, a marketplace seller/licence mismatch, marketplace fulfilment terms, an independent public business directory, and a Maps-style listing with archived service terms. The proactive scan and reveal use only public-source-style static captures. No manual dependency, private provider return, financial record, customer transaction, complaint, or later case-file import exists in this scenario. Stable IDs and source references are set in the casebook and generated outside frontend components by the demo backend. Use reserved `.test` references and fictional organization names.

Transaction and financial-chart capabilities remain part of the general API contract, but this four-ticket public-OSINT scenario emits no transactions or financial totals. Fixture scores are story examples only; they are not performance metrics or a hidden fraud/legitimate URL evaluation set. Accuracy, precision, recall, and false-positive claims require separately labeled backend evaluation against that hidden test set.

### Provenance and uncertainty

Every object has a stable ID and revision. Claims and relationships carry source evidence IDs, kind, uncertainty/confidence or an explicit unknown/under-review state, and short basis. Evidence records include source type/label, captured URL or source locator, observed/capture timestamp, original text/media reference, language, and provenance metadata. Transactions are separately addressable entities, not numbers embedded only in charts. Tickets, reports, graph, chart, and chat cite the same IDs. The UI presents provenance and uncertainty as substantive investigative information, not as a synthetic-data marker.

## 6. Frontend API client and backend boundary

The frontend has a typed API client with operations corresponding to the public contract: resume the workspace, start a run, subscribe to backend updates, fetch/merge the current snapshot on connect or reconnect, edit the proposed closing date, and close a ticket. Evidence/artifacts are read through references and backend-provided asset URLs carried in ticket/graph payloads. UI state is derived from API responses/events plus transient view state (selection, filters, panel widths, locale). Domain state and persisted operator changes come from the service.

Pages/components consume typed tickets and graph updates. They do not import scenario fixtures, know scan event timing, choose which evidence arrives next, construct transaction totals from story-specific constants, or branch on fictional entity names. Chart aggregation uses typed transaction entities or service-provided aggregates with units/currency and underlying IDs. If a future backend changes its internal agents or data stores while honoring the public contract, the frontend remains unchanged.

The demo backend is a separate service process/module with the same API surface. It owns the scripted scenario, run timing, persistent store, source artifacts, and ticket/graph update generation. Its deterministic scenario enables repeatable presentations and manual checks. It may use local fixtures internally; those fixtures never cross the boundary as imports into the frontend. An explicit demo reset/reseed/clock control can support rehearsal and acceptance checks; it is separate from ordinary operator navigation and unavailable on a real backend unless authorized.

The future real agent backend replaces the demo service behind the API endpoint and maps actual agent findings into the same ticket/graph contract. No part of this plan asserts the future backend is available or that its internal architecture is fixed. Do not put demo-vs-real branching in the frontend; environment configuration selects an API base URL/service implementation.

## 7. Optional live assistant

Chat is an optional, separate integration, not a source of investigation events. Use assistant-ui for a compact streaming surface if it fits the scaffold. It answers from the selected ticket and evidence available to the current workspace; it must not claim to know unrevealed facts or invent citations. Display citations using evidence IDs and scope context when ticket selection changes. Include streaming, cancellation, provider error, and unavailable states. An offline scripted-response adapter is recommended so the walkthrough works without a provider.

Offer a small provider setup popup for API key, model, and base URL where appropriate. Keep multiprovider support behind an adapter; do not promise all providers work identically in browsers. Keep secrets out of source, fixtures, browser logs, and persistent local storage. If direct browser calls expose credentials or fail due to CORS, use a minimal server-side relay with an explicit provider adapter. Chat uses the ticket/evidence API and is isolated from scan lifecycle and demo event timing.

## 8. English, Arabic, accessibility, and visual direction

English and Arabic are complete supported directions. Arabic sets `dir="rtl"` at the document/application boundary and mirrors navigation, panel placement, alignment, and directional icons. Use CSS logical properties. Keep source text and translated narrative separate. Both languages cover all labels, empty/running/detail/close/error states, dialogs, help, and accessible names.

Keep evidence readable with adequate type size, contrast, and spacing. Do not rely on red/green alone for status. Keyboard support covers panels, graph actions, ticket queue/detail, dialogs, and chat. Provide visible focus, semantic landmarks, accessible status text in the current run view, chart/graph alternatives through data tables/entity lists, and reduced motion. Do not add toast, bell, unread-count, or other in-app notification surfaces. Format dates and numbers by locale; never combine currencies without conversion provenance.

Use a restrained white canvas, layered neutral surfaces, clear blue primary actions, subtle blue/gray graph edges, and sparing severity color. Establish a strong title and concise case summary, then let graph and evidence carry visual weight. Reuse scaffold shadcn components and tokens before inventing parallel primitives. Existing tokens are in `MANAA-AI/packages/ui/src/styles/globals.css`; preserve current user edits when implementation begins. Responsive and RTL behavior belong to the interaction contract, not final polish.

## 9. Proposed implementation boundaries

Keep the frontend and backend separate from the outset, even if both are developed in the same monorepo:

- **shared API contract/types:** versioned JSON schemas, update types, stable IDs, error shapes, and report block schemas;
- **frontend API client:** REST snapshots/mutations plus SSE through existing server/client libraries; subscribe-first snapshot merge on connect/reconnect; conditional mutation handling. Do not add TanStack Query solely for push delivery; use the existing workspace state layer;
- **frontend domain/view state:** selected workspace/run/ticket, queue filters, panel state, locale, optimistic/transient UI state;
- **frontend pages/components:** shared sidebar, Network graph, Tickets queue/detail, report renderer, source viewer, optional panels;
- **demo backend:** API routes, scripted event timing, scenario fixture storage, explicit reset/clock controls, persistent workspace/ticket/graph state, source artifact resolution;
- **future agent backend adapter:** maps real findings into the same ticket and graph contract without changing frontend components;
- **assistant adapter:** optional provider and offline chat, independent of investigation stream;
- **i18n/formatting:** complete translations, direction, dates, numbers, and currency.

The existing monorepo contains `MANAA-AI/apps/web` and shared packages including `MANAA-AI/packages/ui`. Use those workspaces and components; do not create a second frontend at the outer repository root. Use the relevant Next.js package docs referenced by `MANAA-AI/AGENTS.md` before changing code. This plan does not authorize implementation in this turn.

## 10. Acceptance contract

A later implementation is ready for a live demo when all are true:

- There are exactly two main pages, Network and Tickets; ticket detail replaces the queue in the same viewport.
- The complete 1–12 operator journey works, including leaving and returning to the still-open ticket and closing it with one required short free-text note.
- The frontend talks to the versioned API from day one; demo backend and future backend implement the same contract.
- Frontend components contain no scenario fixture imports, event schedules, or branches based on demo identities. Scan progression is owned by the backend and delivered over the API.
- API output contains only the ticket and graph domain families; run status is transport metadata. Reports and evidence references are carried by tickets; cited source/artifacts resolve through references and backend-provided asset URLs.
- Start scan requires no URL for the main story. The frontend does not claim to perform website crawling or agent orchestration itself.
- The graph contains all specified entity families, including first-class bank accounts and transactions; claims and cross-operation links cite evidence; uncertainty is visible; chart points drill into the same transaction data.
- Priority is explained by evidence of growing harm; closing date is editable; overdue is derived while the case remains open; close preserves history and final writeup.
- Report supports freeform text and typed blocks, safe rendering, source citations, original language, and labeled translation.
- English and Arabic work end to end with proper RTL mirroring, keyboard support, graph/table alternatives, responsive panels, and reduced motion.
- Stream updates do not steal graph focus, camera position, ticket scroll, or current reading context.
- Reload/reconnect resumes persisted active work through REST snapshots and SSE updates. The client merges by stable IDs/revisions without a custom event log or replay layer. Demo reset/reseed remains an explicit backend/demo control.
- Optional chat streams/fails gracefully, stays scoped to evidence, and never exposes provider credentials. The core walkthrough works without chat or network access to a model.

## 11. Suggested manual walkthrough checks

These are future implementation acceptance checks, not work performed as part of this document update:

1. Open workspace → Run scan → observe backend stream → open campaign ticket → inspect evidence/citations → decide → leave/reload → confirm ticket remains open → close with short final writeup.
2. Rehearse by using the demo backend's explicit reset control, then starting a new run; confirm stable IDs, deterministic event order, graph layout, counts, and chart totals.
3. Disconnect/reconnect during the stream; verify the existing SSE client reconnects, fetches a current REST snapshot, and merges it without gaps or stale overwrites.
4. Deliver updates around reconnect/snapshot timing; verify object revisions prevent stale snapshot data from rolling back newer streamed records.
5. Select a transaction trend point and verify account path, individual records, currency, timestamps, and source evidence agree.
6. Open a report while events arrive; verify no camera/scroll/focus jump and updates do not force navigation.
7. Switch to Arabic across Network, queue, detail, date editor, close flow, and chat; verify true RTL and legible original evidence.
8. Load at laptop width and a narrower viewport; resize/collapse panels and confirm both primary pages and ticket actions remain usable.
9. Advance the demo backend's controlled clock past a closing date; confirm an open ticket displays overdue and remains open until closed.
10. Use chat with no provider, valid streaming, cancellation, and provider error; verify investigation data is unaffected.

## 12. Safe repository migration and documentation

The current checkout has an outer repository and a nested `MANAA-AI/` scaffold with its own Git metadata, alongside outer files such as `README.MD.md` and `index.html`. The nested scaffold is presently untracked from the outer repository's perspective. **Do not flatten or move the scaffold as part of this plan update.** Before a later move, inspect both repositories' branches, remotes, histories, ignored/untracked files, worktrees, and statuses. Make a recoverable copy/branch first. Agree which history is authoritative and preserve both useful histories (for example by retaining nested history as a related/merged history or documenting it) rather than deleting either `.git` directory casually. Move files with a collision inventory and preserve content; compare checksums/diffs before removing duplicates.

Keep outer `README.MD.md`, root `index.html`, and existing assets unless a reviewed migration explicitly incorporates them. Preserve user edits in `MANAA-AI/packages/ui/src/styles/globals.css` and any other dirty/ignored files. Never overwrite a destination merely because its name matches; reconcile content first. After a future flattening, verify workspace scripts, imports, paths, history visibility, and both repository statuses/diffs. No scaffold files or histories are moved by this documentation task.

The older exploratory draft in the separate lowercase checkout at `/home/alrida-ismail/github/manaa/demo/PLAN.md` and adjacent types/README are superseded for product behavior by this freeze. Earlier single-URL start, three-primary-screen composition, mandatory outcome selector, referral-style ending, and two-campaign-only scenario are not accepted. Do not copy those behaviors into implementation. Update/archive those artifacts only in a later explicitly scoped pass.

The README is the home for a plain disclosure that the demo backend returns a scripted fictional scenario, uses fixture-backed data, and may optionally support live chat. Explain what works through the real frontend API and what is represented by the demo service. Keep that implementation disclosure in the README/onboarding documentation; do not repeat fake/simulation disclaimers in operational UI, reports, graph labels, or evidence. Future design references may include empty/populated Network, four-ticket queue, report comparison, closure note, and Arabic RTL states. Do not create those images until implementation or a direct request.

## 13. Frozen versus proposed details

Frozen product behavior includes the verbatim judging criteria above; four separate campaign tickets; the two-page Network/Tickets structure; operator journey and return; evidence-first graph/report; English/Arabic RTL; editable deadlines; operator-owned ticket lifecycle; two domain output families; and a frontend that consumes a versioned API from day one. This plan defines a proposed v1 contract for both demo and future backend implementations; it is not an assertion that an existing backend already conforms. Exact API enum values, schema validators, fixture names/counts/values, event timings, panel widths, colors, and optional reopen behavior can be refined while preserving the contract's boundary and semantics. No frontend implementation, backend, image generation, or tests are performed by this plan revision.
