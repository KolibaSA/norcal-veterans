-- The index is derived data. Existing records and immutable history are untouched.
-- Until backfill and verification finish, public reads continue using the old path.
CREATE TABLE public_occurrence_dirty (
  source_record_id TEXT PRIMARY KEY,
  generation INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE public_occurrences (
  source_record_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  occurrence_index INTEGER NOT NULL,
  region_id TEXT NOT NULL,
  organization_id TEXT,
  city TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT,
  pacific_day TEXT NOT NULL,
  visible_through_ms INTEGER NOT NULL,
  PRIMARY KEY(source_record_id,occurrence_index)
);
CREATE INDEX idx_public_occurrences_upcoming ON public_occurrences(region_id,visible_through_ms,start_at,event_id);
CREATE INDEX idx_public_occurrences_archive ON public_occurrences(region_id,pacific_day,event_id);
CREATE INDEX idx_public_occurrences_city ON public_occurrences(region_id,city,pacific_day,event_id);
CREATE INDEX idx_public_occurrences_org ON public_occurrences(organization_id,visible_through_ms,start_at);

INSERT INTO public_occurrence_dirty(source_record_id)
SELECT id FROM records WHERE kind='event' OR (kind='organization' AND id='vfw-ca-8151');

CREATE TRIGGER public_occurrence_record_insert AFTER INSERT ON records
WHEN NEW.kind='event' OR (NEW.kind='organization' AND NEW.id='vfw-ca-8151')
BEGIN
  INSERT INTO public_occurrence_dirty(source_record_id) VALUES(NEW.id)
  ON CONFLICT(source_record_id) DO UPDATE SET generation=generation+1;
END;

CREATE TRIGGER public_occurrence_record_update AFTER UPDATE ON records
WHEN OLD.kind='event' OR NEW.kind='event' OR OLD.id='vfw-ca-8151' OR NEW.id='vfw-ca-8151'
BEGIN
  INSERT INTO public_occurrence_dirty(source_record_id) VALUES(NEW.id)
  ON CONFLICT(source_record_id) DO UPDATE SET generation=generation+1;
END;

CREATE TRIGGER public_occurrence_record_delete AFTER DELETE ON records
WHEN OLD.kind='event' OR (OLD.kind='organization' AND OLD.id='vfw-ca-8151')
BEGIN
  DELETE FROM public_occurrences WHERE source_record_id=OLD.id;
  DELETE FROM public_occurrence_dirty WHERE source_record_id=OLD.id;
END;
