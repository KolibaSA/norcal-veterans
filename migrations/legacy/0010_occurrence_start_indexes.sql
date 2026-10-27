-- Support ordered future-event reads without sorting the entire regional set.
CREATE INDEX idx_public_occurrences_region_start ON public_occurrences(region_id,start_at,source_record_id,occurrence_index);
CREATE INDEX idx_public_occurrences_city_start ON public_occurrences(region_id,city,start_at,source_record_id,occurrence_index);

CREATE TABLE public_occurrence_windows (
  source_record_id TEXT NOT NULL,
  occurrence_index INTEGER NOT NULL,
  event_id TEXT NOT NULL,
  region_id TEXT NOT NULL,
  city TEXT NOT NULL,
  start_at TEXT NOT NULL,
  window_level INTEGER NOT NULL,
  window_bucket INTEGER NOT NULL,
  PRIMARY KEY(source_record_id,occurrence_index,window_level,window_bucket)
);
CREATE INDEX idx_public_windows_region ON public_occurrence_windows(region_id,window_level,window_bucket,start_at,source_record_id);
CREATE INDEX idx_public_windows_city ON public_occurrence_windows(region_id,city,window_level,window_bucket,start_at,source_record_id);
CREATE TRIGGER public_occurrence_windows_delete AFTER DELETE ON records
BEGIN
  DELETE FROM public_occurrence_windows WHERE source_record_id=OLD.id;
END;
INSERT INTO public_occurrence_dirty(source_record_id)
SELECT id FROM records WHERE kind='event' OR (kind='organization' AND id='vfw-ca-8151')
ON CONFLICT(source_record_id) DO UPDATE SET generation=generation+1;
