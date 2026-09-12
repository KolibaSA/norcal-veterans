import { validatePayload } from '../../shared/record-validation.mjs';

// This feature currently uses the common private-record fields without extra rules.
export const recordDefinition = Object.freeze({ kind: "library", statuses: ["draft","ready","archived"], validate: validatePayload });
