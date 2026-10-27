import {publicOrganizationRecord,publicMeetingPlanEvents} from '../modules/organizations/public.mjs';
import {publicEventRecord,sanitizePublicEvent,eventCities} from '../modules/events/public.mjs';
import {occurrenceIndexReady,queryPublicEventPage,publicArchiveYears} from './public-occurrence-query.mjs';
import {queryPublicDirectory,queryNearbyOrganizations} from './public-directory-query.mjs';
const serializers = { organization: publicOrganizationRecord, event: publicEventRecord };
export function publicPayload(r) {
 try {
  if (!r || typeof r.id !== 'string' || !/^[-_a-zA-Z0-9]{1,120}$/.test(r.id) || typeof r.title !== 'string' || typeof r.body !== 'string') return null;
  const p = typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload;
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  return Object.hasOwn(serializers, r.kind) ? serializers[r.kind](r, p) : null;
 } catch { return null; }
}
export async function norcalPublicData(db) {
  if (!db) throw new Error('Public storage is unavailable.');
  const rows = (await db.prepare("SELECT id,kind,title,body,status,organization_id,payload FROM records WHERE kind IN ('organization','event') AND status='published'").all()).results;
  return assemblePublicData(db, rows, { allEvents: true });
}

async function assemblePublicData(db, rows, { allEvents = false } = {}) {
  const serialized = rows.map(row => ({ kind: row.kind, payload: publicPayload(row) }));
  const invalidCount = serialized.filter(row => !row.payload).length;
  if (invalidCount) console.warn(JSON.stringify({ event: 'public_content_rows_excluded', count: invalidCount }));
  const organizations=serialized.filter(row => row.kind === 'organization' && row.payload).map(row => row.payload);
  const planned=[];
  const byOrganization = new Map(organizations.map(organization => [organization.id, organization]));
  for(const row of rows.filter(row=>row.kind==='organization')){
    const organization=byOrganization.get(row.id);if(!organization)continue;
    try{planned.push(...publicMeetingPlanEvents(row,JSON.parse(row.payload),organization).map(sanitizePublicEvent).filter(Boolean));}catch{/* A malformed private plan cannot disable public content. */}
  }
  const plannedIds=new Set(planned.map(event=>event.id));
  const events=serialized.filter(row => row.kind === 'event' && row.payload).map(row => row.payload).filter(event=>!plannedIds.has(event.id)).concat(planned);
  const invitationTable=events.length && await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='organization_event_invitations'").first();
  if(invitationTable){
    const accepted=allEvents ? (await db.prepare("SELECT event_id,recipient_org_id FROM organization_event_invitations WHERE status='accepted' ORDER BY decision_at,created_at,id").all()).results : [];
    for (const ids of allEvents ? [] : chunks(events.map(event => event.id))) {
      accepted.push(...(await db.prepare(`SELECT event_id,recipient_org_id FROM organization_event_invitations WHERE status='accepted' AND event_id IN (${ids.map(() => '?').join(',')}) ORDER BY decision_at,created_at,id`).bind(...ids).all()).results);
    }
    const byEvent=new Map();
    for(const row of accepted){const ids=byEvent.get(row.event_id)||[];if(!ids.includes(row.recipient_org_id))ids.push(row.recipient_org_id);byEvent.set(row.event_id,ids);}
    for(const event of events)event.accepted_organization_ids=byEvent.get(event.id)||[];
  }
  events.sort((a,b)=>String(a.start_at).localeCompare(String(b.start_at))||a.id.localeCompare(b.id));
  return { records: organizations, events };
}

