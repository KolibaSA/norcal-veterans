import { publicEventRecord } from '../modules/events/public.mjs';
import { publicOrganizationRecord, publicMeetingPlanEvents } from '../modules/organizations/public.mjs';
import { publicOccurrenceRows, occurrenceWindows } from './public-occurrences.mjs';

function project(row) {
  if (row.status !== 'published' || !/^[-_a-zA-Z0-9]{1,120}$/.test(row.id)) return [];
  let payload;
  try { payload = JSON.parse(row.payload); } catch { return []; }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  if (row.kind === 'event') {
    let event;
    try { event = publicEventRecord(row, payload); } catch { return []; }
    return event ? publicOccurrenceRows(event, row.region_id) : [];
  }
  if (row.kind === 'organization' && row.id === 'vfw-ca-8151') {
    let organization, events;
    try { organization = publicOrganizationRecord(row, payload); events = organization ? publicMeetingPlanEvents(row, payload, organization) : []; }
    catch { return []; }
    return events.flatMap(event => publicOccurrenceRows(event, row.region_id));
  }
  return [];
}

// Rebuild a bounded number of dirty source records. Each replacement and dirty
// removal is guarded by the exact mutation ID, inside one D1 batch. Concurrent
// edits therefore remain dirty and cannot install a stale index projection.
export async function rebuildPublicOccurrences(db, limit = 25, sourceId = null) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new TypeError('Invalid rebuild limit.');
  const source = (await db.prepare(`SELECT r.id,r.kind,r.title,r.body,r.region_id,r.organization_id,r.status,r.payload,r.mutation_id,d.generation
    FROM public_occurrence_dirty d JOIN records r ON r.id=d.source_record_id WHERE (? IS NULL OR r.id=?) ORDER BY d.source_record_id LIMIT ?`).bind(sourceId,sourceId,limit).all()).results;
  let completed = 0;
  for (const row of source) {
    let records, windows;
    try { records = project(row); windows=occurrenceWindows(records.filter(record=>record.listable)); } catch { continue; }
    const guard = 'EXISTS (SELECT 1 FROM records WHERE id=? AND mutation_id=?) AND EXISTS (SELECT 1 FROM public_occurrence_dirty WHERE source_record_id=? AND generation=?)';
    const remove = db.prepare(`DELETE FROM public_occurrences WHERE source_record_id=? AND ${guard}`).bind(row.id,row.id,row.mutation_id,row.id,row.generation);
    const insert = db.prepare(`INSERT OR IGNORE INTO public_occurrences(source_record_id,event_id,occurrence_index,region_id,organization_id,city,start_at,end_at,pacific_day,visible_through_ms,listable)
      SELECT ?,json_extract(value,'$.event_id'),CAST(key AS INTEGER),json_extract(value,'$.region_id'),json_extract(value,'$.organization_id'),json_extract(value,'$.city'),
      json_extract(value,'$.start_at'),json_extract(value,'$.end_at'),json_extract(value,'$.pacific_day'),json_extract(value,'$.visible_through_ms'),json_extract(value,'$.listable')
      FROM json_each(?) WHERE ${guard}`).bind(row.id,JSON.stringify(records),row.id,row.mutation_id,row.id,row.generation);
    const clear = db.prepare(`DELETE FROM public_occurrence_dirty WHERE source_record_id=? AND ${guard}`).bind(row.id,row.id,row.mutation_id,row.id,row.generation);
    const removeWindows=db.prepare(`DELETE FROM public_occurrence_windows WHERE source_record_id=? AND ${guard}`).bind(row.id,row.id,row.mutation_id,row.id,row.generation);
    const insertWindows=db.prepare(`INSERT OR IGNORE INTO public_occurrence_windows(source_record_id,occurrence_index,event_id,region_id,city,start_at,window_level,window_bucket)
      SELECT ?,json_extract(value,'$.occurrence_index'),json_extract(value,'$.event_id'),json_extract(value,'$.region_id'),json_extract(value,'$.city'),json_extract(value,'$.start_at'),json_extract(value,'$.window_level'),json_extract(value,'$.window_bucket') FROM json_each(?) WHERE ${guard}`)
      .bind(row.id,JSON.stringify(windows),row.id,row.mutation_id,row.id,row.generation);
    const result = await db.batch([remove,insert,removeWindows,insertWindows,clear]);
    completed += Number(result[4].meta.changes || 0);
  }
  return { examined: source.length, completed };
}
