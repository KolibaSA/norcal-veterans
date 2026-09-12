-- Request instructions remain on records; execution snapshots and results are durable.
CREATE TABLE request_runs (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES records(id),
  claim_token TEXT NOT NULL UNIQUE,
  request_version INTEGER NOT NULL,
  claimed_version INTEGER NOT NULL,
  snapshot TEXT NOT NULL CHECK(json_valid(snapshot)),
  state TEXT NOT NULL CHECK(state IN ('in_progress','completed','needs_input','cancelled')),
  claimed_at TEXT NOT NULL,
  finished_at TEXT,
  finish_mutation TEXT,
  report_sha256 TEXT,
  reconciled_by TEXT
);
CREATE UNIQUE INDEX idx_request_one_active_run ON request_runs(request_id) WHERE state='in_progress';
CREATE INDEX idx_request_runs_history ON request_runs(request_id,claimed_at);
CREATE TRIGGER request_run_snapshot_immutable BEFORE UPDATE OF id,request_id,claim_token,request_version,claimed_version,snapshot,claimed_at ON request_runs
BEGIN SELECT RAISE(ABORT,'Execution snapshots are immutable'); END;
CREATE TRIGGER request_run_no_delete BEFORE DELETE ON request_runs
BEGIN SELECT RAISE(ABORT,'Execution history is append-only'); END;
CREATE TRIGGER request_run_terminal_immutable BEFORE UPDATE ON request_runs WHEN OLD.state<>'in_progress'
BEGIN SELECT RAISE(ABORT,'Completed execution outcomes are immutable'); END;

CREATE TABLE request_entries (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES records(id),
  run_id TEXT REFERENCES request_runs(id),
  kind TEXT NOT NULL CHECK(kind IN ('comment','result','reconciliation')),
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 12000),
  actor TEXT NOT NULL,
  status TEXT,
  created_at TEXT NOT NULL,
  mutation_id TEXT NOT NULL UNIQUE
);
CREATE INDEX idx_request_entries_history ON request_entries(request_id,created_at);
CREATE TRIGGER request_entry_no_update BEFORE UPDATE ON request_entries
BEGIN SELECT RAISE(ABORT,'Request history is append-only'); END;
CREATE TRIGGER request_entry_no_delete BEFORE DELETE ON request_entries
BEGIN SELECT RAISE(ABORT,'Request history is append-only'); END;

CREATE TABLE hq_agent_health (
  id INTEGER PRIMARY KEY CHECK(id=1),
  last_successful_check TEXT,
  current_request_id TEXT,
  queued INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'unknown',
  last_error TEXT,
  last_error_at TEXT,
  updated_at TEXT NOT NULL
);
