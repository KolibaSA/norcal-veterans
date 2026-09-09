-- Public gallery metadata. Private sign-in attribution stays in HQ and audit.
CREATE TABLE IF NOT EXISTS organization_photos (
 id TEXT PRIMARY KEY,
 org_id TEXT NOT NULL,
 object_key TEXT,
 image_url TEXT,
 caption TEXT NOT NULL DEFAULT '',
 alt_text TEXT NOT NULL,
 credit TEXT NOT NULL DEFAULT '',
 source_url TEXT NOT NULL DEFAULT '',
 license TEXT NOT NULL DEFAULT '',
 license_url TEXT NOT NULL DEFAULT '',
 content_type TEXT NOT NULL DEFAULT '',
 byte_size INTEGER NOT NULL DEFAULT 0 CHECK(byte_size>=0 AND byte_size<=5242880),
 sha256 TEXT NOT NULL DEFAULT '',
 uploaded_by TEXT NOT NULL,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 CHECK((object_key IS NOT NULL AND image_url IS NULL AND byte_size>0 AND content_type IN ('image/jpeg','image/png','image/webp') AND length(sha256)=64) OR (object_key IS NULL AND image_url IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS organization_photos_org ON organization_photos(org_id,created_at,id);
