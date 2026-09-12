// This module is embedded by the build. Pure form helpers are also tested in Node.
export const TITLES = {
  request: 'Requests', overview: 'Your headquarters', task: 'Project work',
  submission: 'Public submissions', event: 'Events', organization: 'Organization profiles',
  coordination: 'Coordination', library: 'Ready-to-use copy', access: 'Organization & region access', audit: 'Change history'
};
export const STATUSES = {
  request: ['queued', 'in_progress', 'needs_input', 'completed', 'cancelled', 'closed'],
  task: ['open', 'in_progress', 'completed', 'closed'], organization: ['draft', 'published', 'archived'],
  event: ['draft', 'published', 'archived'], coordination: ['draft', 'active', 'archived'],
  library: ['draft', 'ready', 'archived'], submission: ['pending', 'reviewed', 'rejected']
};
export const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
export const splitList = value => [...new Set(String(value ?? '').split(',').map(x => x.trim()).filter(Boolean))];
const joined = values => Array.isArray(values) ? values.join(', ') : '';
const label = value => String(value ?? '').replaceAll('_', ' ');

export function pacificInput(value, dateOnly = false) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return dateOnly ? value : value + 'T00:00';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).map(x => [x.type, x.value]));
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  return dateOnly ? day : `${day}T${parts.hour}:${parts.minute}`;
}

export function canPublish(me, record) {
  if (me?.owner) return true;
  return (me?.grants ?? []).some(grant => grant.email === me.email && (
    grant.role === 'region_admin' && grant.region_id && grant.region_id === record.region_id ||
    grant.role === 'organization_admin' && grant.organization_id && grant.organization_id === record.organization_id
  ));
}

export function canEditRecord(me, record) {
  if (record.kind === 'request') return !!me?.owner && record.status !== 'in_progress';
  if (record.status === 'published' && !canPublish(me, record)) return false;
  return true; // The server remains the authority for scope on every mutation.
}

export function fieldsForRecord(record = {}) {
  const p = record.payload ?? {}, dayOnly = p.date_only === true;
  return {
    recordTitle: record.title ?? '', recordBody: record.body ?? '', region: record.region_id ?? 'yolo-solano',
    org: record.organization_id ?? '', recordStatus: record.status ?? STATUSES[record.kind]?.[0] ?? 'draft',
    city: p.city ?? '', county: p.location_county ?? '', type: p.organization_type ?? '',
    website: p.public_contacts?.website ?? '', phone: p.public_contacts?.phone ?? '', publicEmail: p.public_contacts?.email ?? '',
    address: p.address?.text ?? '', addressType: p.address?.type ?? '', mapEligible: p.address?.map_eligible === true,
    serviceCounties: joined(p.service_area?.counties), serviceCities: joined(p.service_area?.cities),
    serviceCategories: joined(p.service_categories), serviceNotes: p.service_area?.notes ?? '', referralNotes: p.referral_notes ?? '',
    sourceIds: joined(p.source_ids), reviewSource: p.review_source_url ?? '', verifiedDate: p.last_verified_date?.slice(0, 10) ?? '',
    confirmationDate: p.organization_confirmed_at?.slice(0, 10) ?? '', confirmationSource: p.confirmation_source_url ?? '',
    dateOnly: dayOnly, start: p.starts_local ?? pacificInput(p.start_at, dayOnly),
    end: p.ends_local ?? pacificInput(p.end_at, dayOnly), venue: p.venue ?? '', eventCity: p.city ?? '',
    eventCounty: p.county ?? '', eventKind: p.kind ?? '', organizer: p.organizer ?? '', audience: p.audience ?? '',
    source: p.source_url ?? '', sourceChecked: p.source_checked?.slice(0, 10) ?? '', timeNote: p.time_note ?? '',
    sourceKind: p.source_kind ?? '', sourceNote: p.source_note ?? '', reviewNotes: p.review_notes ?? ''
  };
}

