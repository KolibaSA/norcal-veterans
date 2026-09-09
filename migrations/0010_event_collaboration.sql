CREATE TABLE IF NOT EXISTS organization_event_invitations (
 id TEXT PRIMARY KEY,
 event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
 sender_org_id TEXT NOT NULL,
 recipient_org_id TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined')),
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL,
 decision_by TEXT,
 decision_at TEXT,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 CHECK(sender_org_id<>recipient_org_id),
 UNIQUE(event_id,recipient_org_id)
);

CREATE INDEX IF NOT EXISTS organization_event_invitation_recipient
 ON organization_event_invitations(recipient_org_id,status,created_at);
CREATE INDEX IF NOT EXISTS organization_event_invitation_sender
 ON organization_event_invitations(sender_org_id,created_at);

