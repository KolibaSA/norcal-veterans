-- Exclude organization meetings from the ordered community-event scan itself.
ALTER TABLE public_occurrences ADD COLUMN listable INTEGER NOT NULL DEFAULT 0;
DROP INDEX idx_public_occurrences_region_start;
DROP INDEX idx_public_occurrences_city_start;
CREATE INDEX idx_public_occurrences_region_start ON public_occurrences(region_id,listable,start_at,source_record_id,occurrence_index);
CREATE INDEX idx_public_occurrences_city_start ON public_occurrences(region_id,city,listable,start_at,source_record_id,occurrence_index);
INSERT INTO public_occurrence_dirty(source_record_id)
SELECT id FROM records WHERE kind='event' OR (kind='organization' AND id='vfw-ca-8151')
ON CONFLICT(source_record_id) DO UPDATE SET generation=generation+1;
