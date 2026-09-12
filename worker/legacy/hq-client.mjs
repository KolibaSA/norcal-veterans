// Compatibility entry. The build bundles this file and hashes its final bytes.
export { TITLES, STATUSES, fieldsForRecord, payloadForFields, canEditRecord, itemURL } from '../../src/app/hq-registry.mjs';
export { esc, splitList, filterRecords, canPublish } from '../../src/shared/browser-ui.mjs';
export { pacificInput } from '../../src/modules/events/browser.mjs';
export { submissionDraft } from '../../src/modules/submissions/browser.mjs';
export { healthDescription } from '../../src/modules/requests/browser.mjs';
export { startHeadquarters } from '../../src/app/hq-browser.mjs';
import { startHeadquarters } from '../../src/app/hq-browser.mjs';

if (typeof document !== 'undefined') void startHeadquarters();
