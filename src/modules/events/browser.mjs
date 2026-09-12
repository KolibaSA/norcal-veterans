import { createRecordFeature } from '../../shared/browser-records.mjs';
export function pacificInput(value, dateOnly = false) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return dateOnly ? value : value + 'T00:00';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).map(x => [x.type, x.value]));
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  return dateOnly ? day : `${day}T${parts.hour}:${parts.minute}`;
}


export function eventFields(record = {}) {
  const p = record.payload ?? {}, dayOnly = p.date_only === true;
  return {
    dateOnly: dayOnly, start: p.starts_local ?? pacificInput(p.start_at, dayOnly),
    end: p.ends_local ?? pacificInput(p.end_at, dayOnly), venue: p.venue ?? '', eventCity: p.city ?? '',
    eventCounty: p.county ?? '', eventKind: p.kind ?? '', organizer: p.organizer ?? '', audience: p.audience ?? '',
    source: p.source_url ?? '', sourceChecked: p.source_checked?.slice(0, 10) ?? '', timeNote: p.time_note ?? '',
    sourceKind: p.source_kind ?? '', sourceNote: p.source_note ?? '', reviewNotes: p.review_notes ?? ''
  };
}
export function eventPayload(fields, previous = {}) {
  const p = structuredClone(previous);

    Object.assign(p, {
      title: fields.recordTitle, description: fields.recordBody, starts_local: fields.start,
      ends_local: fields.dateOnly ? '' : fields.end, date_only: !!fields.dateOnly,
      venue: fields.venue, city: fields.eventCity, county: fields.eventCounty,
      kind: fields.eventKind || 'Community event', organizer: fields.organizer, audience: fields.audience,
      source_url: fields.source, source_checked: fields.sourceChecked || null, time_note: fields.timeNote,
      source_kind: fields.sourceKind, source_note: fields.sourceNote, review_notes: fields.reviewNotes
    });
  return p;
}
export function updateDateFields($) {
  const dateOnly = $('dateOnly').checked;
  for (const id of ['start', 'end']) {
    const value = $(id).value;
    $(id).type = dateOnly ? 'date' : 'datetime-local';
    $(id).value = dateOnly ? value.slice(0, 10) : value && value.length === 10 ? value + 'T00:00' : value;
  }
  $('end').disabled = dateOnly;
}
export function createFeature() {
  return createRecordFeature({ kind: 'event', title: 'Events', editorLabel: 'event', statuses: ['draft', 'published', 'archived'],
    editorSections: ['eventFields', 'reviewFields'], fields: eventFields, payload: eventPayload,
    configureEditor({ $, values }) {
      $('start').type = values.dateOnly ? 'date' : 'datetime-local';
      $('end').type = values.dateOnly ? 'date' : 'datetime-local';
      $('end').disabled = !!values.dateOnly;
      $('start').required = true; $('venue').required = true;
    },
    connect({ $ }) {
      $('dateOnly').onchange = () => updateDateFields($);
      return { resetEditor() { $('start').required = false; $('venue').required = false; } };
    }
  });
}
