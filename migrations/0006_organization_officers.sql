-- Individually authorized public officer profiles. This is not a roster import.
CREATE TABLE IF NOT EXISTS organization_officers (
 id TEXT PRIMARY KEY,
 org_id TEXT NOT NULL,
 public_name TEXT NOT NULL CHECK(length(trim(public_name)) BETWEEN 1 AND 120),
 title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 160),
 bio TEXT NOT NULL CHECK(length(trim(bio)) BETWEEN 1 AND 1200),
 photo_id TEXT,
 consent_scope TEXT NOT NULL CHECK(consent_scope='public_name_title_bio_optional_photo'),
 consent_attested_by TEXT NOT NULL,
 consent_attested_at TEXT NOT NULL,
 role_confirmed_at TEXT NOT NULL,
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL,
 updated_by TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1)
);
CREATE INDEX IF NOT EXISTS organization_officers_org ON organization_officers(org_id,created_at,id);
CREATE TRIGGER IF NOT EXISTS preserve_organization_officer_update BEFORE UPDATE ON organization_officers
 BEGIN INSERT INTO revisions(entity,record_id,body_json,preserved_at) VALUES ('organization_officer',OLD.id,
 json_object('org_id',OLD.org_id,'public_name',OLD.public_name,'title',OLD.title,'bio',OLD.bio,'photo_id',OLD.photo_id,'consent_scope',OLD.consent_scope,'consent_attested_by',OLD.consent_attested_by,'consent_attested_at',OLD.consent_attested_at,'role_confirmed_at',OLD.role_confirmed_at,'created_by',OLD.created_by,'created_at',OLD.created_at,'updated_by',OLD.updated_by,'updated_at',OLD.updated_at,'version',OLD.version),NEW.updated_at); END;
CREATE TRIGGER IF NOT EXISTS preserve_organization_officer_delete BEFORE DELETE ON organization_officers
 BEGIN INSERT INTO revisions(entity,record_id,body_json,preserved_at) VALUES ('organization_officer',OLD.id,
 json_object('org_id',OLD.org_id,'public_name',OLD.public_name,'title',OLD.title,'bio',OLD.bio,'photo_id',OLD.photo_id,'consent_scope',OLD.consent_scope,'consent_attested_by',OLD.consent_attested_by,'consent_attested_at',OLD.consent_attested_at,'role_confirmed_at',OLD.role_confirmed_at,'created_by',OLD.created_by,'created_at',OLD.created_at,'updated_by',OLD.updated_by,'updated_at',OLD.updated_at,'version',OLD.version),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;
