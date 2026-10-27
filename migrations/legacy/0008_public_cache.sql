-- Additive only: public records and their immutable history are unchanged.
-- These triggers invalidate every public variant in the same transaction as
-- the content mutation, including writes outside the HQ record handler.
CREATE TABLE public_cache_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0)
);
INSERT INTO public_cache_state (id, revision) VALUES (1, 0);

CREATE TRIGGER public_cache_record_insert AFTER INSERT ON records
WHEN NEW.kind IN ('organization','event') AND NEW.status='published'
BEGIN
  UPDATE public_cache_state SET revision=revision+1 WHERE id=1;
END;

CREATE TRIGGER public_cache_record_update AFTER UPDATE ON records
WHEN (OLD.kind IN ('organization','event') AND OLD.status='published')
  OR (NEW.kind IN ('organization','event') AND NEW.status='published')
BEGIN
  UPDATE public_cache_state SET revision=revision+1 WHERE id=1;
END;

CREATE TRIGGER public_cache_record_delete AFTER DELETE ON records
WHEN OLD.kind IN ('organization','event') AND OLD.status='published'
BEGIN
  UPDATE public_cache_state SET revision=revision+1 WHERE id=1;
END;

CREATE TRIGGER public_cache_invitation_insert AFTER INSERT ON organization_event_invitations
WHEN NEW.status='accepted'
BEGIN
  UPDATE public_cache_state SET revision=revision+1 WHERE id=1;
END;

CREATE TRIGGER public_cache_invitation_update AFTER UPDATE ON organization_event_invitations
WHEN OLD.status='accepted' OR NEW.status='accepted'
BEGIN
  UPDATE public_cache_state SET revision=revision+1 WHERE id=1;
END;

CREATE TRIGGER public_cache_invitation_delete AFTER DELETE ON organization_event_invitations
WHEN OLD.status='accepted'
BEGIN
  UPDATE public_cache_state SET revision=revision+1 WHERE id=1;
END;
