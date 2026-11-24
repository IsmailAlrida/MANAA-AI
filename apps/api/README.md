# api

The investigation API behind `npm run dev`. It serves the v1 REST + SSE contract ([`docs/FRONTEND-BACKEND-CONTRACT.md`](../../docs/FRONTEND-BACKEND-CONTRACT.md)) on `http://127.0.0.1:4787/api/v1`.

```sh
npm run dev --workspace=api     # from the repo root
rm -rf apps/api/.data           # start over (stop the API first)
```

- **Core:** the HTTP app, store, runner and event bus come from [`apps/demo-api`](../demo-api/README.md) (`src/index.ts`).
- **Agent adapter:** `src/server.ts` wires `createFixtureAdapter`, a **stub** that replays the fictional fixtures and does no real investigation. A real agent integration implements `AgentAdapter` (`demo-api/src/adapter.ts`) and replaces that one line.
- **Persistence:** SQLite file, default `apps/api/.data/api.sqlite`. PostgreSQL is the planned store; the `Store` interface and `demo-api/src/store/postgres-schema.sql` are written for it, but no PostgreSQL adapter exists yet.
- **No demo reset route** unless `API_DEMO_RESET=on`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `API_HOST` / `API_PORT` | `127.0.0.1` / `4787` | Listen address. |
| `API_DB_PATH` | `apps/api/.data/api.sqlite` | Durable workspace. |
| `API_FIXTURES_DIR` | `demo/fixtures/generated` | Stub adapter input. |
| `API_STEP_MS` | `1500` | Delay between reveal steps. |
| `API_DEMO_RESET` | off | `on` enables `POST /api/v1/demo/reset`. |
| `API_CORS_ORIGIN` | unset | Allow a cross-origin frontend. |