export function payloadForFields(kind, fields, previous = {}) {
  const p = structuredClone(previous);
  if (kind === 'organization') {
    Object.assign(p, {
      verified_name: fields.recordTitle, member_information: fields.recordBody,
      city: fields.city, location_county: fields.county, organization_type: fields.type,
      public_contacts: { ...p.public_contacts, website: fields.website, phone: fields.phone, email: fields.publicEmail },
      address: fields.address ? { ...p.address, text: fields.address, type: fields.addressType, map_eligible: fields.mapEligible && fields.addressType !== 'mailing' } : null,
      service_area: { ...p.service_area, counties: splitList(fields.serviceCounties), cities: splitList(fields.serviceCities), notes: fields.serviceNotes },
      service_categories: splitList(fields.serviceCategories), referral_notes: fields.referralNotes,
      source_ids: splitList(fields.sourceIds), review_source_url: fields.reviewSource,
      last_verified_date: fields.verifiedDate || null, confirmation_source_url: fields.confirmationSource,
      organization_confirmed_at: fields.confirmationDate
        ? (previous.organization_confirmed_at?.slice(0, 10) === fields.confirmationDate ? previous.organization_confirmed_at : fields.confirmationDate + 'T00:00:00.000Z') : null,
      review_notes: fields.reviewNotes
    });
  }
  if (kind === 'event') {
    Object.assign(p, {
      title: fields.recordTitle, description: fields.recordBody, starts_local: fields.start,
      ends_local: fields.dateOnly ? '' : fields.end, date_only: !!fields.dateOnly,
      venue: fields.venue, city: fields.eventCity, county: fields.eventCounty,
      kind: fields.eventKind || 'Community event', organizer: fields.organizer, audience: fields.audience,
      source_url: fields.source, source_checked: fields.sourceChecked || null, time_note: fields.timeNote,
      source_kind: fields.sourceKind, source_note: fields.sourceNote, review_notes: fields.reviewNotes
    });
  }
  return p;
}

export function filterRecords(records, query = '', status = '') {
  const search = query.trim().toLocaleLowerCase();
  return records.filter(record => (!status || record.status === status) &&
    `${record.title} ${record.body} ${label(record.status)}`.toLocaleLowerCase().includes(search));
}

export function itemURL(kind, id, origin = '') {
  const query = new URLSearchParams({ tab: TITLES[kind] ? kind : 'request' });
  if (id) query.set('item', id);
  return origin + '/hq?' + query.toString();
}

export function submissionDraft(submission, kind) {
  if (!['event', 'organization'].includes(kind)) throw new Error('Choose an event or organization draft.');
  return {
    kind, title: submission.title, body: submission.payload?.public_description ?? '', status: 'draft',
    region_id: submission.region_id, organization_id: kind === 'event' ? submission.organization_id : null,
    payload: { intake_submission_id: submission.id, review_notes: 'Draft prepared from public submission: ' + submission.title }
  };
}

export function healthDescription(health, now = Date.now()) {
  if (!health?.configured) return 'Automatic request processing is not configured.';
  if (!health.last_successful_check) return 'Waiting for the first successful agent check.';
  const elapsed = now - Date.parse(health.last_successful_check);
  if (!Number.isFinite(elapsed) || elapsed > 15 * 60 * 1000) return 'The agent has not checked recently. Keep its computer awake with Codex running.';
  if (health.last_error && (!health.last_error_at || Date.parse(health.last_error_at) >= Date.parse(health.last_successful_check))) return 'The agent needs attention. Review the error below.';
  return health.current_request_id ? 'The agent has an active request.' : 'The agent checked successfully.';
}

