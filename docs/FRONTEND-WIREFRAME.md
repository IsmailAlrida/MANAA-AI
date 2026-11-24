# Frontend wireframe sprint — design direction, state machines, packages

**Status:** 2026-11-24. Wireframe built from shadcn components only, wired to the proposed v1 contract ([FRONTEND-BACKEND-CONTRACT.md](FRONTEND-BACKEND-CONTRACT.md)). No demo backend exists yet; the UI was render-checked against a throwaway local stub that served `workspace.json` only.

## Design direction

| | |
| --- | --- |
| Purpose | Let an operator follow a backend-driven investigation, read evidence beside claims, and close campaign tickets with a short write-up. |
| Audience | Bilingual (EN/AR) operators presenting live on a laptop or desktop. They scan *what / who / strongest evidence / unknowns / what next* in about 10 seconds. |
| Tone | Calm, dense, quiet security-ops tool. White canvas, blue primary action, neutral layers. Severity color is used sparingly and never on its own: every badge carries a text label. |
| Memorable detail | Provenance treated as first-class content. Every claim, relationship and entity carries `EV-*` citation chips and an `observed` / `possible` / `disputed` support label, in the same visual weight as the data itself. |
| Constraints | Styling comes from shadcn components and `packages/ui/src/styles/globals.css` tokens. **Tailwind is limited to layout glue** (flex/gap/padding/height). No bespoke CSS this sprint. Logical properties and `dir` handle RTL. |

Anti-goals: no toast, bell or unread count; no "fake/simulated" badges in the UI; no hero sections; no cards inside cards.

## What was built

```
apps/web/
  app/page.tsx                          → redirect /network
  app/(workspace)/layout.tsx            WorkspaceProvider + WorkspaceShell
  app/(workspace)/network/page.tsx      Graph (force-directed dots + community bubbles) | Entities | Relationships + Inspector; the view is switched from the top bar
  app/(workspace)/tickets/page.tsx      Queue (search + all/open/overdue/closed filter with counts)
  app/(workspace)/tickets/[ticketId]    Detail replaces queue: report / evidence / entities / history,
                                        closing-date editor, close dialog
  components/shell/*                    Top bar (brand, Network/Tickets, Network view switch, Run scan,
                                        status, language, assistant) — no sidebar; agent-panel slot
  lib/api/types.ts                      zod DTOs (loose: unknown fields/kinds/blocks tolerated)
  lib/api/client.ts                     REST client, ApiError kinds, Idempotency-Key, If-Match
  lib/workspace/store.tsx               Context+reducer, SSE subscribe→snapshot→merge by id/revision
  lib/workspace/{merge,derive}.ts       monotonic upsert; derived overdue; queue filtering
  lib/machines/*.ts                     button/flow state machines (below)
  components/network/graph/*           force-directed SVG graph: dots, links, community bubbles (d3-force, d3-zoom, graphology)
  components/tickets/report-markdown    react-markdown + remark-gfm, no raw HTML, EV-* links → citation chips
  components/hint.tsx                   hover/focus label wrapper (Tooltip) used for explanations
  lib/i18n.tsx                          EN/AR dictionary, <html lang dir>, Intl date formatting
  next.config.ts                        /api/v1/* → $MANAA_API_ORIGIN rewrite (server-side env)
```

**Connecting the demo backend:** implement the contract routes, then run `MANAA_API_ORIGIN=http://localhost:<port> npm run dev --workspace=web`. The browser only ever calls same-origin `/api/v1/*`, so native `EventSource` with cookies works and the frontend never branches on demo vs. real.

## State machines

All machines are pure reducers in `lib/machines/`. Invalid events leave the state unchanged. Side effects run from `useEffect` keyed on the state. They can move to XState later without touching components.

- **Run scan** (`run-scan.ts`). A local request machine `idle → starting → idle | failed`. The visible button is *derived* from that plus the backend's run status: `loading | ready | starting | running(progress%) | complete ("Run new scan") | failed ("Retry scan")`. Reloading mid-run shows "Scanning" because the state comes from the snapshot, not client memory. A retry after a network failure reuses the same Idempotency-Key.
- **Connection** (`connection.ts`). `idle → connecting → syncing → live`, `live → reconnecting → syncing`, and `error` on server close or a failed snapshot. Each `open` triggers a snapshot fetch and merge, per the transport doc. It renders as a `role=status` text badge only.
- **Close ticket** (`close-ticket.ts`). `closed → editing → submitting → done → closed`, with `error` and retry. The write-up is required and trimmed (max 2000 characters). The idempotency key is minted when the dialog opens and reused across retries. The dialog can't be dismissed while submitting.
- **Closing date** (`closing-date.ts`). `viewing → picking → saving → viewing`. Failures go to `conflict` (409: reload, never auto-overwrite) or `error` (retry or cancel). PATCH sends `If-Match: "<revision>"`.

