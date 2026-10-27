import { canPublish } from './browser-ui.mjs';

export async function fetchOrganizationChoices(api, { query = '', page = 1, ids = [], families = false } = {}) {
  const params = new URLSearchParams({ kind:'organization', scope_options:'1', page:String(page) });
  if (query) params.set('q',query);
  if (families) params.set('families','1');
  for (const id of ids.filter(Boolean)) params.append('id',id);
  return api('records?' + params);
}

// Only mechanics common to record-backed screens live here. Features supply rules.
export function createRecordFeature(definition) {
  const fields = definition.fields ?? (() => ({}));
  return {
    heading: 'Keep your community information current.', newLabel: 'Add item', editorLabel: 'item',
    canCreate: () => true, canEdit: (me, record) => record.status !== 'published' || canPublish(me, record),
    editorSections: [], payload: (_fields, previous = {}) => structuredClone(previous),
    organizationId: fields => fields.org,
    saveLabel: () => 'Save item', savedMessage: () => 'Saved.',
    notice: (_me, _record, editable) => editable ? '' : 'A publishing administrator must edit this published item.',
    ...definition,
    state: { rows: [], filter: { query: '', status: '' } },
    fields(record = {}) {
      return { recordTitle: record.title ?? '', recordBody: record.body ?? '', region: record.region_id ?? 'yolo-solano',
        org: record.organization_id ?? '', recordStatus: record.status ?? definition.statuses[0], ...fields(record) };
    },
    statusesFor(me, record) {
      return definition.statuses.filter(status => status !== 'published' || canPublish(me, record) || record.status === 'published')
        .filter(status => !definition.allowStatus || definition.allowStatus(status, record));
    },
    list(api, options) {
      const query = new URLSearchParams({ kind: definition.kind });
      if (options) {
        query.set('page', String(options.page || 1));
        if (options.query) query.set('q', options.query);
        if (options.status) query.set('status', options.status);
      }
      return api('records?' + query);
    },
    summary(api) { return api('records?' + new URLSearchParams({kind:definition.kind,summary:'1'})); }
  };
}
