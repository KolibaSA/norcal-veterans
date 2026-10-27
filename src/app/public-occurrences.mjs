import { sanitizePublicEvent } from '../modules/events/public.mjs';
import { pacificToInstant } from '../shared/validation.mjs';

const pacificDay = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Los_Angeles'
});

// Partition an inclusive visibility interval into aligned powers of two.
// A lookup at any instant matches exactly one bucket per active occurrence.
// Storage grows logarithmically with duration, including very long events.
export function occurrenceWindows(occurrences) {
  return occurrences.flatMap((occurrence, occurrence_index) => {
    let start = Date.parse(occurrence.start_at);
    const end = occurrence.visible_through_ms, result=[];
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end < start) throw new TypeError('Invalid visibility interval.');
    while (start <= end) {
      let level=Math.min(48,Math.floor(Math.log2(end-start+1)));
      while(level>0 && start % (2 ** level)!==0) level--;
      result.push({...occurrence,occurrence_index,window_level:level,window_bucket:Math.floor(start/(2 ** level))});
      start += 2 ** level;
    }
    return result;
  });
}

// Derive indexed values from the same serializer and Pacific-day rules used by
// public cards. A caller supplies region from the record envelope, never payload.
export function publicOccurrenceRows(input, regionId) {
  if (typeof regionId !== 'string' || !regionId) throw new TypeError('A record region is required.');
  const event = sanitizePublicEvent(input);
  if (!event || event.status !== 'published') return [];
  return event.occurrences.map(({ start_at, end_at }) => {
    const day = pacificDay.format(new Date(start_at));
    let visibleThrough;
    if (event.date_only) {
      const tomorrow = new Date(Date.parse(day + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);
      visibleThrough = Date.parse(pacificToInstant(tomorrow + 'T00:00')) - 1;
    } else {
      visibleThrough = Date.parse(end_at || start_at) + (end_at ? 0 : 86400000);
    }
    return {
      event_id: event.id, region_id: regionId, organization_id: event.organization_id || null,
      city: event.city, start_at, end_at, pacific_day: day, visible_through_ms: visibleThrough,
      listable: event.kind !== 'Organization meeting' ? 1 : 0
    };
  });
}
