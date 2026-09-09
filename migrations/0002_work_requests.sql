-- Authenticated editor work is separate from unverified public submissions.
CREATE TABLE IF NOT EXISTS work_requests (
 id TEXT PRIMARY KEY, target TEXT NOT NULL CHECK(target IN ('website','headquarters','decide')),
 title TEXT NOT NULL, details TEXT NOT NULL, requested_by TEXT NOT NULL, last_actor TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','in_progress','needs_input','done','cancelled')),
 result TEXT NOT NULL DEFAULT '', suggestion TEXT NOT NULL DEFAULT '', result_url TEXT NOT NULL DEFAULT '',
 version INTEGER NOT NULL DEFAULT 1, claim_token TEXT, claim_until TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 CHECK(status!='needs_input' OR length(trim(suggestion))>0),
 CHECK(status!='done' OR length(trim(result))>0)
);
CREATE INDEX IF NOT EXISTS work_requests_queue ON work_requests(status,created_at);
CREATE TABLE IF NOT EXISTS work_request_messages (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES work_requests(id),
 actor TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('request','update','question','approval','reply','completed','system')),
 body TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS work_messages_request ON work_request_messages(request_id,created_at);
CREATE TABLE IF NOT EXISTS request_processor (
 id TEXT PRIMARY KEY CHECK(id='main'), mode TEXT NOT NULL DEFAULT 'setup',
 last_checked_at TEXT, last_activity_at TEXT, active_until TEXT, next_check_at TEXT,
 automation_id TEXT, lock_token TEXT, lock_until TEXT,
 note TEXT NOT NULL DEFAULT 'Request processing is being connected.'
);
INSERT OR IGNORE INTO request_processor(id) VALUES ('main');
-- Preserve previously authenticated HQ requests without promoting public intake.
INSERT OR IGNORE INTO work_requests(id,target,title,details,requested_by,last_actor,status,created_at,updated_at)
 SELECT r.id,'decide',r.title,r.details,a.actor,a.actor,'queued',r.created_at,r.updated_at
 FROM requests r JOIN audit a ON a.record_id=r.id AND a.action='request_create'
 WHERE lower(a.actor) IN ('smartzgraphics@yahoo.com','sterling.koliba@gmail.com') AND r.status='pending';
INSERT OR IGNORE INTO work_request_messages(id,request_id,actor,kind,body,created_at)
 SELECT 'import-'||id,id,requested_by,'request',details,created_at FROM work_requests;
CREATE TRIGGER IF NOT EXISTS preserve_work_request BEFORE UPDATE ON work_requests
 BEGIN INSERT INTO revisions(entity,record_id,body_json,preserved_at) VALUES ('work_request',OLD.id,
 json_object('status',OLD.status,'result',OLD.result,'suggestion',OLD.suggestion,'result_url',OLD.result_url,'version',OLD.version,'last_actor',OLD.last_actor),NEW.updated_at); END;
