import {field, safeURL} from '../../shared/public-http.mjs';

// Produces the existing private-review record body; it grants no publication or access.
export function programSubmission(form, organizations) {
  if (form.get('consent') !== 'yes') throw new Error('Please confirm permission to share your introduction.');
  const name = field(form, 'presenter_name', 120, true);
  const phone = field(form, 'phone', 40, true);
  const email = field(form, 'email', 254, true);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email address.');
  const validIds = organizations.map(record => record.id);
  const selected = form.get('all_orgs') === 'yes' ? validIds : [...new Set(form.getAll('org_id'))];
  if (!selected.length || selected.some(id => !validIds.includes(id))) throw new Error('Choose organizations from the list.');
  return {
    title: 'Program introduction: ' + field(form, 'organization_name', 150, true),
    body: JSON.stringify({ kind: 'speaker', name, phone, email, organizations: selected,
      description: field(form, 'organization_description', 1800, true), topic: field(form, 'topic', 1000, true),
      request: field(form, 'request_text', 1200), website: safeURL(field(form, 'website', 2000)) }, null, 2)
  };
}
