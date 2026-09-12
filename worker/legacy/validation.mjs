import { sources } from '../../src/data.mjs';
// The active HQ and its public serializers share these content rules.
export const contentMetadata = Object.freeze({
  timeZone: 'America/Los_Angeles',
  organizationTypes: ['VFW', 'American Legion', 'Marine Corps League', 'Veterans Beer Club', 'Toys for Tots', 'DAV', 'County Veterans Office', 'Equine program provider', 'Veteran remembrance program', 'Veterans nonprofit', 'Other veteran organization'],
  counties: ['Yolo', 'Solano'],
  addressTypes: ['meeting_venue', 'service_office', 'program_venue', 'mailing']
});

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const present = value => value !== undefined && value !== null && value !== '';
const invalid = message => { throw new Error(message); };
function text(value, name, max = 2000) {
  if (!present(value)) return;
  if (typeof value !== 'string' || value.length > max) invalid(`${name} must be text of at most ${max} characters.`);
}
function strings(value, name, maxItems = 50, maxLength = 200) {
  if (!present(value)) return;
  if (!Array.isArray(value) || value.length > maxItems) invalid(`${name} must be a list with at most ${maxItems} entries.`);
  for (const item of value) { if (typeof item !== 'string' || !item.trim() || item.length > maxLength) invalid(`${name} contains an invalid entry.`); }
}
function shape(value, name) { if (present(value) && !object(value)) invalid(`${name} must be an object.`); }
export function canonicalDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid('Use a calendar date in YYYY-MM-DD format.');
  const date = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== value) invalid('That calendar date does not exist.');
  return value;
}
export function canonicalInstant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(value)) invalid('Use an ISO date and time with an explicit timezone offset.');
  canonicalDate(value.slice(0, 10));
  if (/[+-]14:(?!00)/.test(value)) invalid('Invalid timezone offset.');
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf())) invalid('Invalid event date or time.');
  return date.toISOString();
}
const pacificFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: contentMetadata.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
export function pacificLocal(value) {
  const parts = Object.fromEntries(pacificFormatter.formatToParts(new Date(value)).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}
// Reject the missing hour in spring and repeated hour in autumn. An existing
// exact ISO instant may disambiguate an unchanged event; new ambiguous times
// require an explicit ISO offset so the application never guesses.
export function pacificToInstant(value, { dateOnly = false, previousInstant = null } = {}) {
  if (typeof value !== 'string') invalid('Enter the event date and Pacific time.');
  let local = value;
  if (dateOnly) local = canonicalDate(value) + 'T00:00:00';
  else {
    if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(local)) invalid('Enter a valid Pacific date and time.');
    canonicalDate(local.slice(0, 10));
    if (local.length === 16) local += ':00';
  }
  const candidates = ['-07:00', '-08:00'].map(offset => canonicalInstant(local + offset)).filter(instant => pacificLocal(instant) === local);
  if (candidates.length === 1) return candidates[0];
  if (!candidates.length) invalid('That Pacific time does not exist because daylight saving time starts then. Choose another time.');
  if (previousInstant && candidates.includes(canonicalInstant(previousInstant))) return canonicalInstant(previousInstant);
  invalid('That Pacific time occurs twice when daylight saving time ends. Choose an unambiguous time or save an ISO time with the intended offset.');
}
function publicURL(value, name) {
  text(value, name, 2000);
  if (!present(value)) return;
  try { const url = new URL(value); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw Error(); }
  catch { invalid(`${name} must be a public http or https URL without embedded credentials.`); }
  let decoded = value; try { decoded = decodeURIComponent(value); } catch {}
  if (/(?:roster|post[-_]?officers|\/officers(?:[/?#.]|$)|post-detail)/i.test(decoded)) invalid(`${name} cannot link to a personal roster or officer directory.`);
}
function boundedJSON(value, depth = 0) {
  if (depth > 6) invalid('Content has too many nested levels.');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'string') { if (value.length > 20000) invalid('A content field exceeds 20,000 characters.'); return; }
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (Array.isArray(value)) { if (value.length > 100) invalid('A content list exceeds 100 entries.'); value.forEach(item => boundedJSON(item, depth + 1)); return; }
  if (!object(value) || Object.keys(value).length > 100) invalid('Invalid content object.');
  for (const [key, item] of Object.entries(value)) { if (['__proto__', 'prototype', 'constructor'].includes(key) || key.length > 120) invalid('Invalid content field name.'); boundedJSON(item, depth + 1); }
}
function reviewDate(value, name) { if (present(value)) { canonicalDate(value); if (value > new Date().toISOString().slice(0, 10)) invalid(`${name} cannot be in the future.`); } }
function provenance(p, previous) {
  for (const name of ['source_checked', 'last_verified_date']) reviewDate(p[name], name);
  for (const name of ['source_url', 'review_source_url', 'confirmation_source_url']) publicURL(p[name], name);
  for (const name of ['reviewed_by', 'review_recorded_at']) {
    text(p[name], name, 254);
    if (present(p[name]) && p[name] !== previous?.[name]) invalid('The source reviewer is recorded by the server.');
  }
  if (present(p.source_kind) && !['public_source', 'project_team'].includes(p.source_kind)) invalid('Choose public source or project team provenance.');
  if (present(p.source_checked) && !p.source_url && !(p.source_checked === previous?.source_checked && !previous?.source_url)) invalid('A source review date requires the event source URL.');
  // Existing imported source dates are retained, including sources withheld for
  // privacy. A new or changed claim requires evidence; no global date is added.
  if (present(p.last_verified_date) && !(p.review_source_url || p.source_ids?.length) && p.last_verified_date !== previous?.last_verified_date) invalid('Add a review source URL or source references before recording an organization review date.');
  if (present(p.organization_confirmed_at)) {
    canonicalInstant(p.organization_confirmed_at);
    if (Date.parse(p.organization_confirmed_at) > Date.now()) invalid('Organization confirmation cannot be in the future.');
    if (!p.confirmation_source_url && p.organization_confirmed_at !== previous?.organization_confirmed_at) invalid('Organization confirmation requires a public confirmation source.');
  }
  if (present(p.reviewed_update)) {
    shape(p.reviewed_update, 'Reviewed update');
    canonicalInstant(p.reviewed_update.reviewed_at);
    publicURL(p.reviewed_update.source_url, 'Correction source');
    if (!p.reviewed_update.source_url) invalid('A reviewed correction requires its source.');
    if (Date.parse(p.reviewed_update.reviewed_at) > Date.now()) invalid('A correction review date cannot be in the future.');
    if (present(p.reviewed_update.reviewed_by) && p.reviewed_update.reviewed_by !== previous?.reviewed_update?.reviewed_by) invalid('The correction reviewer is recorded by the server.');
  }
  if (present(p.display_name_update)) {
    shape(p.display_name_update, 'Display name update');
    reviewDate(p.display_name_update.date, 'Display name review date');
    text(p.display_name_update.method, 'Display name update method', 100);
    text(p.display_name_update.scope, 'Display name review scope', 2000);
  }
}

export function validateRecordPayload(kind, input, { status = 'draft', previousPayload = null, isNew = false, actorEmail = '' } = {}) {
  if (!object(input)) invalid('Record content must be an object.');
  boundedJSON(input);
  if (JSON.stringify(input).length > 60000) invalid('Record content exceeds 60,000 characters.');
  const p = structuredClone(input), previous = previousPayload;
  if (kind === 'organization' || kind === 'event') {
    for (const name of ['id', 'organization_id', 'region_id']) text(p[name], name, 120);
    for (const name of ['city', 'county', 'location_county', 'organization_type', 'kind', 'entity_kind']) text(p[name], name, 120);
    for (const name of ['title', 'verified_name', 'organizer']) text(p[name], name, 200);
    for (const name of ['description', 'member_information']) text(p[name], name, 20000);
    for (const name of ['audience', 'eligibility', 'hours', 'meeting_schedule', 'referral_notes', 'partnership_notes', 'time_note', 'source_note']) text(p[name], name, 4000);
    provenance(p, previous);
  }
  if (kind === 'organization') {
    for (const name of ['service_categories', 'source_ids', 'missing_data_flags']) strings(p[name], name);
    if (p.source_ids?.some(id => !sources.some(source => source.id === id)) && JSON.stringify(p.source_ids) !== JSON.stringify(previous?.source_ids)) invalid('Choose existing source references or add a public review source URL.');
    shape(p.service_area, 'Service area');
    if (p.service_area) { strings(p.service_area.counties, 'Service counties'); strings(p.service_area.cities, 'Service cities'); text(p.service_area.notes, 'Service area notes', 4000); }
    shape(p.address, 'Address');
    if (p.address) {
      text(p.address.text, 'Public address', 1000);
      if (!contentMetadata.addressTypes.includes(p.address.type) && JSON.stringify(p.address) !== JSON.stringify(previous?.address)) invalid('Choose a public venue, service office or mailing address. Residential and personal addresses cannot be published.');
      if (p.address.map_eligible !== undefined && typeof p.address.map_eligible !== 'boolean') invalid('Address map eligibility must be true or false.');
    }
    shape(p.public_contacts, 'Public contacts');
    if (p.public_contacts) {
      publicURL(p.public_contacts.website, 'Organization website');
      text(p.public_contacts.phone, 'Organization phone', 80);
      text(p.public_contacts.email, 'Organization email', 254);
      if (present(p.public_contacts.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.public_contacts.email)) invalid('Enter a valid public organization email.');
    }
    shape(p.event_information, 'Event information');
    if (p.event_information) { text(p.event_information.text, 'Event information', 4000); text(p.event_information.status, 'Event information status', 80); text(p.event_information.source_id, 'Event information source', 200); }
    for (const name of ['timezone', 'confidence', 'verification_method', 'officers_status']) text(p[name], name, 120);
    for (const name of ['photos', 'officers', 'officer_profiles']) if (present(p[name])) {
      if (!Array.isArray(p[name]) || p[name].length > 50 || p[name].some(item => !object(item))) invalid(`${name} must be a list of at most 50 objects.`);
    }
    for (const photo of p.photos || []) {
      for (const key of ['id', 'src', 'image_url', 'source_url', 'license_url', 'caption', 'alt_text', 'credit', 'license']) text(photo[key], 'Photo ' + key, 2000);
      shape(photo.album, 'Photo album');
      if (photo.album) for (const key of ['id', 'name', 'description']) text(photo.album[key], 'Photo album ' + key, 2000);
      if (present(photo.present_organizations) && (!Array.isArray(photo.present_organizations) || photo.present_organizations.length > 12 || photo.present_organizations.some(item => !object(item) || typeof item.id !== 'string' || typeof item.name !== 'string'))) invalid('Photo organizations must contain at most 12 organization IDs and names.');
    }
    if (status === 'published' && (isNew || previous?.organization_type || previous?.location_county)) {
      if (!p.organization_type?.trim() || !p.location_county?.trim()) invalid('Choose an organization type and county before publication.');
    }
  } else if (kind === 'event') {
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
  } else if (['request', 'task', 'coordination', 'library', 'submission'].includes(kind)) {
    for (const name of ['priority', 'category', 'assignee', 'assigned_to', 'due_at', 'url', 'source_url']) text(p[name], name, 2000);
    for (const name of ['tags', 'organization_ids']) strings(p[name], name);
    if (present(p.due_at)) canonicalInstant(p.due_at);
  } else invalid('Unknown record type.');
  const reviewKeys = ['source_checked', 'last_verified_date', 'source_url', 'review_source_url', 'organization_confirmed_at', 'confirmation_source_url'];
  if (actorEmail && reviewKeys.some(key => p[key] !== previous?.[key]) && (p.source_checked || p.last_verified_date || p.organization_confirmed_at)) {
    p.reviewed_by = actorEmail; p.review_recorded_at = new Date().toISOString();
  }
  return p;
}
