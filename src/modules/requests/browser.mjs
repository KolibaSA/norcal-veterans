import { isPlatformAdmin } from '../../shared/permissions.mjs';
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
  const hasSavedValues = !!(record.id || record.payload);
  const region = hasSavedValues ? record.region_id ?? 'all' : 'all';
  const org = hasSavedValues ? family ? FAMILY_SCOPE_PREFIX + family : record.organization_id ?? '' : '';
  return {
    requestTarget: TARGETS.includes(payload.target) ? payload.target : 'decide',
    requestLimitScope: region !== 'all' || !!org,
    region, org
  };
}

const usesScope = fields => fields.requestTarget === 'website' || fields.requestLimitScope !== false;

function requestPayload(fields, previous = {}) {
  const payload = structuredClone(previous);
  payload.target = TARGETS.includes(fields.requestTarget) ? fields.requestTarget : 'decide';
  delete payload.organization_scope;
  if (usesScope(fields) && String(fields.org).startsWith(FAMILY_SCOPE_PREFIX)) {
    payload.organization_scope = { type: String(fields.org).slice(FAMILY_SCOPE_PREFIX.length) };
  }
  return payload;
}

function requestOrganizationId(fields) {
  return !usesScope(fields) || String(fields.org).startsWith(FAMILY_SCOPE_PREFIX) ? null : (fields.org || null);
}

function configureRequestScope($, record, values) {
  const select = $('org');
  const organizations = parseOptions(select.dataset.organizationOptions);
  const families = parseOptions(select.dataset.organizationFamilies).filter(Boolean);
  const current = select.value;
  select.innerHTML = '<option value="">All organizations</option>' +
    (families.length ? '<optgroup label="Organization families">' + families.map(type =>
      '<option value="' + esc(FAMILY_SCOPE_PREFIX + type) + '">All ' + esc(type) + '</option>').join('') + '</optgroup>' : '') +
    (organizations.length ? '<optgroup label="Specific organizations">' + organizations.map(org =>
      '<option value="' + esc(org.id) + '">' + esc(org.title) + '</option>').join('') + '</optgroup>' : '');
  select.value = current;
  const readScope = () => ({ requestTarget: $('requestTarget').value, requestLimitScope: $('requestLimitScope').checked });
  const updateVisibility = fields => {
    const website = fields.requestTarget === 'website';
    const showScope = website || fields.requestLimitScope;
    $('requestScopeOption').hidden = website;
    $('requestScopeSummary').hidden = showScope;
    $('requestScopeSummary').textContent = fields.requestTarget === 'headquarters' ? 'Entire HQ' : 'No region or organization restriction.';
    $('regionField').hidden = !showScope;
    $('organizationScopeField').hidden = !showScope;
  };
  const clearScope = () => {
    $('region').value = 'all';
    $('org').value = '';
    $('requestLimitScope').checked = false;
  };
  // Existing record envelopes have fixed scope. Never silently rewrite it when
  // reopening a saved request or changing its target.
  $('requestLimitScope').disabled = !!record.id;
  $('requestTarget').onchange = () => {
    if (!record.id) {
      if ($('requestTarget').value === 'headquarters') clearScope();
      else $('requestLimitScope').checked = $('region').value !== 'all' || !!$('org').value;
    }
    updateVisibility(readScope());
  };
  $('requestLimitScope').onchange = () => {
    if (!record.id && !$('requestLimitScope').checked) clearScope();
    updateVisibility(readScope());
  };
  updateVisibility(values);
}

export function canEditRequest(me, record) { return isPlatformAdmin(me) && record.status !== 'in_progress'; }
export function createFeature() {
  return createRecordFeature({ kind: 'request', title: 'Requests', editorLabel: 'request',
    statuses: ['queued', 'in_progress', 'needs_input', 'completed', 'cancelled', 'closed'], openSavedAfterCreate: false,
    heading: 'What would you like to work on?', newLabel: 'New request', openNewOnLoad: true,
    editorSections: ['requestFields'], fields: requestFields, payload: requestPayload,
    organizationId: requestOrganizationId,
    canCreate: me => isPlatformAdmin(me), canEdit: canEditRequest,
    allowStatus: (status, record) => status !== 'in_progress' || record.status === 'in_progress',
    saveLabel: record => record.status === 'queued' ? 'Save and queue request' : 'Save item',
    savedMessage: record => record.status === 'queued' ? 'Request saved and queued.' : 'Saved.',
    notice: (_me, record, editable) => !editable
      ? record.status === 'in_progress' ? 'The agent is processing these instructions. Add a comment below, or reconcile the run before changing the instructions.'
        : 'Executable requests are managed by the platform owner and Super Admins.'
      : 'Saving this request as queued authorizes the agent to process these instructions. Comments and results appear separately below.',
    configureEditor({ $, record, values }) { configureRequestScope($, record, values); },
    connect: connectRequests
  });
}

export function connectRequests(context) {
  const health = connectHealth(context);
  return { ...connectActivity(context), ...health,
    sectionChanged() {
      health.sectionChanged();
      // These generic controls must remain visible for every other feature.
      context.$('regionField').hidden = false;
      context.$('organizationScopeField').hidden = false;
    }
  };
}
