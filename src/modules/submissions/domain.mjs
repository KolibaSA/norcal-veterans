import { validatePayload } from '../../shared/record-validation.mjs';

// This feature currently uses the common private-record fields without extra rules.
export const recordDefinition = Object.freeze({ kind: "submission", statuses: ["pending","reviewed","rejected"], validate: validatePayload });
