// Composition only. Each feature owns its record contract and rules.
import { recordDefinition as request, stripEditorCredentials, redactPayload } from '../modules/requests/domain.mjs';
import { recordDefinition as task } from '../modules/project-work/domain.mjs';
import { recordDefinition as organization } from '../modules/organizations/domain.mjs';
import { recordDefinition as event } from '../modules/events/domain.mjs';
import { recordDefinition as coordination } from '../modules/coordination/domain.mjs';
import { recordDefinition as library } from '../modules/library/domain.mjs';
import { recordDefinition as submission } from '../modules/submissions/domain.mjs';
import { visibleRecord as serializeRecord } from '../shared/server-storage.mjs';

export const recordDefinitions = Object.freeze(Object.fromEntries(
  [request, task, organization, event, coordination, library, submission].map(definition => [definition.kind, Object.freeze({
    ...definition, sanitizePayload: stripEditorCredentials, redactPayload
  })])
));

// Multi-feature reads and legacy callers retain the same mandatory security policy.
export const visibleRecord = record => serializeRecord(record, redactPayload);
export function validateRecordPayload(kind, input, options) {
  const definition = Object.hasOwn(recordDefinitions, kind) ? recordDefinitions[kind] : null;
  if (!definition) throw new Error('Unknown record type.');
  return definition.validate(input, options);
}
