-- Private assignments. Pending rows never authorize organization editing.
CREATE TABLE IF NOT EXISTS organization_editors (
 id TEXT PRIMARY KEY,
 email TEXT NOT NULL CHECK(email=lower(trim(email)) AND length(email) BETWEEN 3 AND 254),
 org_id TEXT NOT NULL,
 display_name TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','revoked')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 activated_at TEXT,
 UNIQUE(email,org_id)
);
CREATE INDEX IF NOT EXISTS organization_editors_active_email ON organization_editors(email,status);
CREATE TRIGGER IF NOT EXISTS preserve_organization_editor BEFORE UPDATE ON organization_editors
 BEGIN INSERT INTO revisions(entity,record_id,body_json,preserved_at) VALUES ('organization_editor',OLD.id,
 json_object('email',OLD.email,'org_id',OLD.org_id,'display_name',OLD.display_name,'status',OLD.status,'version',OLD.version,'created_by',OLD.created_by,'created_at',OLD.created_at,'updated_at',OLD.updated_at,'activated_at',OLD.activated_at),NEW.updated_at); END;