## Graph, report and hint conventions

- **Navigation:** one top bar holds everything: brand (hover shows the workspace), the Network and Tickets pages with an open-ticket count, and, on Network only, an icon switch for Graph / Entities / Relationships. The view is transient state in the workspace store. There is no sidebar and no tab bar inside the viewport.

- **No backend:** with no `MANAA_API_ORIGIN`, `app/api/v1/[...path]/route.ts` answers every request with a contract-shaped `503 backend_unavailable` instead of Next's HTML 404. When it's configured, the rewrite takes precedence over that dynamic route. The client treats network errors and 502/503/504 as **offline**: the shell, canvas and queue still render empty, and the header shows an "Offline" badge with a hover explanation and a Retry button. Run scan is disabled. Only other failures show the blocking error alert.
- **Canvas:** the graph is always mounted, whether loading, empty or offline, as an infinite pannable canvas with a faint dotted grid that moves with the camera. Loading and empty states float over it. The camera frames the graph once, when the first nodes arrive, leaving room for the legend.
- **Graph:** an honest relationship graph, not boxes with ports. Entities are dots, relationships are straight links (weight and colour by strength, dashed when not observed), and the layout comes from a force simulation over the data. Communities are detected from the relationships and drawn as bubbles. Existing dots keep their place when new data streams in, and the camera frames the graph once and then only moves when the operator pans or zooms (scroll pans, pinch or ctrl+scroll zooms). Hover or focus a dot to highlight its neighbourhood; select one to label its links. The canvas stays left-to-right in Arabic; labels use `unicode-bidi: plaintext`. With reduced motion the layout is settled without animation. React Flow and dagre were removed.
- **Report:** report-supplied images are not loaded. Links open with `noopener noreferrer nofollow`.
- **Icons/hints:** Tabler icons go on actions and tabs where the meaning is obvious. Icon-only buttons carry an `aria-label`, and the tooltip is supplementary. Badges that need explaining (support level, overdue, priority) are focusable and show a hover label. Disabled buttons sit inside a focusable span so their hover label still works.

## Testing

`npm test --workspace=web` runs Vitest (jsdom): merge-by-revision, the four state machines, the workspace store against a fake `EventSource` (subscribe-before-snapshot, stale snapshot never rolls back, refetch on reconnect, stream closes on a terminal run, malformed events ignored, offline handling, run-again), and incremental graph placement.

Step 1 was also checked with a scripted browser journey against a fresh `apps/demo-api` (own port and database). All 14 checks passed: a scan streams, the camera and first node never move after the first fit, no streamed nodes overlap, the run-again hint opens by itself, reload keeps the open ticket, a stale PATCH shows the reload prompt, and close persists across reload. That script is not in the repo yet; step 5 should turn it into the end-to-end suite.

Known trade-off: the camera frames the graph once, when the first node arrives, and never moves again (as the PRD requires). On a streaming scan, later nodes can therefore land partly off-screen until the operator presses the fit control. An alternative is to keep auto-framing until the operator first pans or zooms.

## Next steps

Order matters: step 1 de-risks the contract before the UI grows on it.

### Step 1 — Live demo flow against demo-api (done)

Wire and verify the whole operator journey against `apps/demo-api` (`npm run dev -- --demo`): Run scan reveals tickets and graph over SSE, reload resumes, closing-date edit and ticket close persist. Fix client/contract mismatches found.
Acceptance: a scan streams without moving the graph camera; reload keeps the open ticket; a stale PATCH shows the reload prompt.
Out of scope: node click interaction, new backend features.

### Step 2 — Assistant panel

Implement the assistant panel with `@assistant-ui/react`: streaming, cancel and error states, an offline scripted-response adapter so the demo works with no provider, and a small provider setup popup (key, model, base URL).
Acceptance: works with no provider; answers cite evidence IDs of the selected ticket; credentials are never persisted.
Out of scope: a server-side relay unless browser CORS blocks direct calls.

### Step 3 — Remaining report blocks and translation

Implement the `plot`, `comparison` and image-grid block renderers, and labeled translation shown beside the original-language evidence text.
Acceptance: unknown block kinds still render generically; plot points open the underlying transaction entities; Arabic and English source text are both visible with the translation labeled.
Out of scope: executing report-supplied HTML or scripts.

### Step 4 — Narrow-viewport layouts

Change the ticket queue to stacked cards below 768px and open the agent and inspector panels as drawers on narrow viewports, keeping the same information hierarchy.
Acceptance: no horizontal scroll at 390px; queue filters and scroll position survive opening a ticket; RTL mirrors correctly.
Out of scope: new pages or navigation.

### Step 5 — End-to-end tests

Add end-to-end tests for the 12-step operator journey in the PRD.

### Step 6 — Docs sync

Update the README and docs to match the built behaviour.

## Backlog

