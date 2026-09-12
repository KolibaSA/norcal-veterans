import { canPublish } from './browser-ui.mjs';

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
    list(api) { return api('records?kind=' + definition.kind); }
  };
}