function chunks(values, size = 80) {
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

const columns = 'id,kind,title,body,status,organization_id,payload';
const safePayload = "CASE WHEN json_valid(payload) THEN payload ELSE '{}' END";
async function publishedRows(db, kind, where = '1', values = []) {
  return (await db.prepare(`SELECT ${columns} FROM records WHERE kind=? AND status='published' AND (${where})`).bind(kind, ...values).all()).results;
}
async function organizationsById(db, ids) {
  const rows = [];
  for (const group of chunks([...new Set(ids.filter(Boolean))])) {
    rows.push(...await publishedRows(db, 'organization', `id IN (${group.map(() => '?').join(',')})`, group));
  }
  return rows;
}

async function withEventOrganizations(db, eventRows, organizationRows = []) {
  const data = await assemblePublicData(db, [...organizationRows, ...eventRows]);
  const known = new Set(data.records.map(record => record.id));
  const ids = data.events.flatMap(event => [event.organization_id, ...(event.accepted_organization_ids || [])]).filter(id => !known.has(id));
  const related = await organizationsById(db, ids);
  // Related hosts and participants supply public names/logos, not their schedules.
  data.records.push(...related.map(publicPayload).filter(Boolean));
  return data;
}

// Stage one filters older event payloads before returning them to the Worker. This is a
// conservative prefilter: the Events serializer remains the date authority.
// Two days preserve date-only events through 25-hour Pacific DST days, ongoing
// events, and the existing 24-hour grace period for events without end times.
function recentEventFilter(now) {
  const p = safePayload;
  const dates = `CASE WHEN json_type(${p},'$.occurrences')='array' THEN json_extract(${p},'$.occurrences') WHEN json_type(${p},'$.additional_occurrences')='array' THEN json_extract(${p},'$.additional_occurrences') ELSE '[]' END`;
  const date = (payload, key) => `julianday(json_extract(${payload},'$.${key}'))`;
  const item = "CASE WHEN occurrence.type='object' THEN occurrence.value ELSE '{}' END";
  const predicate = payload => `(${date(payload, 'start_at')}>=julianday(?) OR ${date(payload, 'end_at')}>=julianday(?))`;
  const cutoff = new Date(now - 2 * 86400000).toISOString();
  return { sql: `(${predicate(p)} OR EXISTS (SELECT 1 FROM json_each(${dates}) occurrence WHERE occurrence.key<31 AND ${predicate(item)}))`, values: [cutoff, cutoff, cutoff, cutoff] };
}

// The full catalog remains available for explicit exports and crawl discovery.
// Ordinary routes choose a smaller read instead of calling norcalPublicData.
export async function publicDataForRequest(db, url, now = Date.now()) {
  const path = url.pathname;
  if (['/data.json', '/sitemap.xml'].includes(path)) return norcalPublicData(db);
  if (['/share', '/for-organizations', '/submit', '/speaker-submissions'].includes(path)) {
    return { records: (await publishedRows(db, 'organization')).map(publicPayload).filter(Boolean), events: [] };
  }
  const organization = path.match(/^\/organizations\/([-_a-zA-Z0-9]{1,120})$/);
  if (organization) {
    const rows = await organizationsById(db, [organization[1]]);
    if (!rows.length) return { records: [], events: [] };
    const events = await publishedRows(db, 'event', `COALESCE(NULLIF(organization_id,''),json_extract(${safePayload},'$.organization_id'))=?`, [organization[1]]);
    return withEventOrganizations(db, events, rows);
  }
  const eventId = path.match(/^\/events\/([-_a-zA-Z0-9]{1,120})$/)?.[1] || (path === '/events.ics' && url.searchParams.get('event'));
  if (eventId) {
    const events = await publishedRows(db, 'event', 'id=?', [eventId]);
    // A planned meeting has no detail page, but its existing calendar link works.
    const plans = path === '/events.ics' && eventId.startsWith('organization-meeting-vfw-ca-8151-') ? await organizationsById(db, ['vfw-ca-8151']) : [];
    const data = await withEventOrganizations(db, events, plans);
    data.events = data.events.filter(event => event.id === eventId);
    return data;
  }
  const listing = path === '/events';
  const directory = path === '/' || path === '/yolo-solano' || path.startsWith('/locations/');
  if (listing || directory || path === '/events.ics') {
    // Archive requests load historical payloads only after the visitor asks.
    // If the occurrence index is not ready, retain the conservative old path.
    const archive = listing && url.searchParams.has('past_year');
    const filter = recentEventFilter(now);
    // The regional home and location pages represent Yolo-Solano. Events may
    // explicitly select a region, while the general calendar remains complete.
    const requestedRegion = listing ? url.searchParams.get('region') : null;
    const region = path === '/events.ics' ? null : (requestedRegion && /^[-_a-zA-Z0-9]{1,80}$/.test(requestedRegion) ? requestedRegion : 'yolo-solano');
    if (path === '/' || path === '/yolo-solano') {
      const directoryPage = await queryPublicDirectory(db,url,region);
      const nearby = await queryNearbyOrganizations(db,region,url.searchParams.get('city'));
      const featuredIds = ['veterans-beer-club-yolo-solano','rememberavet','little-reata-veterans','mcl-yolo'];
      const featured = await publishedRows(db,'organization',`region_id=? AND id IN (${featuredIds.map(()=>'?').join(',')})`,[region,...featuredIds]);
      const base = [...new Map([...directoryPage.rows,...nearby,...featured].map(row=>[row.id,row])).values()];
      const parents = base.map(row=>row.id);
      const affiliates = parents.length ? await publishedRows(db,'organization',`region_id=? AND json_extract(${safePayload},'$.affiliated_with_id') IN (${parents.map(()=>'?').join(',')})`,[region,...parents]) : [];
      const organizations = [...new Map([...base,...affiliates].map(row=>[row.id,row])).values()];
      let events;
      try {
        events = await occurrenceIndexReady(db,region)
          ? (await queryPublicEventPage(db,{region,now,pageSize:3})).rows
          : await publishedRows(db,'event',filter.sql+' AND region_id=?',[...filter.values,region]);
      } catch { events = await publishedRows(db,'event',filter.sql+' AND region_id=?',[...filter.values,region]); }
      const data = await withEventOrganizations(db,events,organizations);
      data.directory = {ids:directoryPage.rows.map(row=>row.id),nearbyIds:nearby.map(row=>row.id),page:directoryPage.page,hasMore:directoryPage.hasMore,types:directoryPage.types};
      return data;
    }
    if (listing) {
      let ready = false;
      try { ready = await occurrenceIndexReady(db, region); } catch { /* The previous schema uses the existing fallback. */ }
      if (ready) {
        const requestedCity = url.searchParams.get('city') || '', city = eventCities.has(requestedCity) ? requestedCity : '';
        const validPage = value => /^\d{1,5}$/.test(value || '') && Number(value) > 0 ? Number(value) : 1;
        const upcoming = await queryPublicEventPage(db, { region,city,now,page:validPage(url.searchParams.get('page')) });
        let archivePage = null, years = [];
        if (archive) {
          years = await publicArchiveYears(db, { region,city,now });
          const currentYear = new Intl.DateTimeFormat('en-CA',{year:'numeric',timeZone:'America/Los_Angeles'}).format(new Date(now));
          if (!years.includes(currentYear)) years.push(currentYear);
          years.sort().reverse();
          const requestedYear = url.searchParams.get('past_year');
          const year = years.includes(requestedYear) ? requestedYear : currentYear;
          archivePage = { ...(await queryPublicEventPage(db, { region,city,now,year,page:validPage(url.searchParams.get('past_page')) })), year };
        }
        const selectedRows = [...upcoming.rows,...(archivePage?.rows || [])];
        const unique = [...new Map(selectedRows.map(row=>[row.id,row])).values()];
        const data = await withEventOrganizations(db, unique);
        data.pagination = { upcoming: { page:upcoming.page,hasMore:upcoming.hasMore,ids:upcoming.rows.map(row=>row.id) },
          archive: archivePage ? { page:archivePage.page,hasMore:archivePage.hasMore,ids:archivePage.rows.map(row=>row.id),year:archivePage.year,years } : null };
        return data;
      }
    }
    const eventWhere = [archive ? '1' : filter.sql, ...(region ? ['region_id=?'] : [])].join(' AND ');
    const events = await publishedRows(db, 'event', eventWhere, [...(archive ? [] : filter.values), ...(region ? [region] : [])]);
    const organizations = directory ? await publishedRows(db, 'organization', 'region_id=?', [region]) : path === '/events.ics' ? await organizationsById(db, ['vfw-ca-8151']) : [];
    return withEventOrganizations(db, events, organizations);
  }
  // Static pages and unknown routes do not depend on live directory storage.
  return { records: [], events: [] };
}
