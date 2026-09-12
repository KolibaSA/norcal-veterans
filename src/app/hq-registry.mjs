import { createFeature as requests } from '../modules/requests/browser.mjs';
import { createFeature as overview } from '../modules/overview/browser.mjs';
import { createFeature as projectWork } from '../modules/project-work/browser.mjs';
import { createFeature as submissions } from '../modules/submissions/browser.mjs';
import { createFeature as events, eventFields } from '../modules/events/browser.mjs';
import { createFeature as organizations, organizationFields } from '../modules/organizations/browser.mjs';
import { createFeature as coordination } from '../modules/coordination/browser.mjs';
import { createFeature as library } from '../modules/library/browser.mjs';
import { createFeature as access } from '../modules/access/browser.mjs';
import { createFeature as history } from '../modules/history/browser.mjs';
import { canPublish } from '../shared/browser-ui.mjs';

// Composition is the only place that needs to know the full feature inventory.
export function createRegistry() {
  const request = requests(), task = projectWork(), organization = organizations();
  const features = [request, overview([request, task, organization]), task, submissions(), events(), organization,
    coordination(), library(), access(), history()];
  return Object.fromEntries(features.map(feature => [feature.kind, feature]));
}

const compatibility = createRegistry();
export const TITLES = Object.fromEntries(Object.values(compatibility).map(feature => [feature.kind, feature.title]));
export const STATUSES = Object.fromEntries(Object.values(compatibility).filter(feature => feature.statuses).map(feature => [feature.kind, feature.statuses]));
export const canEditRecord = (me, record) => compatibility[record.kind]?.canEdit?.(me, record)
  ?? (record.status !== 'published' || canPublish(me, record));
// Legacy tests/consumers keep their complete form shape; the live editor reads
// only the active feature's fields through its own descriptor.
export function fieldsForRecord(record = {}) {
  const base = compatibility[record.kind]?.fields?.(record) ?? {
    recordTitle: record.title ?? '', recordBody: record.body ?? '', region: record.region_id ?? 'yolo-solano',
    org: record.organization_id ?? '', recordStatus: record.status ?? 'draft'
  };
  return { ...base, ...organizationFields(record), ...eventFields(record) };
}
export function payloadForFields(kind, fields, previous = {}) {
  return compatibility[kind]?.payload?.(fields, previous) ?? structuredClone(previous);
}
export function itemURL(kind, id, origin = '') {
  const query = new URLSearchParams({ tab: TITLES[kind] ? kind : 'request' });
  if (id) query.set('item', id);
  return origin + '/hq?' + query.toString();
}
