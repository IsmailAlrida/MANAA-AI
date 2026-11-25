# Investigation API

This is the persistent REST/SSE API used by the managed dashboard launcher. It stores dashboard workspace state in a local SQLite file and selects one of two adapters:

- The managed `npm start` launcher sets `MANAA_MODE=engine`. A controlled Run scan invokes the fixed OSINT and police guest actions, reads the result from the host results service, and maps that synthetic result into the dashboard contract. The transfer handoff itself uses the host PostgreSQL services documented in [`infra/services.sh`](../../infra/services.sh).
- `npm run dev --workspace=api` defaults to fixture mode and replays the fictional scenario from `demo/fixtures/generated`. This is useful for frontend development without VMs or PostgreSQL.

The engine mode currently accepts only the controlled UAE brand review request. It does not run general discovery, call an LLM, access a real police API, or establish wrongdoing. All controlled evidence is synthetic.

## Run

For the full host, VM, PostgreSQL, and dashboard lifecycle, use the [root README](../../README.md). For fixture mode alone:

```sh
npm ci                         # once, from repository root
npm run dev --workspace=api
```

The API listens on `127.0.0.1:4787/api/v1`. Run the web app alongside it with `npm run dev` from the root. Use `npm run dev:demo` for the separate non-persistent fixture backend.

| Variable                 | Default                             | Meaning                                                                                              |
| ------------------------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `API_HOST` / `API_PORT`  | `127.0.0.1` / `4787`                | App API listener.                                                                                    |
| `API_DB_PATH`            | `apps/api/.data/api.sqlite`         | Persistent dashboard workspace state. This SQLite file is separate from PostgreSQL transfer storage. |
| `API_FIXTURES_DIR`       | `demo/fixtures/generated`           | Fixture-mode scenario.                                                                               |
| `API_STEP_MS`            | `1500`                              | Fixture reveal delay.                                                                                |
| `API_DEMO_RESET`         | off                                 | Set to `on` to enable the fixture-only reset route.                                                  |
| `MANAA_MODE`             | `fixtures`                          | Set to `engine` to use the controlled guest adapter; the managed launcher sets this.                 |
| `MANAA_GUEST_EXEC_PATH`  | `infra/guest-exec.sh`               | Fixed host-to-guest action wrapper.                                                                  |
| `MANAA_RESULTS_HTTP_URL` | `http://10.77.20.1:8083/v1/results` | Host results API base URL.                                                                           |