- **Node clicking / inspector interaction:** basic click-to-select and opening the inspector work, but the interaction design is deferred. That covers selection styling, keyboard selection on the canvas, focusing an entity from a ticket, and deselecting on pane click.

## Contract gaps found while wiring

1. **Priority + reason:** the PRD requires "priority is explainable", but neither the ticket DTO nor the fixtures carry it (risk score lives only inside the markdown). The types accept an optional `priority {level, reason, evidenceIds}`, and the queue shows `—` until the backend sends it.
2. **Ticket history / closure record:** the PRD and contract mention history, but the DTO has no field for it. The types accept optional `history[]` and `finalWriteup`.
3. **Workspace snapshot → active run:** `GET /workspace` needs to return the current `run` so a reload can resume streaming. The fixture lacks it.
4. **`POST /runs` body:** the main flow sends `{}`. Confirm the backend accepts a request with no `requestText`.
5. **409 body:** the client reads `error.currentRevision` if present. Add it to the error envelope.
6. **Summary:** the queue rows want a short evidence-based summary. The types accept an optional `summary`.

## Suggested npm packages (checked 2026-11-24)

Versions and licences come from `npm view`. All of these accept React 19 peers.

| Need | Package | Version | Why / note |
| --- | --- | --- | --- |
| Graph | **`d3`** (force, zoom, polygon, shape) + **`graphology`** + `graphology-communities-louvain` | 7.9 / 0.26 / 2.0 (ISC / MIT) | Force-directed dots, pan/zoom, and community detection, all rendered as plain SVG. Replaced React Flow, whose node-and-port model doesn't suit a relationship graph. |
| Safe report Markdown | **`react-markdown`** + **`remark-gfm`** | 10.1.0 / 4.0.1 (MIT) | No raw HTML by default. Map `[EV-…]` links to citation chips via `components`. Add `rehype-sanitize` (6.0.0) only if `rehype-raw` is ever enabled. |
| Charts | shadcn **`chart`** (Recharts 3.11) | MIT | Already in the shadcn registry; same tokens. Covers the monetary activity view. |
| Assistant | **`@assistant-ui/react`** | 0.15.38 (MIT) | Named in the PRD. Streaming, cancel and error states, plus a local runtime adapter for an offline scripted mode. |
| SSE with headers | `@microsoft/fetch-event-source` | 2.0.1 (MIT) | **Only if** bearer auth is needed. Same-origin cookies + native `EventSource` (current) need no dependency. |
| Data tables | `@tanstack/react-table` | 9.3.1 (MIT) | shadcn `data-table` pattern, for when the queue needs sorting/column visibility. |
| Forms | `react-hook-form` + `@hookform/resolvers` | 7.92 / 7.0.9 (MIT) | Pairs with shadcn `field` + existing `zod`. Overkill for one textarea today; adopt when the provider-setup form lands. |
| URL state | `nuqs` | 2.10.3 (MIT) | Puts queue filter/search and the selected entity in the URL so they survive reloads and can be shared. |
| State machines | `xstate` + `@xstate/react` | 5.33 / 6.1 (MIT) | Optional upgrade path for `lib/machines/*` (visualiser, actors). Current reducers are dependency-free. |
| i18n | `next-intl` | 4.16.1 (MIT) | Replace `lib/i18n.tsx` once messages grow. It handles plurals, number/currency formats and ICU. |
| Command palette | shadcn `command` (`cmdk`) | MIT | Jump to ticket/entity by ID. Nice for a live demo. |
| Motion | `motion` | 14.14 (MIT) | Defer. The PRD wants reduced motion, and `tw-animate-css` is already present. |

Not recommended now: TanStack Query (the PRD says not to add it only for push), Socket.IO, and force-graph libraries (`react-force-graph`, `reagraph`), which produce unstable layouts and hairballs.

## Render check (local, against a stub serving only `GET /workspace`)

| State | Result |
| --- | --- |
| Loading | Skeleton while the snapshot loads. |
| Empty | `Empty` + Run-scan CTA when there are no records (code path only; the stub always returns data). |
| Error | Workspace-load error `Alert` with Retry. Run-scan 503 → destructive "Retry scan" with a tooltip message (seen). |
| Partial | Unresolved entity/evidence references render as visible "Unresolved reference" chips. |
| Success | Close → ticket upserts as closed and shows the write-up (**untested**: stub has no close route). |
| Permission | 401/403 map to `ApiError("unauthorized")`. There's no dedicated UI yet (no auth in scope). |

Seen at 1440×900 (EN and AR, RTL sidebar and agent panel mirrored, back arrow flipped) and 390×844 (sidebar becomes a sheet; the queue table scrolls horizontally, so a card layout is still to do). The close dialog's empty-submit validation is driven by the machine. Untested: live SSE stream and reconnect, PATCH/close success paths, 409 conflict UI, keyboard-only walkthrough, reduced motion.
