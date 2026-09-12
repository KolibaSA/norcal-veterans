export const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
export const splitList = value => [...new Set(String(value ?? '').split(',').map(x => x.trim()).filter(Boolean))];
export const joined = values => Array.isArray(values) ? values.join(', ') : '';
export const label = value => String(value ?? '').replaceAll('_', ' ');

export function canPublish(me, record) {
  if (me?.owner) return true;
  return (me?.grants ?? []).some(grant => grant.email === me.email && (
    grant.role === 'region_admin' && grant.region_id && grant.region_id === record.region_id ||
    grant.role === 'organization_admin' && grant.organization_id && grant.organization_id === record.organization_id
  ));
}

export function filterRecords(records, query = '', status = '') {
  const search = query.trim().toLocaleLowerCase();
  return records.filter(record => (!status || record.status === status) &&
    `${record.title} ${record.body} ${label(record.status)}`.toLocaleLowerCase().includes(search));
}

export const dateLabel = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : 'Not recorded';
export const recordPath = id => 'records/' + encodeURIComponent(id);
