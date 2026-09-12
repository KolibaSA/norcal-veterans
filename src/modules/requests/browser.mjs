import { esc } from '../../shared/browser-ui.mjs';
import { createRecordFeature } from '../../shared/browser-records.mjs';
import { connectActivity } from './activity.mjs';
import { connectHealth } from './health.mjs';
export { healthDescription } from './health.mjs';

const FAMILY_SCOPE_PREFIX = 'family:';
const TARGETS = ['website', 'headquarters', 'decide'];

function parseOptions(value, fallback = []) {
  try {
    const result = JSON.parse(value || '[]');
    return Array.isArray(result) ? result : fallback;
  } catch { return fallback; }
}

function requestFields(record = {}) {
  const payload = record.payload ?? {};
  const family = payload.organization_scope?.type;
  return {
    requestTarget: TARGETS.includes(payload.target) ? payload.target : 'decide',
    org: family ? FAMILY_SCOPE_PREFIX + family : record.organization_id ?? ''
  };
}

function requestPayload(fields, previous = {}) {
  const payload = structuredClone(previous);
  payload.target = TARGETS.includes(fields.requestTarget) ? fields.requestTarget : 'decide';
  delete payload.organization_scope;
  if (String(fields.org).startsWith(FAMILY_SCOPE_PREFIX)) {
    payload.organization_scope = { type: String(fields.org).slice(FAMILY_SCOPE_PREFIX.length) };
  }
  return payload;
}

function requestOrganizationId(fields) {
  return String(fields.org).startsWith(FAMILY_SCOPE_PREFIX) ? null : (fields.org || null);
}

function configureRequestScope($) {
  const select = $('org');
  const organizations = parseOptions(select.dataset.organizationOptions);
  const families = parseOptions(select.dataset.organizationFamilies).filter(Boolean);
  const current = select.value;
  select.innerHTML = '<option value="">Region-wide</option>' +
    (families.length ? '<optgroup label="Organization families">' + families.map(type =>
      '<option value="' + esc(FAMILY_SCOPE_PREFIX + type) + '">All ' + esc(type) + '</option>').join('') + '</optgroup>' : '') +
    (organizations.length ? '<optgroup label="Specific organizations">' + organizations.map(org =>
      '<option value="' + esc(org.id) + '">' + esc(org.title) + '</option>').join('') + '</optgroup>' : '');
  select.value = current;
}

export function canEditRequest(me, record) { return !!me?.owner && record.status !== 'in_progress'; }
export function createFeature() {
  return createRecordFeature({ kind: 'request', title: 'Requests', editorLabel: 'request',
    statuses: ['queued', 'in_progress', 'needs_input', 'completed', 'cancelled', 'closed'],
    heading: 'What would you like to work on?', newLabel: 'New request', openNewOnLoad: true,
    editorSections: ['requestFields'], fields: requestFields, payload: requestPayload,
    organizationId: requestOrganizationId,
    canCreate: me => !!me.owner, canEdit: canEditRequest,
    allowStatus: (status, record) => status !== 'in_progress' || record.status === 'in_progress',
    saveLabel: record => record.status === 'queued' ? 'Save and queue request' : 'Save item',
    savedMessage: record => record.status === 'queued' ? 'Request saved and queued.' : 'Saved.',
    notice: (_me, record, editable) => !editable
      ? record.status === 'in_progress' ? 'The agent is processing these instructions. Add a comment below, or reconcile the run before changing the instructions.'
        : 'Executable requests are managed by the platform owner.'
      : 'Saving this request as queued authorizes the agent to process these instructions. Comments and results appear separately below.',
    configureEditor({ $ }) { configureRequestScope($); },
    connect: connectRequests
  });
}

export function connectRequests(context) {
  return { ...connectActivity(context), ...connectHealth(context) };
}
