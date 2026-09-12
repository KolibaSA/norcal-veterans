CREATE TABLE record_revisions (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL,
  snapshot TEXT NOT NULL,
  UNIQUE(record_id, version)
);
CREATE INDEX idx_record_revisions_record ON record_revisions(record_id, version DESC);

-- Preserve the starting state before any future edit. Payload remains JSON text
-- inside the snapshot so even a malformed historical payload can be recovered.
INSERT INTO record_revisions(id,record_id,version,actor,action,created_at,snapshot)
SELECT 'baseline-' || id,id,version,'NorCal HQ migration','baseline',datetime('now'),
  json_object('id',id,'kind',kind,'title',title,'body',body,'region_id',region_id,
    'organization_id',organization_id,'status',status,'payload',payload,
    'created_by',created_by,'created_at',created_at,'updated_at',updated_at,'version',version)
FROM records;

-- All application and agent mutations are audited in the same transaction.
-- Failed or stale mutations produce no audit event and therefore no revision.
CREATE TRIGGER record_revision_on_audit AFTER INSERT ON audit BEGIN
  INSERT OR IGNORE INTO record_revisions(id,record_id,version,actor,action,created_at,snapshot)
  SELECT NEW.id,r.id,r.version,NEW.actor,NEW.action,NEW.created_at,
    json_object('id',r.id,'kind',r.kind,'title',r.title,'body',r.body,'region_id',r.region_id,
      'organization_id',r.organization_id,'status',r.status,'payload',r.payload,
      'created_by',r.created_by,'created_at',r.created_at,'updated_at',r.updated_at,'version',r.version)
  FROM records r WHERE r.id=NEW.record_id;
END;

CREATE TRIGGER record_revision_no_update BEFORE UPDATE ON record_revisions
BEGIN SELECT RAISE(ABORT,'Record revisions are immutable'); END;
CREATE TRIGGER record_revision_no_delete BEFORE DELETE ON record_revisions
BEGIN SELECT RAISE(ABORT,'Record revision history is append-only'); END;
