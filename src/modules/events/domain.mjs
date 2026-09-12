import { text, present, invalid, canonicalInstant, pacificLocal, pacificToInstant } from '../../shared/validation.mjs';
import { validatePublicContent } from '../../shared/content-validation.mjs';
import { validatePayload } from '../../shared/record-validation.mjs';

export const timeZone = 'America/Los_Angeles';
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
    delete p.starts_local; delete p.ends_local;
    text(p.venue, 'Public event venue', 1000);
    if (!p.venue?.trim()) invalid('Enter the public event venue.');

  });
}

export const recordDefinition = Object.freeze({ kind: 'event', statuses: ['draft', 'published', 'archived'], validate: validateEvent });
