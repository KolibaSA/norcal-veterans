import { readScope } from '../../shared/server-auth.mjs';
import { HTTPError } from '../../shared/server-http.mjs';
import { rows } from '../../shared/server-storage.mjs';

// Selectors retrieve names and IDs through the same read scope as HQ records.
export async function organizationScopeOptions(env, user, grants, { query = '', page = 1, ids = [], includeFamilies = false } = {}) {
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw new HTTPError('Choose a valid page.');
  const scope = readScope(user, grants), values = [...scope.values];
  let pattern='';
  for (const character of String(query || '').trim().toLowerCase()) {
    const escaped=character.replace(/[\\%_]/g,'\\$&');
    if (new TextEncoder().encode(pattern+escaped).length>48) break;
    pattern+=escaped;
  }
  let condition = "kind='organization' AND " + scope.sql;
  if (pattern) { condition += " AND lower(title || ' ' || id) LIKE ? ESCAPE '\\'"; values.push('%' + pattern + '%'); }
  const found = await rows(env, `SELECT id,title,region_id FROM records WHERE ${condition} ORDER BY title COLLATE NOCASE,id LIMIT 26 OFFSET ?`, ...values, (page-1)*25);
  const wanted = [...new Set(ids.filter(id=>/^[-_a-zA-Z0-9]{1,120}$/.test(id)))].slice(0,10);
  const selected = wanted.length ? await rows(env, `SELECT id,title,region_id FROM records WHERE kind='organization' AND ${scope.sql} AND id IN (${wanted.map(()=>'?').join(',')})`, ...scope.values,...wanted) : [];
  const families = includeFamilies ? await rows(env, `SELECT DISTINCT json_extract(CASE WHEN json_valid(payload) THEN payload ELSE '{}' END,'$.organization_type') AS type FROM records WHERE kind='organization' AND ${scope.sql}`, ...scope.values) : [];
  return { organizations: found.slice(0,25), selected, page, hasMore: found.length>25, families: families.map(row=>row.type).filter(type=>typeof type==='string' && type).sort() };
}
