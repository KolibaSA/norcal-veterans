import { text, present, invalid, canonicalDate, canonicalInstant, pacificLocal, pacificToInstant, object } from '../../shared/validation.mjs';
import { validatePublicContent } from '../../shared/content-validation.mjs';
import { validatePayload } from '../../shared/record-validation.mjs';

export const timeZone = 'America/Los_Angeles';
const dayMilliseconds = 86400000;
const shiftDate = (date, days) => new Date(Date.parse(date + 'T00:00:00Z') + days * dayMilliseconds).toISOString().slice(0, 10);
export function validateEvent(input, options = {}) {
  return validatePayload(input, options, (p, { previousPayload: previous = null }) => {
    validatePublicContent(p, previous);
    if (p.date_only !== undefined && typeof p.date_only !== 'boolean') invalid('Date only must be true or false.');
    p.date_only = p.date_only === true;
    if (Object.hasOwn(p, 'starts_local')) p.start_at = pacificToInstant(p.starts_local, { dateOnly: p.date_only, previousInstant: previous?.start_at });
    p.start_at = canonicalInstant(p.start_at);
    if (Object.hasOwn(p, 'ends_local')) p.end_at = p.ends_local ? pacificToInstant(p.ends_local, { previousInstant: previous?.end_at }) : null;
    if (p.date_only) {
      if (!pacificLocal(p.start_at).endsWith('T00:00:00')) invalid('A date-only event must start at Pacific midnight. Use the event date field.');
      p.end_at = null;
    }
    else if (present(p.end_at)) { p.end_at = canonicalInstant(p.end_at); if (Date.parse(p.end_at) < Date.parse(p.start_at)) invalid('The event end must be on or after its start.'); }
    else p.end_at = null;
    const additionalDates = Object.hasOwn(p, 'additional_dates') ? p.additional_dates
      : (Array.isArray(previous?.additional_occurrences) ? previous.additional_occurrences.map(occurrence => pacificLocal(occurrence.start_at).slice(0, 10)) : []);
    if (!Array.isArray(additionalDates) || additionalDates.length > 30) invalid('Add no more than 30 additional event dates.');
    const primaryLocal = pacificLocal(p.start_at), primaryDate = primaryLocal.slice(0, 10);
    const dates = [...new Set(additionalDates.map(canonicalDate))].sort();
    if (dates.some(date => date <= primaryDate)) invalid('Every additional event date must be after the first event date.');
    const previousOccurrences = new Map((Array.isArray(previous?.additional_occurrences) ? previous.additional_occurrences : [])
      .filter(occurrence => object(occurrence) && present(occurrence.start_at))
      .map(occurrence => [pacificLocal(occurrence.start_at).slice(0, 10), occurrence]));
    const endLocal = p.end_at ? pacificLocal(p.end_at) : null;
    const endDayOffset = endLocal ? Math.round((Date.parse(endLocal.slice(0, 10) + 'T00:00:00Z') - Date.parse(primaryDate + 'T00:00:00Z')) / dayMilliseconds) : 0;
    p.additional_occurrences = dates.map(date => {
      const prior = previousOccurrences.get(date);
      const start_at = p.date_only
        ? pacificToInstant(date, { dateOnly: true, previousInstant: prior?.start_at })
        : pacificToInstant(`${date}T${primaryLocal.slice(11)}`, { previousInstant: prior?.start_at });
      const end_at = !p.date_only && endLocal
        ? pacificToInstant(`${shiftDate(date, endDayOffset)}T${endLocal.slice(11)}`, { previousInstant: prior?.end_at })
        : null;
      if (end_at && Date.parse(end_at) < Date.parse(start_at)) invalid('Every event occurrence must end on or after it starts.');
      return { start_at, end_at };
    });
    delete p.additional_dates;
    delete p.starts_local; delete p.ends_local;
    text(p.venue, 'Public event venue', 1000);
    if (!p.venue?.trim()) invalid('Enter the public event venue.');
    if (present(p.image_url)) {
      let image;
      try { image = new URL(p.image_url); } catch { invalid('Enter a valid HTTPS event image URL.'); }
      if (image.protocol !== 'https:' || image.username || image.password) invalid('Enter a valid HTTPS event image URL.');
    }
    for (const [enabledName, urlName, label] of [['volunteer_enabled','volunteer_url','volunteer'],['donate_enabled','donate_url','donation'],['tickets_enabled','tickets_url','ticket purchase']]) {
      if (p[enabledName] !== undefined && typeof p[enabledName] !== 'boolean') invalid(`${label} option must be true or false.`);
      if (present(p[urlName])) {
        let action;
        try { action = new URL(p[urlName]); } catch { invalid(`Enter a valid HTTPS ${label} URL.`); }
        if (action.protocol !== 'https:' || action.username || action.password) invalid(`Enter a valid HTTPS ${label} URL.`);
      }
    }
    if (present(p.meeting_times)) {
      if (p.kind !== 'Organization meeting') invalid('Multiple labeled times are available only for organization meetings.');
      if (!Array.isArray(p.meeting_times) || !p.meeting_times.length || p.meeting_times.length > 3) invalid('List one to three meeting times.');
      let prior = '';
      for (const entry of p.meeting_times) {
        if (!object(entry) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(entry.time || '')) invalid('Enter a valid meeting time.');
        text(entry.label, 'Meeting time label', 100); if (!entry.label?.trim()) invalid('Give every meeting time a label.');
        if (prior && entry.time <= prior) invalid('Meeting times must be listed from earliest to latest.');
        prior = entry.time;
      }
      if (pacificLocal(p.start_at).slice(11, 16) !== p.meeting_times[0].time) invalid('The event start must match the first labeled meeting time.');
    }

  });
}

export const recordDefinition = Object.freeze({ kind: 'event', statuses: ['draft', 'published', 'archived'], validate: validateEvent, deleteEnabled: true });
