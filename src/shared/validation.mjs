export const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const present = value => value !== undefined && value !== null && value !== '';
export const invalid = message => { throw new Error(message); };
export function text(value, name, max = 2000) {
  if (!present(value)) return;
  if (typeof value !== 'string' || value.length > max) invalid(`${name} must be text of at most ${max} characters.`);
}
export function strings(value, name, maxItems = 50, maxLength = 200) {
  if (!present(value)) return;
  if (!Array.isArray(value) || value.length > maxItems) invalid(`${name} must be a list with at most ${maxItems} entries.`);
  for (const item of value) { if (typeof item !== 'string' || !item.trim() || item.length > maxLength) invalid(`${name} contains an invalid entry.`); }
}
export function shape(value, name) { if (present(value) && !object(value)) invalid(`${name} must be an object.`); }
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
const pacificFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
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
export function publicURL(value, name) {
  text(value, name, 2000);
  if (!present(value)) return;
  try { const url = new URL(value); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw Error(); }
  catch { invalid(`${name} must be a public http or https URL without embedded credentials.`); }
  let decoded = value; try { decoded = decodeURIComponent(value); } catch {}
  if (/(?:roster|post[-_]?officers|\/officers(?:[/?#.]|$)|post-detail)/i.test(decoded)) invalid(`${name} cannot link to a personal roster or officer directory.`);
}
export function boundedJSON(value, depth = 0) {
  if (depth > 6) invalid('Content has too many nested levels.');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'string') { if (value.length > 20000) invalid('A content field exceeds 20,000 characters.'); return; }
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (Array.isArray(value)) { if (value.length > 100) invalid('A content list exceeds 100 entries.'); value.forEach(item => boundedJSON(item, depth + 1)); return; }
  if (!object(value) || Object.keys(value).length > 100) invalid('Invalid content object.');
  for (const [key, item] of Object.entries(value)) { if (['__proto__', 'prototype', 'constructor'].includes(key) || key.length > 120) invalid('Invalid content field name.'); boundedJSON(item, depth + 1); }
}
