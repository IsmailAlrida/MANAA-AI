# demo-api

Non-persistent demo backend for MANA'A, and the shared backend core (`src/index.ts`) that `apps/api` builds on. Its workspace lives in memory only, so every start is empty. It implements the v1 REST + SSE contract in [`docs/FRONTEND-BACKEND-CONTRACT.md`](../../docs/FRONTEND-BACKEND-CONTRACT.md) by replaying the **scripted fictional scenario** in [`demo/fixtures/generated`](../../demo/fixtures/generated). It does not scan anything, call an LLM, or make outbound requests. Its static fixtures include one assumed-authorized police API mock record with entirely synthetic person data; no real internal API is called.

## Run

```sh
npm ci                                      # once, from the repo root
npm run dev --workspace=demo-api            # API on http://127.0.0.1:4787/api/v1, restarts on change
npm run test --workspace=demo-api           # node:test, in-memory SQLite
npm run typecheck --workspace=demo-api
```

To see it in the UI, run web and this backend together from the repo root:

```sh
npm run dev
```

Requires Node ≥ 22.18. TypeScript runs natively through Node's type stripping, so there's no build step. That means `.ts` import extensions, no enums, and no parameter properties.

| Variable | Default | Meaning |
| --- | --- | --- |
| `DEMO_API_HOST` / `DEMO_API_PORT` | `127.0.0.1` / `4787` | Listen address. |
| `DEMO_FIXTURES_DIR` | `demo/fixtures/generated` | Scenario to replay. |
| `DEMO_STEP_MS` | `1500` | Delay between reveal steps. |
| `DEMO_CONTROLS` | on | `off` removes `POST /api/v1/demo/reset`. |
| `DEMO_CORS_ORIGIN` | unset | Allow a cross-origin frontend, e.g. `http://localhost:3000`. Prefer a same-origin proxy. |

## How the reveal works

`src/fixtures/plan.ts` turns the final fixture workspace and the evidence timeline into one **step per evidence item**. Each step upserts, in contract order:

1. the entities whose provenance gained that evidence;
2. the relationships whose cited evidence and endpoints now all exist;
3. the tickets whose visible view changed.

A ticket appears with its first evidence. It shows a collection-status note and only the evidence revealed so far, then switches to the full report once all of its evidence is in. The plan holds no scenario IDs, so a regenerated or replaced fixture replays the same way. Startup fails loudly if a fixture cannot be replayed consistently.

`src/runner.ts` commits one step per tick and publishes the committed records to open SSE streams. Run progress is stored, so a file-backed store (as used by `apps/api`) lets a restarted process resume a running scan where it stopped. This app itself never persists.

## Behaviour choices the contract left open

- **Run reuse:** `POST /runs` returns `202` for a new run. It returns `200` with the existing run when the `Idempotency-Key` repeats, or when the workspace already has a running, paused, or completed run. One scenario per workspace; use reset to replay.
- **Monitor controls:** `POST /monitor/pause` stops scheduling the next reveal, waits for any active reveal to commit and publish, then persists `paused`. `POST /monitor/resume` continues the same run at its stored cursor. These controls remain effective across browser disconnects and API restarts. The finite fixture ends at `complete`; this means the scenario replay is finished, not that a live data source is still being polled.
- **`run.status`** payload, which is also the `POST /runs` body: `{runId, status, progress: {completed, total}, error, createdAt, updatedAt}`. `status` is one of `running | paused | complete | failed`.
- **Snapshots** (`GET /workspace`, `GET /runs/{id}/snapshot`): `{workspaceId, entities, relationships, tickets, run}`. Every record carries its own `revision`.
- **SSE:** after subscribing, the stream immediately sends the current `run.status`, then all live upserts, including operator edits. A `: keepalive` comment goes out every 15 s, and the stream stays open after the run completes.
- **Tickets:** the backend owns `status`, `createdAt`, `updatedAt`, `history[] {at, kind, actor, note?, evidenceIds?}`, `finalWriteup` and `closedAt`. Scan updates never overwrite an operator-edited `closingDate` or a closed status. Fixture date-only closing dates become `YYYY-MM-DDT23:59:59+04:00`.
- **`PATCH /tickets/{id}`:** only `closingDate` (RFC 3339 with offset, or `null`). A missing `If-Match` returns `428`, a stale one `409` with `currentRevision`, other fields `422`. The response carries an `ETag`.
- **`POST /tickets/{id}/close`:** `finalWriteup` is required, 1–2000 characters after trimming. A repeated `Idempotency-Key` returns the closed ticket. Closing an already-closed ticket with a different key returns `409`.
- **`GET /assets/{evidenceId}`:** serves the static Markdown source card as `text/markdown` with `nosniff` and a sandbox CSP, and only once a ticket cites that evidence. It returns 404 before then.

## Storage: SQLite now, PostgreSQL by design

The demo persists to Node's built-in `node:sqlite` (`src/store/sqlite.ts`). The `Store` interface (`src/store/store.ts`) is written for the production shape: PostgreSQL shared by many API and worker processes appending evidence concurrently.

- Async, one transaction per call. Revisions are assigned by the store under a row lock, never by callers.
- Mutators run inside the transaction on the locked row. That is how scan-owned content and operator-owned fields merge without losing concurrent writes.
- Reveal steps are compare-and-set on the run's committed step count, so racing workers apply each step exactly once.
- Idempotency keys are written in the same transaction as the change they guard.

[`src/store/postgres-schema.sql`](src/store/postgres-schema.sql) has the equivalent tables, the locking/upsert pattern, and the `LISTEN/NOTIFY` fan-out that would replace the in-process bus (`src/bus.ts`) across processes. A PostgreSQL adapter is **not implemented yet**.
