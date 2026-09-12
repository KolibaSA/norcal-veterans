// Compatibility exports. Feature validation lives behind each module's domain interface.
export { contentMetadata } from '../../src/app/content-metadata.mjs';
export { canonicalDate, canonicalInstant, pacificLocal, pacificToInstant } from '../../src/shared/validation.mjs';
export { validateRecordPayload } from '../../src/app/record-definitions.mjs';
