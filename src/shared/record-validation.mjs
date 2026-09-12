import { object, invalid, boundedJSON, text, strings, present, canonicalInstant } from './validation.mjs';
import { recordReviewer } from './content-validation.mjs';

// These envelope fields are shared by private records; feature rules run afterward.
export function validatePrivateFields(p) {
  for (const name of ['priority', 'category', 'assignee', 'assigned_to', 'due_at', 'url', 'source_url']) text(p[name], name, 2000);
  for (const name of ['tags', 'organization_ids']) strings(p[name], name);
  if (present(p.due_at)) canonicalInstant(p.due_at);
  return p;
}

export function validatePayload(input, options = {}, validate = validatePrivateFields) {
  if (!object(input)) invalid('Record content must be an object.');
  boundedJSON(input);
  if (JSON.stringify(input).length > 60000) invalid('Record content exceeds 60,000 characters.');
  const payload = structuredClone(input);
  validate(payload, options);
  return recordReviewer(payload, options.previousPayload, options.actorEmail);
}
