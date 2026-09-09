-- Files remain in the private HQ R2 bucket; only authenticated HQ routes serve them.
CREATE TABLE IF NOT EXISTS work_request_attachments (
 id TEXT PRIMARY KEY,
 request_id TEXT NOT NULL REFERENCES work_requests(id),
 object_key TEXT NOT NULL UNIQUE,
 filename TEXT NOT NULL CHECK(length(filename) BETWEEN 1 AND 180),
 content_type TEXT NOT NULL,
 byte_size INTEGER NOT NULL CHECK(byte_size BETWEEN 1 AND 10485760),
 sha256 TEXT NOT NULL CHECK(length(sha256)=64 AND sha256 NOT GLOB '*[^0-9a-f]*'),
 uploaded_by TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS work_attachments_request ON work_request_attachments(request_id,created_at);
