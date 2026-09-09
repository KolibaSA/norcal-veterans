-- Organization-owned albums and consent-aware cross-organization photo presence.
ALTER TABLE organization_photos ADD COLUMN album_id TEXT;

CREATE TABLE IF NOT EXISTS organization_photo_albums (
 id TEXT PRIMARY KEY,
 org_id TEXT NOT NULL,
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),
 description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=500),
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL,
 updated_by TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1)
);
CREATE INDEX IF NOT EXISTS organization_photo_albums_org ON organization_photo_albums(org_id,created_at,id);
CREATE TRIGGER IF NOT EXISTS clear_organization_photo_album AFTER DELETE ON organization_photo_albums
 BEGIN UPDATE organization_photos SET album_id=NULL,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),version=version+1 WHERE album_id=OLD.id AND org_id=OLD.org_id; END;

CREATE TABLE IF NOT EXISTS organization_photo_presence (
 id TEXT PRIMARY KEY,
 photo_id TEXT NOT NULL REFERENCES organization_photos(id) ON DELETE CASCADE,
 org_id TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','approved')),
 requested_by TEXT NOT NULL,
 requested_at TEXT NOT NULL,
 reviewed_by TEXT,
 reviewed_at TEXT,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 UNIQUE(photo_id,org_id)
);
CREATE INDEX IF NOT EXISTS organization_photo_presence_photo ON organization_photo_presence(photo_id,status,org_id);
CREATE INDEX IF NOT EXISTS organization_photo_presence_org ON organization_photo_presence(org_id,status,photo_id);

-- Every existing photo belongs to its owner organization by default.
INSERT OR IGNORE INTO organization_photo_presence(id,photo_id,org_id,status,requested_by,requested_at,reviewed_by,reviewed_at)
 SELECT 'owner-'||id,id,org_id,'approved',uploaded_by,created_at,uploaded_by,created_at FROM organization_photos;

CREATE TRIGGER IF NOT EXISTS preserve_organization_photo_album_update BEFORE UPDATE ON organization_photo_albums
 BEGIN INSERT INTO revisions(entity,record_id,body_json,preserved_at) VALUES ('organization_photo_album',OLD.id,
 json_object('org_id',OLD.org_id,'name',OLD.name,'description',OLD.description,'created_by',OLD.created_by,'created_at',OLD.created_at,'updated_by',OLD.updated_by,'updated_at',OLD.updated_at,'version',OLD.version),NEW.updated_at); END;
CREATE TRIGGER IF NOT EXISTS preserve_organization_photo_album_delete BEFORE DELETE ON organization_photo_albums
 BEGIN INSERT INTO revisions(entity,record_id,body_json,preserved_at) VALUES ('organization_photo_album',OLD.id,
 json_object('org_id',OLD.org_id,'name',OLD.name,'description',OLD.description,'created_by',OLD.created_by,'created_at',OLD.created_at,'updated_by',OLD.updated_by,'updated_at',OLD.updated_at,'version',OLD.version),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;
CREATE TRIGGER IF NOT EXISTS preserve_organization_photo_presence_update BEFORE UPDATE ON organization_photo_presence
 BEGIN INSERT INTO revisions(entity,record_id,body_json,preserved_at) VALUES ('organization_photo_presence',OLD.id,
 json_object('photo_id',OLD.photo_id,'org_id',OLD.org_id,'status',OLD.status,'requested_by',OLD.requested_by,'requested_at',OLD.requested_at,'reviewed_by',OLD.reviewed_by,'reviewed_at',OLD.reviewed_at,'version',OLD.version),COALESCE(NEW.reviewed_at,NEW.requested_at)); END;
CREATE TRIGGER IF NOT EXISTS preserve_organization_photo_presence_delete BEFORE DELETE ON organization_photo_presence
 BEGIN INSERT INTO revisions(entity,record_id,body_json,preserved_at) VALUES ('organization_photo_presence',OLD.id,
 json_object('photo_id',OLD.photo_id,'org_id',OLD.org_id,'status',OLD.status,'requested_by',OLD.requested_by,'requested_at',OLD.requested_at,'reviewed_by',OLD.reviewed_by,'reviewed_at',OLD.reviewed_at,'version',OLD.version),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

