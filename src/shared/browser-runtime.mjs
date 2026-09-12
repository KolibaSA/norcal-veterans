import { esc, label, dateLabel, filterRecords, recordPath } from './browser-ui.mjs';

// Generic lifecycle mechanics; feature behavior and state arrive through the registry.
export function startBrowserRuntime({ registry, defaultTab, api, itemURL, initializeOptions, extensions = [] }) {
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  let tab = registry[params.get('tab')] ? params.get('tab') : defaultTab;
  let me, editing = null, baseline = '';
  let focusReturn = null, loadSequence = 0, conflictDraft = null, conflictLatest = null, recordSaving = false;
  const currentFeature = () => registry[tab];
  if (currentFeature().state) currentFeature().state.filter = { query: params.get('q') ?? '', status: params.get('status') ?? '' };
  const draftMemory = new Map();
  const readFields = () => Object.fromEntries(Object.keys(currentFeature().fields?.() ?? {}).map(id => [id, $(id).type === 'checkbox' ? $(id).checked : $(id).value]));
  const dirty = () => recordSaving || !$('editor').hidden && (JSON.stringify(readFields()) !== baseline || controllers.some(controller => controller.dirty?.()));
  const permitLeave = () => {
    if (recordSaving) { message('Please wait for this item to finish saving.'); return false; }
    return !dirty() || window.confirm('Discard the unsaved changes in this item?');
  };
  const scrollToEditor = () => {
    $('editor').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    $('editorTitle').focus({ preventScroll: true });
  };
  const context = {
    $, api, itemURL, message, permitLeave, openRecord, loadSection, navigate,
    get editing() { return editing; }, get me() { return me; }, get tab() { return tab; },
    markClean() { baseline = JSON.stringify(readFields()); },
    refreshScopeOptions: () => initializeOptions?.({ api, $, refresh: true }),
    async openDraft(kind, draft, source) {
      tab = kind; updateURL(null); await loadSection();
      await showEditor(draft, { checkDraft: false, source });
    }
  };
  const featureControllers = new Map(Object.values(registry).map(feature => [feature.kind, feature.connect?.(context) ?? {}]));
  const controllers = [...featureControllers.values(), ...extensions.map(connect => connect(context))];
  const notify = (hook, ...args) => controllers.forEach(controller => controller[hook]?.(...args));
  function message(text, error = false) {
    $('message').hidden = false;
    $('message').className = 'notice' + (error ? ' error' : '');
    $('message').textContent = text;
  }
  function updateURL(item = editing?.id) {
    const state = currentFeature().state?.filter ?? {};
    const query = new URLSearchParams({ tab });
    if (item) query.set('item', item);
    if (state.query) query.set('q', state.query);
    if (state.status) query.set('status', state.status);
    history.replaceState(null, '', '/hq?' + query);
  }
  function setFields(values) {
    for (const [id, value] of Object.entries(values)) {
      if (!$(id)) continue;
      if ($(id).type === 'checkbox') $(id).checked = !!value;
      else $(id).value = value ?? '';
    }
  }
  function recordFromForm() {
    const fields = readFields();
    return {
      kind: tab, title: fields.recordTitle, body: fields.recordBody, region_id: fields.region,
      organization_id: currentFeature().organizationId ? currentFeature().organizationId(fields, editing?.payload ?? {}) : fields.org,
      payload: currentFeature().payload(fields, editing?.payload ?? {}), version: editing?.version
    };
  }
  function editorPermissions(record) {
    const feature = currentFeature(), editable = feature.canEdit(me, record);
    $('recordInputs').disabled = !editable;
    $('save').hidden = !editable;
    $('save').textContent = feature.saveLabel(record);
    const notice = feature.notice(me, record, editable);
    $('editorNotice').hidden = !notice;
    $('editorNotice').textContent = notice;
    return editable;
  }
  async function showEditor(record = null, { checkDraft = true, updateLink = true, source = null } = {}) {
    if (checkDraft && !permitLeave()) return;
    editing = record ? structuredClone(record) : null;
    conflictDraft = null; conflictLatest = null;
    $('conflict').hidden = true;
    notify('resetEditor');
    $('editor').hidden = false;
    const feature = currentFeature();
    $('editorTitle').textContent = (record?.id ? 'View or edit ' : 'New ') + feature.editorLabel;
    $('itemLink').hidden = !record?.id;
    if (record?.id) $('itemLink').href = itemURL(tab, record.id);
    const defaults = {
      kind: tab, region_id: me.grants?.find(g => g.region_id)?.region_id || 'yolo-solano',
      organization_id: me.grants?.find(g => g.organization_id)?.organization_id || '', ...record
    };
    $('recordStatus').innerHTML = feature.statusesFor(me, defaults).map(status => '<option value="' + esc(status) + '">' + esc(label(status)) + '</option>').join('');
    const sections = new Set(Object.values(registry).flatMap(entry => entry.editorSections ?? []));
    for (const id of sections) $(id).hidden = !feature.editorSections.includes(id);
    $('region').disabled = !!record?.id; $('org').disabled = !!record?.id;
    const values = feature.fields(defaults);
    feature.configureEditor?.({ $, record: defaults, values });
    // Input type changes can clear dates, so assign canonical values last.
    setFields(values);
    const editable = editorPermissions({ ...defaults, status: $('recordStatus').value });
    baseline = JSON.stringify(readFields());
    if (updateLink) updateURL(record?.id);
    scrollToEditor();
    notify('editorOpened', record, { source, editable });
  }
  function closeEditor() {
    if (!permitLeave()) return;
    $('editor').hidden = true; editing = null;
    notify('editorClosed');
    updateURL(null);
    const target = focusReturn?.isConnected ? focusReturn : $('new') ?? $('title');
    target.focus();
  }
  function renderRows() {
    const { rows, filter: state } = currentFeature().state;
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
    const sequence = ++loadSequence, feature = currentFeature();
    $('editor').hidden = true; editing = null;
    $('title').textContent = feature.title;
    document.querySelectorAll('[data-tab]').forEach(link => {
      if (link.dataset.tab === tab) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    notify('sectionChanged');
    try {
      if (feature.statuses) {
        const result = await feature.list(api);
        if (sequence !== loadSequence) return;
        feature.state.rows = Array.isArray(result) ? result : result.records;
        const state = feature.state.filter;
        $('content').innerHTML = `<div class="bar"><h2>${esc(feature.heading)}</h2>${feature.canCreate(me) ? '<button type="button" id="new">' + esc(feature.newLabel) + '</button>' : ''}</div><div class="grid"><div><label for="search">Search this section</label><input type="search" id="search" placeholder="Title, description, or status"></div><div><label for="statusFilter">Filter by status</label><select id="statusFilter"><option value="">All statuses</option>${feature.statuses.map(status => `<option value="${esc(status)}">${esc(label(status))}</option>`).join('')}</select></div></div><div class="bar"><p id="resultCount" class="small muted" role="status"></p><button type="button" class="secondary" id="refreshList">Refresh items</button></div><div class="panel" id="list"></div>`;
        $('search').value = state.query; $('statusFilter').value = state.status;
        const filterChanged = () => {
          feature.state.filter = { query: $('search').value, status: $('statusFilter').value };
          updateURL(); renderRows();
        };
        $('search').oninput = filterChanged; $('statusFilter').onchange = filterChanged;
        if ($('new')) $('new').onclick = () => { focusReturn = $('new'); void showEditor(); };
        $('refreshList').onclick = () => { if (permitLeave()) void loadSection({ item: editing?.id }); };
        renderRows();
      } else await featureControllers.get(tab).render?.({ isCurrent: () => sequence === loadSequence });
      if (sequence !== loadSequence) return;
      notify('sectionLoaded');
      if (!item && feature.openNewOnLoad && feature.canCreate(me) && sequence === loadSequence) await showEditor();
      if (focus && !(feature.openNewOnLoad && !item)) $('title').focus();
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
      $('useDraft').disabled = !currentFeature().canEdit(me, conflictLatest);
      $('conflict').scrollIntoView({ behavior: 'auto', block: 'start' });
    } catch (cause) { message('Your unsaved draft is preserved in this tab. The latest item could not be loaded: ' + cause.message, true); }
  }
  $('useLatest').onclick = async () => {
    if (!conflictLatest) return;
    const latest = conflictLatest, saved = conflictDraft;
    await showEditor(latest, { checkDraft: false });
    conflictLatest = latest; conflictDraft = saved;
    $('conflict').hidden = false;
    $('useDraft').disabled = !currentFeature().canEdit(me, latest);
    message('Latest saved values loaded. Your earlier draft remains available in the comparison above.');
  };
  $('useDraft').onclick = async () => {
    if (!conflictLatest || !conflictDraft || !currentFeature().canEdit(me, conflictLatest)) return;
    const latest = conflictLatest, saved = conflictDraft;
    await showEditor(latest, { checkDraft: false });
    currentFeature().configureEditor?.({ $, record: latest, values: saved.fields });
    setFields(saved.fields);
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
      message(currentFeature().savedMessage(value));
      await currentFeature().afterSave?.(context);
      await loadSection({ item: id });
    } catch (cause) { message(cause.message, true); if (cause.status === 409) await showConflict(); }
    finally { $('save').disabled = false; recordSaving = false; }
  };
  $('cancel').onclick = closeEditor;
  $('recordStatus').onchange = () => editorPermissions({ ...(editing ?? {}), ...recordFromForm() });
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
    tab = registry[query.get('tab')] ? query.get('tab') : defaultTab;
    if (currentFeature().state) currentFeature().state.filter = { query: query.get('q') ?? '', status: query.get('status') ?? '' };
    void loadSection({ focus: true, item: query.get('item') });
  });
  async function initialize() {
    try {
      me = await api('me');
      $('identity').textContent = me.email;
      document.querySelectorAll('.owner').forEach(element => { element.hidden = !me.owner; });
      const [metadata] = await Promise.all([api('content-metadata'), initializeOptions?.({ api, $ })]);
      notify('initialize', metadata);
      await loadSection({ item: params.get('item') });
      notify('initialized');
    } catch (cause) {
      $('identity').textContent = 'Headquarters unavailable';
      $('content').textContent = cause.message;
      message('The headquarters could not be loaded. Your private data remains protected. Check your sign-in and try again.', true);
    }
  }
  return initialize();
}
