import { organizationMetadata } from '../modules/organizations/domain.mjs';
import { timeZone } from '../modules/events/domain.mjs';
export const contentMetadata = Object.freeze({ timeZone, ...organizationMetadata });
