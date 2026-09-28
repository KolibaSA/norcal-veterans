-- Event invitations are the authoritative participation record. Existing
-- accepted_organization_ids are copied once so published partners survive.
CREATE TABLE organization_event_invitations (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  recipient_org_id TEXT NOT NULL REFERENCES records(id),
  status TEXT NOT NULL CHECK(status IN ('pending','accepted','declined','withdrawn')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  decision_by TEXT,
  decision_at TEXT,
  decision_note TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  mutation_id TEXT NOT NULL,
  UNIQUE(event_id,recipient_org_id)
);
CREATE INDEX idx_event_invitations_recipient ON organization_event_invitations(recipient_org_id,status);
CREATE INDEX idx_event_invitations_event ON organization_event_invitations(event_id,status);

INSERT OR IGNORE INTO organization_event_invitations
  (id,event_id,recipient_org_id,status,created_by,created_at,updated_at,decision_by,decision_at,decision_note,mutation_id)
SELECT lower(hex(randomblob(16))),e.id,o.id,'accepted',e.created_by,e.created_at,e.updated_at,
       e.created_by,e.updated_at,'Migrated from the event participant list',lower(hex(randomblob(16)))
FROM records e,
     json_each(CASE WHEN json_valid(e.payload) THEN e.payload ELSE '{}' END,'$.accepted_organization_ids') accepted
JOIN records o ON o.id=accepted.value AND o.kind='organization' AND o.region_id=e.region_id
WHERE e.kind='event' AND e.organization_id IS NOT NULL AND o.id<>e.organization_id
  AND accepted.type='text';