export function startHeadquarters() {
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  let tab = TITLES[params.get('tab')] ? params.get('tab') : 'request';
  let me, metadata, rows = [], organizations = [], editing = null, baseline = '', requestHistory = null;
  let sourceSubmission = null, focusReturn = null, loadSequence = 0, conflictDraft = null, conflictLatest = null, recordSaving = false;
  const filterState = new Map([[tab, { query: params.get('q') ?? '', status: params.get('status') ?? '' }]]);
  const draftMemory = new Map();
  const fieldIDs = Object.keys(fieldsForRecord());
  const recordPath = id => 'records/' + encodeURIComponent(id);
  const requestPath = id => 'requests/' + encodeURIComponent(id);
  const dateLabel = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : 'Not recorded';
  const readFields = () => Object.fromEntries(fieldIDs.map(id => [id, $(id).type === 'checkbox' ? $(id).checked : $(id).value]));
  const dirty = () => recordSaving || !$('editor').hidden && (JSON.stringify(readFields()) !== baseline || !!$('commentBody').value.trim() || !!$('reconcileNote').value.trim());
  const permitLeave = () => {
    if (recordSaving) { message('Please wait for this item to finish saving.'); return false; }
    return !dirty() || window.confirm('Discard the unsaved changes in this item?');
  };
  const scrollToEditor = () => {
    $('editor').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    $('editorTitle').focus({ preventScroll: true });
  };
  function message(text, error = false) {
    $('message').hidden = false;
    $('message').className = 'notice' + (error ? ' error' : '');
    $('message').textContent = text;
  }
  async function api(path, options = {}) {
    const formData = options.body instanceof FormData;
    const response = await fetch('/api/hq/' + path, {
      ...options, headers: { ...(formData ? {} : { 'Content-Type': 'application/json' }), ...options.headers }
    });
    let data;
    try { data = await response.json(); } catch { throw new Error('The server did not return a valid response. Check your sign-in and try again.'); }
    if (!response.ok) {
      const cause = new Error(data.error || 'Unable to complete this request.');
      cause.status = response.status;
      throw cause;
    }
    return data;
  }
  function updateURL(item = editing?.id) {
    const state = filterState.get(tab) ?? {};
    const query = new URLSearchParams({ tab });
    if (item) query.set('item', item);
    if (state.query) query.set('q', state.query);
    if (state.status) query.set('status', state.status);
    history.replaceState(null, '', '/hq?' + query);
  }
  function setFields(values) {
    if (Object.hasOwn(values, 'dateOnly')) {
      $('start').type = values.dateOnly ? 'date' : 'datetime-local';
      $('end').type = values.dateOnly ? 'date' : 'datetime-local';
      $('end').disabled = !!values.dateOnly;
    }
    for (const [id, value] of Object.entries(values)) {
      if (!$(id)) continue;
      if ($(id).type === 'checkbox') $(id).checked = !!value;
      else $(id).value = value ?? '';
    }
  }
  function updateDateFields() {
    const dateOnly = $('dateOnly').checked;
    for (const id of ['start', 'end']) {
      const value = $(id).value;
      $(id).type = dateOnly ? 'date' : 'datetime-local';
      $(id).value = dateOnly ? value.slice(0, 10) : value && value.length === 10 ? value + 'T00:00' : value;
    }
    $('end').disabled = dateOnly;
  }
  function recordFromForm() {
    const fields = readFields();
    return {
      kind: tab, title: fields.recordTitle, body: fields.recordBody, region_id: fields.region,
      organization_id: fields.org, status: fields.recordStatus,
      payload: payloadForFields(tab, fields, editing?.payload ?? {}), version: editing?.version
    };
  }
  function editorPermissions(record) {
    const editable = canEditRecord(me, record);
    $('recordInputs').disabled = !editable;
    $('save').hidden = !editable;
    $('save').textContent = tab === 'request' && $('recordStatus').value === 'queued' ? 'Save and queue request' : 'Save item';
    $('editorNotice').hidden = editable && tab !== 'request';
    $('editorNotice').textContent = !editable
      ? tab === 'request' && record.status === 'in_progress'
        ? 'The agent is processing these instructions. Add a comment below, or reconcile the run before changing the instructions.'
        : tab === 'request' ? 'Executable requests are managed by the platform owner.' : 'A publishing administrator must edit this published item.'
      : 'Saving this request as queued authorizes the agent to process these instructions. Comments and results appear separately below.';
    return editable;
  }
  async function showEditor(record = null, { checkDraft = true, updateLink = true, source = null } = {}) {
    if (checkDraft && !permitLeave()) return;
    editing = record ? structuredClone(record) : null;
    requestHistory = null; sourceSubmission = source;
    conflictDraft = null; conflictLatest = null;
    $('conflict').hidden = true;
    $('commentForm').reset(); $('reconcileForm').reset(); $('recovery').open = false;
    $('editor').hidden = false;
    $('editorTitle').textContent = (record?.id ? 'View or edit ' : 'New ') + (tab === 'request' ? 'request' : tab === 'submission' ? 'public submission' : tab === 'organization' ? 'organization' : tab === 'event' ? 'event' : 'item');
    $('itemLink').hidden = !record?.id;
    if (record?.id) $('itemLink').href = itemURL(tab, record.id);
    const defaults = {
      kind: tab, region_id: me.grants?.find(g => g.region_id)?.region_id || 'yolo-solano',
      organization_id: me.grants?.find(g => g.organization_id)?.organization_id || '', ...record
    };
    const statuses = STATUSES[tab].filter(status => status !== 'published' || canPublish(me, defaults) || record?.status === 'published')
      .filter(status => tab !== 'request' || status !== 'in_progress' || record?.status === 'in_progress');
    $('recordStatus').innerHTML = statuses.map(status => `<option value="${esc(status)}">${esc(label(status))}</option>`).join('');
    $('organizationFields').hidden = tab !== 'organization';
    $('eventFields').hidden = tab !== 'event';
    $('reviewFields').hidden = !['event', 'organization'].includes(tab);
    const priorAddressType = defaults.payload?.address?.type;
    if (priorAddressType && !Array.from($('addressType').options).some(option => option.value === priorAddressType)) {
      $('addressType').add(new Option(label(priorAddressType) + ' (existing; not a verified public venue)', priorAddressType));
    }
    setFields(fieldsForRecord(defaults));
    updateDateFields();
    // Setting input type can clear a date-only value; assign canonical form values last.
    const eventFields = fieldsForRecord(defaults);
    $('start').value = eventFields.start; $('end').value = eventFields.end;
    $('region').disabled = !!record?.id; $('org').disabled = !!record?.id || tab === 'organization';
    $('start').required = tab === 'event'; $('venue').required = tab === 'event';
    const editable = editorPermissions(defaults);
    $('attachmentSection').hidden = !record?.id;
    $('fileForm').hidden = !me.uploads || !editable;
    $('storageNote').hidden = !!me.uploads;
    $('submissionActions').hidden = tab !== 'submission' || !record?.id;
    $('submissionSource').hidden = !source;
    $('submissionSource').innerHTML = source ? `<h3>Original submission: ${esc(source.title)}</h3><p class="preserve">${esc(source.body)}</p><p class="small">This original text remains private. Write and verify the public description before publishing.</p>` : '';
    $('requestActivity').hidden = tab !== 'request' || !record?.id || !me.owner;
    $('revisionSection').hidden = !record?.id;
    $('revisions').textContent = 'Loading revision history…';
    baseline = JSON.stringify(readFields());
    if (updateLink) updateURL(record?.id);
    scrollToEditor();
    if (record?.id) {
      void loadFiles(record.id);
      void loadRevisions(record.id);
      if (tab === 'request' && me.owner) void loadActivity(record.id);
    }
  }
  function closeEditor() {
    if (!permitLeave()) return;
    $('editor').hidden = true; editing = null; sourceSubmission = null;
    $('commentForm').reset(); $('reconcileForm').reset();
    updateURL(null);
    const target = focusReturn?.isConnected ? focusReturn : $('new') ?? $('title');
    target.focus();
  }
  async function loadFiles(id) {
    try {
      const files = await api('attachments?record_id=' + encodeURIComponent(id));
      if (editing?.id !== id) return;
      $('files').innerHTML = files.map(file => `<a href="/api/hq/attachments/${encodeURIComponent(file.id)}">${esc(file.filename)} · ${Math.ceil(file.size / 1024)} KB</a>`).join('') || '<p class="small muted">No attachments.</p>';
    } catch (cause) { if (editing?.id === id) $('files').textContent = cause.message; }
  }
  async function loadRevisions(id) {
    try {
      const revisions = await api(recordPath(id) + '/history');
      if (editing?.id !== id) return;
      $('revisions').innerHTML = revisions.map(revision => `<details><summary>${esc(dateLabel(revision.created_at))} · ${esc(revision.actor)} · revision ${esc(revision.version)}</summary><h4>${esc(revision.record?.title)}</h4><p>Status: ${esc(label(revision.record?.status))}</p><pre>${esc(revision.record?.body)}</pre><details><summary>Other saved fields</summary><pre>${esc(JSON.stringify(revision.record?.payload ?? {}, null, 2))}</pre></details></details>`).join('') || '<p>No saved revisions are available yet. New saves will appear here.</p>';
    } catch (cause) { if (editing?.id === id) $('revisions').textContent = cause.message; }
  }
  async function loadActivity(id = editing?.id) {
    if (!id || !me.owner) return;
    $('refreshActivity').disabled = true;
    try {
      const activity = await api(requestPath(id) + '/history');
      if (editing?.id !== id) return;
      requestHistory = activity;
      const entries = activity.entries ?? [];
      $('activity').innerHTML = entries.map(entry => `<article class="timeline"><h4>${esc(label(entry.kind))}${entry.status ? ' · ' + esc(label(entry.status)) : ''}</h4><p class="small muted">${esc(entry.actor)} · ${esc(dateLabel(entry.created_at))}</p><pre>${esc(entry.body)}</pre></article>`).join('') || '<p class="muted">No results or comments yet.</p>';
      if (activity.active_run) $('activity').insertAdjacentHTML('afterbegin', `<p class="notice">Current run started ${esc(dateLabel(activity.active_run.claimed_at))}. Its instructions are preserved in the run history.</p>`);
      const runs = activity.runs ?? [];
      if (runs.length) $('activity').insertAdjacentHTML('beforeend', `<details><summary>Request run history</summary>${runs.map(run => `<details><summary>${esc(label(run.state))} · ${esc(dateLabel(run.claimed_at))}</summary><h4>${esc(run.snapshot?.title)}</h4><pre>${esc(run.snapshot?.body)}</pre></details>`).join('')}</details>`);
      $('recovery').hidden = !activity.active_run && activity.status !== 'in_progress';
      if (activity.version !== editing.version || activity.status !== editing.status) {
        message('This request has changed. Your unsaved form is preserved; close and reopen it for the latest instructions. Activity and reconciliation use the current request status.');
      }
    } catch (cause) { if (editing?.id === id) $('activity').textContent = cause.message; }
    finally { $('refreshActivity').disabled = false; }
  }
  async function loadHealth() {
    if (tab !== 'request') return;
    if (!me.owner) {
      $('processor').textContent = 'Executable requests are managed by the platform owner. Your assignment controls which project records you can edit.';
      return;
    }
    try {
      const health = await api('agent-health');
      if (tab !== 'request') return;
      $('processor').innerHTML = `<strong>${esc(healthDescription(health))}</strong><p>Queued owner requests are checked every five minutes while the agent computer is awake with Codex running.</p><p class="small">Last successful check: ${esc(dateLabel(health.last_successful_check))} · Queued: ${esc(health.queued ?? 'Unknown')}</p>${health.current_request_id ? `<p>Current request: <a data-open-request="${esc(health.current_request_id)}" href="${itemURL('request', health.current_request_id)}">${esc(health.current_request_title || 'Open current request')}</a></p>` : ''}${health.last_error ? `<p class="error notice">${esc(health.last_error)}${health.last_error_at ? ' · ' + esc(dateLabel(health.last_error_at)) : ''}</p>` : ''}<button class="secondary" type="button" id="refreshHealth">Refresh agent status</button>`;
      $('refreshHealth').onclick = loadHealth;
      const current = $('processor').querySelector('[data-open-request]');
      if (current) current.onclick = async event => { event.preventDefault(); if (permitLeave()) await openRecord(current.dataset.openRequest, false); };
    } catch (cause) { if (tab === 'request') $('processor').textContent = 'Agent status is unavailable: ' + cause.message; }
  }
  function renderRows() {
    const state = filterState.get(tab) ?? { query: '', status: '' };
    const visible = filterRecords(rows, state.query, state.status);
    $('list').innerHTML = visible.map(record => `<article class="record"><div><span class="pill">${esc(label(record.status))}</span><h3>${esc(record.title)}</h3><p>${esc(record.body?.slice(0, 450))}</p><p class="scope">${esc(record.region_id)}${record.organization_id ? ' · ' + esc(record.organization_id) : ''} · Updated ${esc(dateLabel(record.updated_at))}</p></div><div><button type="button" class="secondary" data-edit="${esc(record.id)}" aria-label="Open ${esc(record.title)}">Open item</button></div></article>`).join('') || '<p class="empty">No items match these filters.</p>';
    $('resultCount').textContent = `${visible.length} of ${rows.length} loaded items${rows.length === 500 ? ' · Showing the 500 most recently updated items. Older items remain available through their direct links.' : ''}`;
    $('list').querySelectorAll('[data-edit]').forEach(button => {
      button.onclick = async () => { if (!permitLeave()) return; focusReturn = button; await openRecord(button.dataset.edit, false); };
    });
  }
  async function openRecord(id, checkDraft = true) {
    if (checkDraft && !permitLeave()) return;
    try {
      const record = await api(recordPath(id));
      if (record.kind !== tab) { tab = record.kind; await loadSection({ focus: false }); }
      await showEditor(record, { checkDraft: false });
    } catch (cause) { message(cause.message, true); }
  }
  async function loadSection({ focus = false, item = null } = {}) {
    const sequence = ++loadSequence;
    $('editor').hidden = true; editing = null;
    $('title').textContent = TITLES[tab];
    document.querySelectorAll('[data-tab]').forEach(link => {
      if (link.dataset.tab === tab) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    $('processor').hidden = tab !== 'request';
    try {
      if (STATUSES[tab]) {
        const result = await api('records?kind=' + tab);
        if (sequence !== loadSequence) return;
        rows = Array.isArray(result) ? result : result.records;
        const state = filterState.get(tab) ?? { query: '', status: '' };
        filterState.set(tab, state);
        $('content').innerHTML = `<div class="bar"><h2>${tab === 'request' ? 'What would you like to work on?' : 'Keep your community information current.'}</h2>${tab === 'request' && !me.owner ? '' : '<button type="button" id="new">' + (tab === 'request' ? 'New request' : 'Add item') + '</button>'}</div><div class="grid"><div><label for="search">Search this section</label><input type="search" id="search" placeholder="Title, description, or status"></div><div><label for="statusFilter">Filter by status</label><select id="statusFilter"><option value="">All statuses</option>${STATUSES[tab].map(status => `<option value="${esc(status)}">${esc(label(status))}</option>`).join('')}</select></div></div><div class="bar"><p id="resultCount" class="small muted" role="status"></p><button type="button" class="secondary" id="refreshList">Refresh items</button></div><div class="panel" id="list"></div>`;
        $('search').value = state.query; $('statusFilter').value = state.status;
        const filterChanged = () => {
          filterState.set(tab, { query: $('search').value, status: $('statusFilter').value });
          updateURL(); renderRows();
        };
        $('search').oninput = filterChanged; $('statusFilter').onchange = filterChanged;
        if ($('new')) $('new').onclick = () => { focusReturn = $('new'); void showEditor(); };
        $('refreshList').onclick = () => { if (permitLeave()) void loadSection({ item: editing?.id }); };
        renderRows();
        if (tab === 'request') void loadHealth();
      } else if (tab === 'overview') {
        const values = await Promise.all(['request', 'task', 'organization'].map(kind => api('records?kind=' + kind)));
        if (sequence !== loadSequence) return;
        const [requests, tasks, orgs] = values;
        $('content').innerHTML = `<div class="stats"><div class="stat"><b>${requests.filter(x => !['completed', 'closed', 'cancelled'].includes(x.status)).length}</b>Open requests</div><div class="stat"><b>${tasks.filter(x => !['completed', 'closed'].includes(x.status)).length}</b>Project items</div><div class="stat"><b>${orgs.length}</b>Organization profiles</div></div><div class="panel"><h2>A shared home for the work between meetings.</h2><p>Use Requests to record changes, research, or ideas. Review public submissions and verify information before publishing profiles or events.</p><button type="button" id="goRequests">Open Requests</button></div>`;
        $('goRequests').onclick = () => navigate('request');
      } else if (tab === 'access') await renderAccess(sequence);
      else if (tab === 'audit') {
        const entries = await api('audit');
        if (sequence !== loadSequence) return;
        $('content').innerHTML = `<div class="panel audit"><table><caption>Most recent headquarters changes</caption><thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">Action</th><th scope="col">Item</th></tr></thead><tbody>${entries.map(entry => `<tr><td>${esc(dateLabel(entry.created_at))}</td><td>${esc(entry.actor)}</td><td>${esc(label(entry.action))}</td><td>${esc(entry.record_id)}</td></tr>`).join('')}</tbody></table></div>`;
      }
      if (focus) $('title').focus();
      if (item && sequence === loadSequence) await openRecord(item, false);
    } catch (cause) {
      if (sequence === loadSequence) { $('content').textContent = 'This section could not be loaded.'; message(cause.message, true); }
    }
  }
  async function navigate(nextTab) {
    if (!permitLeave()) return;
    tab = nextTab; updateURL(null);
    await loadSection({ focus: true });
  }
  async function renderAccess(sequence) {
    if (!me.owner) throw new Error('Only the platform owner manages access.');
    const grants = await api('access');
    if (sequence !== loadSequence) return;
    $('content').innerHTML = `<div class="notice">Assignments control access within this headquarters. People must also be allowed through Cloudflare Access. Revocation here takes effect on their next request.</div><form id="grant" class="panel"><h2>Assign an administrator or editor</h2><label for="email">Email</label><input id="email" type="email" required><label for="role">Role</label><select id="role"><option value="region_admin">Region administrator</option><option value="organization_admin">Organization administrator</option><option value="editor">Editor</option></select><label for="scopeType">Scope</label><select id="scopeType"><option value="region">Region</option><option value="organization">Organization</option></select><label for="scopeValue">Region slug or organization ID</label><input id="scopeValue" required value="yolo-solano"><p class="small muted">Organization IDs appear in each organization profile's scope.</p><button type="submit">Save assignment</button></form><div class="panel">${grants.map(grant => `<div class="record"><div><b>${esc(grant.email)}</b><p>${esc(label(grant.role))} · ${esc(grant.region_id || grant.organization_id)}</p></div><button type="button" class="secondary" data-revoke="${esc(grant.id)}" aria-label="Revoke ${esc(grant.email)} assignment">Revoke</button></div>`).join('')}</div>`;
    $('grant').onsubmit = async event => {
      event.preventDefault();
      const button = event.submitter; button.disabled = true;
      try {
        const value = { email: $('email').value, role: $('role').value };
        value[$('scopeType').value === 'region' ? 'region_id' : 'organization_id'] = $('scopeValue').value;
        await api('access', { method: 'POST', body: JSON.stringify(value) });
        message('Assignment saved.'); await loadSection();
      } catch (cause) { message(cause.message, true); }
      finally { button.disabled = false; }
    };
    $('content').querySelectorAll('[data-revoke]').forEach(button => {
      button.onclick = async () => {
        if (!window.confirm('Revoke this assignment? The person will lose this scope on their next request.')) return;
        button.disabled = true;
        try { await api('access/' + encodeURIComponent(button.dataset.revoke), { method: 'DELETE' }); message('Assignment revoked.'); await loadSection(); }
        catch (cause) { message(cause.message, true); button.disabled = false; }
      };
    });
  }
  function comparisonText(record) {
    return `${record.title}\nStatus: ${label(record.status)}\n\n${record.body}\n\nOther fields:\n${JSON.stringify(record.payload, null, 2)}`;
  }
  async function showConflict() {
    if (!editing?.id) return;
    conflictDraft = { record: recordFromForm(), fields: readFields() };
    draftMemory.set(editing.id, structuredClone(conflictDraft));
    try {
      conflictLatest = await api(recordPath(editing.id));
      $('comparison').innerHTML = `<div class="comparison"><h4>Your unsaved draft</h4><pre>${esc(comparisonText(conflictDraft.record))}</pre></div><div class="comparison"><h4>Latest saved item</h4><pre>${esc(comparisonText(conflictLatest))}</pre></div>`;
      $('conflict').hidden = false;
      $('useDraft').disabled = !canEditRecord(me, conflictLatest);
      $('conflict').scrollIntoView({ behavior: 'auto', block: 'start' });
    } catch (cause) { message('Your unsaved draft is preserved in this tab. The latest item could not be loaded: ' + cause.message, true); }
  }
  $('useLatest').onclick = async () => {
    if (!conflictLatest) return;
    const latest = conflictLatest, saved = conflictDraft;
    await showEditor(latest, { checkDraft: false });
    conflictLatest = latest; conflictDraft = saved;
    $('conflict').hidden = false;
    $('useDraft').disabled = !canEditRecord(me, latest);
    message('Latest saved values loaded. Your earlier draft remains available in the comparison above.');
  };
  $('useDraft').onclick = async () => {
    if (!conflictLatest || !conflictDraft || !canEditRecord(me, conflictLatest)) return;
    const latest = conflictLatest, saved = conflictDraft;
    await showEditor(latest, { checkDraft: false });
    setFields(saved.fields); updateDateFields();
    message('Your draft is restored against the latest version. Review it before saving; saved values will be replaced by the fields shown here.');
  };
  $('recordForm').onsubmit = async event => {
    event.preventDefault(); $('save').disabled = true; recordSaving = true;
    try {
      const value = recordFromForm();
      const result = await api('records' + (editing?.id ? '/' + encodeURIComponent(editing.id) : ''), {
        method: editing?.id ? 'PUT' : 'POST', body: JSON.stringify(value)
      });
      const id = editing?.id || result.id;
      draftMemory.delete(id); baseline = JSON.stringify(readFields());
      message(value.kind === 'request' && value.status === 'queued' ? 'Request saved and queued.' : 'Saved.');
      if (tab === 'organization') {
        organizations = await api('records?kind=organization');
        $('org').innerHTML = '<option value="">Region-wide</option>' + organizations.map(org => `<option value="${esc(org.id)}">${esc(org.title)}</option>`).join('');
      }
      await loadSection({ item: id });
    } catch (cause) { message(cause.message, true); if (cause.status === 409) await showConflict(); }
    finally { $('save').disabled = false; recordSaving = false; }
  };
  $('commentForm').onsubmit = async event => {
    event.preventDefault();
    if (!editing?.id || !requestHistory) return message('Refresh request activity before adding a comment.', true);
    const button = event.submitter; button.disabled = true;
    try {
      await api(requestPath(editing.id) + '/comments', { method: 'POST', body: JSON.stringify({ body: $('commentBody').value, expected_version: requestHistory.version }) });
      $('commentForm').reset(); message('Comment added.'); await loadActivity();
    } catch (cause) { message(cause.message, true); if (cause.status === 409) await loadActivity(); }
    finally { button.disabled = false; }
  };
  $('reconcileForm').onsubmit = async event => {
    event.preventDefault();
    if (!editing?.id || !requestHistory) return message('Refresh request activity before reconciling it.', true);
    const button = event.submitter; button.disabled = true;
    try {
      await api(requestPath(editing.id) + '/reconcile', { method: 'POST', body: JSON.stringify({
        expected_version: requestHistory.version, expected_status: requestHistory.status,
        expected_run_id: requestHistory.active_run?.id ?? null,
        status: $('reconcileStatus').value, note: $('reconcileNote').value
      }) });
      const id = editing.id;
      $('reconcileForm').reset(); baseline = JSON.stringify(readFields());
      message('Outcome recorded. The request can move forward without automatically repeating the previous work.');
      await loadSection({ item: id });
    } catch (cause) { message(cause.message, true); if (cause.status === 409) await loadActivity(); }
    finally { button.disabled = false; }
  };
  $('fileForm').onsubmit = async event => {
    event.preventDefault();
    const file = $('file').files[0];
    if (!file || file.size > 10 * 1024 * 1024) return message('Choose a file smaller than 10 MB.', true);
    const button = event.submitter; button.disabled = true;
    try {
      const data = new FormData(); data.append('record_id', editing.id); data.append('file', file);
      await api('attachments', { method: 'POST', body: data });
      message('Attachment uploaded.'); $('file').value = ''; await loadFiles(editing.id);
    } catch (cause) { message(cause.message, true); }
    finally { button.disabled = false; }
  };
  async function prepareDraft(kind) {
    if (!editing || !permitLeave()) return;
    const submission = editing, draft = submissionDraft(submission, kind);
    tab = kind; updateURL(null); await loadSection();
    await showEditor(draft, { checkDraft: false, source: submission });
    message('Draft prepared. Review the source and add a public description before saving.');
  }
  $('draftEvent').onclick = () => prepareDraft('event');
  $('draftOrganization').onclick = () => prepareDraft('organization');
  $('cancel').onclick = closeEditor;
  $('dateOnly').onchange = updateDateFields;
  $('recordStatus').onchange = () => editorPermissions({ ...(editing ?? {}), ...recordFromForm() });
  $('addressType').onchange = () => { if ($('addressType').value === 'mailing') $('mapEligible').checked = false; };
  $('refreshActivity').onclick = () => loadActivity();
  document.querySelectorAll('[data-tab]').forEach(link => {
    link.onclick = event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); void navigate(link.dataset.tab);
    };
  });
  window.addEventListener('beforeunload', event => { if (dirty()) { event.preventDefault(); event.returnValue = ''; } });
  window.addEventListener('popstate', () => {
    if (!permitLeave()) return updateURL();
    const query = new URLSearchParams(location.search);
    tab = TITLES[query.get('tab')] ? query.get('tab') : 'request';
    filterState.set(tab, { query: query.get('q') ?? '', status: query.get('status') ?? '' });
    void loadSection({ focus: true, item: query.get('item') });
  });
  async function initialize() {
    try {
      me = await api('me');
      $('identity').textContent = me.email;
      document.querySelectorAll('.owner').forEach(element => { element.hidden = !me.owner; });
      [metadata, organizations] = await Promise.all([api('content-metadata'), api('records?kind=organization')]);
      $('countyOptions').innerHTML = metadata.counties.map(value => `<option value="${esc(value)}"></option>`).join('');
      $('typeOptions').innerHTML = metadata.organizationTypes.map(value => `<option value="${esc(value)}"></option>`).join('');
      $('addressType').innerHTML = '<option value="">Not recorded</option>' + metadata.addressTypes.map(value => `<option value="${esc(value)}">${esc(label(value))}</option>`).join('');
      $('org').innerHTML = '<option value="">Region-wide</option>' + organizations.map(org => `<option value="${esc(org.id)}">${esc(org.title)}</option>`).join('');
      await loadSection({ item: params.get('item') });
      window.setInterval(() => { if (!document.hidden && tab === 'request') void loadHealth(); }, 60000);
    } catch (cause) {
      $('identity').textContent = 'Headquarters unavailable';
      $('content').textContent = cause.message;
      message('The headquarters could not be loaded. Your private data remains protected. Check your sign-in and try again.', true);
    }
  }
  return initialize();
}

if (typeof document !== 'undefined') void startHeadquarters();
