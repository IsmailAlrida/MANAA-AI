-- PostgreSQL target for the Store interface (src/store/store.ts).
-- Reference schema only: the demo runs on SQLite (src/store/sqlite.ts) and no
-- PostgreSQL adapter is implemented yet. Kept here so the Store contract is
-- designed against the multi-writer database it will eventually run on.

CREATE TABLE artifacts (
  ord        BIGSERIAL   NOT NULL UNIQUE,          -- first-insert order for snapshots
  kind       TEXT        NOT NULL CHECK (kind IN ('entity', 'relationship', 'ticket')),
  id         TEXT        NOT NULL,
  revision   BIGINT      NOT NULL CHECK (revision > 0),
  data       JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, id)
);

CREATE TABLE runs (
  run_id          TEXT        PRIMARY KEY,
  idempotency_key TEXT        UNIQUE,
  status          TEXT        NOT NULL CHECK (status IN ('running', 'paused', 'complete', 'failed', 'cancelled')),
  completed       INTEGER     NOT NULL,
  total           INTEGER     NOT NULL,
  error           JSONB,
  request_text    TEXT,
  created_at      TIMESTAMPTZ NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL
);
-- At most one running run per workspace (single-workspace demo).
CREATE UNIQUE INDEX runs_one_running ON runs (status) WHERE status = 'running';

CREATE TABLE idempotency_keys (
  scope      TEXT        NOT NULL,
  key        TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, key)
);

-- Write path per artifact, inside one READ COMMITTED transaction:
--   SELECT revision, data FROM artifacts WHERE kind = $1 AND id = $2 FOR UPDATE;
--   -- run the synchronous mutator on `data` in the application
--   INSERT INTO artifacts (kind, id, revision, data) VALUES ($1, $2, 1, $3)
--     ON CONFLICT (kind, id) DO UPDATE
--     SET revision = artifacts.revision + 1, data = EXCLUDED.data, updated_at = now()
--     RETURNING revision;
-- For a new row two writers can race past the SELECT; ON CONFLICT turns the
-- loser into an update, and the mutator is re-run on retry if the merge needs
-- the winner's content (SERIALIZABLE or an advisory lock on (kind, id) if so).
--
-- Reveal step CAS:
--   UPDATE runs SET completed = completed + 1, ... WHERE run_id = $1
--     AND completed = $2 AND status = 'running';  -- 0 rows → another worker won; roll back.
--
-- Fan-out across API processes: after COMMIT, NOTIFY manaa_updates with
-- {kind, id, revision}; each API process LISTENs, re-reads the row, and pushes
-- it to its SSE subscribers. Readers merge by (id, revision) so duplicate or
-- reordered notifications are harmless.
