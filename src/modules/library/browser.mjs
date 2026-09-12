import { createRecordFeature } from '../../shared/browser-records.mjs';

// This feature owns its record lifecycle; the shared editor handles common fields.
export function createFeature() {
  return createRecordFeature({ kind: 'library', title: 'Ready-to-use copy', statuses: ["draft","ready","archived"] });
}
