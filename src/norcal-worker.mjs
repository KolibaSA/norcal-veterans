import legacy from '../worker/legacy/index.mjs';
import { publicPayload } from '../worker/legacy/public.mjs';
import { dataset, records, sources } from './data.mjs';
import { render, shell } from './site.mjs';
import { publicExtension, eventCalendar, submissionPage, upcomingEvents } from './public-tools.mjs';
import { speakerSubmissionPage } from './speaker-submissions.mjs';
import { securityHeaders, responseHTML, formData, field, choice, safeURL, redirect } from './storage.mjs';
import { sanitizePublicRecord } from './public-privacy.mjs';
import { memorialServices } from './memorial-day.mjs';

export async function norcalPublicData(db) {
  if (!db) throw new Error('Public storage is unavailable.');
  const rows = (await db.prepare("SELECT id,kind,title,body,status,organization_id,payload FROM records WHERE kind IN ('organization','event') AND status='published'").all()).results;
  return {
    records: rows.filter(row => row.kind === 'organization').map(row => {
      const payload = JSON.parse(row.payload);
      return sanitizePublicRecord({ missing_data_flags: [], source_ids: [], service_categories: [], ...records.find(record => record.id === row.id), ...payload, id: row.id, verified_name: row.title, member_information: row.body });
    }),
    events: rows.filter(row => row.kind === 'event').map(row => {
      const payload = JSON.parse(row.payload);
      return { ...publicPayload(row), organization_id: row.organization_id || payload.organization_id || null, date_only: payload.date_only === true, source_kind: payload.source_kind, source_note: payload.source_note };
    })
  };
}

async function saveSubmission(request, env, live) {
  const form = await formData(request);
  if (field(form, 'website_check')) throw new Error('Submission could not be accepted.');
  const speaker = new URL(request.url).pathname === '/speaker-submissions';
  const validIds = live.records.map(record => record.id);
  let title, detail;
  if (speaker) {
    if (form.get('consent') !== 'yes') throw new Error('Please confirm permission to share your introduction.');
    const name = field(form, 'presenter_name', 120, true), phone = field(form, 'phone', 40, true), email = field(form, 'email', 254, true);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email address.');
    const selected = form.get('all_orgs') === 'yes' ? validIds : [...new Set(form.getAll('org_id'))];
    if (!selected.length || selected.some(id => !validIds.includes(id))) throw new Error('Choose organizations from the list.');
    title = 'Program introduction: ' + field(form, 'organization_name', 150, true);
    detail = JSON.stringify({ kind: 'speaker', name, phone, email, organizations: selected,
      description: field(form, 'organization_description', 1800, true), topic: field(form, 'topic', 1000, true),
      request: field(form, 'request_text', 1200), website: safeURL(field(form, 'website', 2000)) }, null, 2);
  } else {
    if (form.get('privacy') !== 'yes') throw new Error('Please confirm that the update contains public organization information only.');
    const kind = choice(field(form, 'kind'), ['profile', 'event', 'claim', 'other']);
    const orgId = field(form, 'org_id', 100);
    if (orgId && !validIds.includes(orgId)) throw new Error('Choose an organization from the list.');
    const name = field(form, 'sender_name', 120, true), email = field(form, 'sender_email', 254, true);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email address.');
    title = field(form, 'title', 180, true);
    detail = JSON.stringify({ kind, orgId, name, email, details: field(form, 'details', 6000, true), source: safeURL(field(form, 'source_url', 2000)) }, null, 2);
  }
  if (!request.headers.get('CF-Connecting-IP')) throw new Error('Submission could not be verified. Please try again.');
  const headers = new Headers(request.headers);
  headers.delete('Content-Length');
  headers.set('Content-Type', 'application/json');
  const result = await legacy.fetch(new Request(new URL('/api/submissions', request.url), {
    method: 'POST', headers, body: JSON.stringify({ title, body: detail })
  }), env);
  if (!result.ok) throw new Error((await result.json()).error || 'Your submission could not be saved.');
  return redirect((speaker ? '/share' : '/for-organizations') + '?received=1');
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url), path = url.pathname, head = request.method === 'HEAD';
    if (path === '/hq' || path.startsWith('/hq/') || path.startsWith('/api/')) return legacy.fetch(request, env, ctx);
    if (path === '/organization' || path === '/photo-presence') return redirect('/hq');
    if (path === '/' && ['www.norcalveterans.org', 'norcalveterans.org'].includes(url.hostname) && ['GET','HEAD'].includes(request.method)) {
      url.pathname = '/yolo-solano';
      return new Response(null, { status: 302, headers: { Location: url.href, 'Cache-Control': 'no-store' } });
    }
    if (['GET','HEAD'].includes(request.method) && (/^\/(?:logos|published-assets|assets)\//.test(path) || ['/styles.css','/app.js','/favicon.svg','/ysv-logo.png','/og.png'].includes(path))) {
      const asset = await env.ASSETS.fetch(request);
      return new Response(asset.body, { status: asset.status, headers: { ...Object.fromEntries(asset.headers), ...securityHeaders, 'Cache-Control': 'public, max-age=300' } });
    }
    if (path === '/regions' && ['GET','HEAD'].includes(request.method)) return localPage(head ? '' : shell('Regions | NorCal Veterans', 'Explore the NorCal Veterans community.', '<section class="wrap"><h1>Explore our regions</h1><p><a class="button" href="/yolo-solano">Yolo-Solano: organizations, events and resources</a></p></section>', {path:'/regions'}));
    if (path === '/health' && ['GET','HEAD'].includes(request.method)) return Response.json({ status: 'ok', project: 'NorCal Veterans', release: 'project-hq-20260912' }, { headers: { 'Cache-Control': 'no-store' } });
    try {
      if (!['GET','HEAD'].includes(request.method) && !(request.method === 'POST' && ['/submit','/speaker-submissions'].includes(path))) return new Response('Method not allowed.', { status: 405 });
      const live = await norcalPublicData(env.DB);
      if (request.method === 'POST') {
        try { return await saveSubmission(request, env, live); }
        catch (error) {
          const message = /D1_|SQLITE|database/i.test(error.message) ? 'The submission desk is temporarily unavailable.' : error.message;
          const html = path === '/speaker-submissions' ? speakerSubmissionPage(url, live.records, { error: message }) : submissionPage(url, { error: message, organizations: live.records });
          return localPage(html, 400, true);
        }
      }
      if (path === '/data.json') return Response.json({ ...dataset, records: live.records, events: live.events, sources, memorial_services: memorialServices }, { headers: { ...securityHeaders, 'Cache-Control': 'public, max-age=30' } });
      if (path === '/events.ics') return new Response(head ? null : eventCalendar(url.searchParams.has('event') ? live.events.filter(event => event.id === url.searchParams.get('event')) : upcomingEvents(live.events)), { headers: { ...securityHeaders, 'Content-Type': 'text/calendar; charset=utf-8' } });
      const page = publicExtension(url, live.events, live.records) || render(url, live.records, live.events);
      return localPage(head ? '' : page.html, page.status);
    } catch {
      return responseHTML(shell('Temporarily unavailable | NorCal Veterans', 'Please try again soon.', '<section class="wrap"><h1>Please try again in a few minutes.</h1></section>'), 503, true);
    }
  }
};

function localPage(html, status = 200, privatePage = false) {
  return responseHTML(html
    .replaceAll('src="/organization-photos/seed-photo-rememberavet"', 'src="/assets/community.jpg"')
    .replaceAll('src="/organization-photos/seed-photo-little-reata-veterans" alt="Horses in a sunlit Northern California pasture"', 'src="/assets/community.jpg" alt="Veteran community volunteers among memorial headstones decorated with holiday boughs"')
    .replace(/https:\/\/yolo-county-veterans-hq\.smartzgraphics\.workers\.dev(?:\/(?:organization|photo-presence))?/g, '/hq')
    .replace(/href="\/hq\?org=([^"#]+)#(?:photos|officers)"/g, 'href="/for-organizations?org=$1"')
    .replace(/href="\/hq\?org=[^"]+"/g, 'href="/hq?tab=organization"')
    .replaceAll('Add photos →', 'Ask about contributing photos →')
    .replaceAll('Add or update officer profiles →', 'Suggest a profile update →')
    .replaceAll('Authorized representatives can add photos, create albums and manage collaboration through their organization editor.', 'To discuss contributing photos, use the organization update form to contact the site team.')
    .replaceAll('Authorized organization representatives may add a voluntary profile after the person agrees to public use of their name, title, bio and selected photo.', 'Voluntary profile contributions require the person’s permission and review by the site team. Use the update form to discuss a contribution.')
    .replaceAll('Authorized representatives can add public photos, officer profiles and organization updates through the private editor.', 'Use the update form to suggest organization information or discuss photo and voluntary profile contributions with the site team.')
    .replaceAll('Authorized representatives can update public contact details, meeting information, events, photos and officer profiles without managing a separate hosting account.', 'Assigned administrators can maintain organization descriptions, contact details and events in the private headquarters. Use the update form for other contributions.')
    .replaceAll('Organization editor →', 'Organization headquarters →')
    .replaceAll('Open the organization editor →', 'Open organization headquarters →')
    .replaceAll('Designated representatives can also use their organization editor.', 'Assigned administrators can maintain descriptions and contact details in the private headquarters.')
    .replace('The organizations you selected can review it privately in their dashboards and contact you directly.', 'Your introduction is saved in the private review queue for coordination with the organizations you selected.')
    .replace('Each selected organization sees the introduction in its signed-in dashboard.', 'The site team reviews your introduction privately and coordinates with the organizations you select.')
    .replace('An organization can accept or decline, contact you directly and create a calendar draft after scheduling.', 'The site team can follow up using the contact details you provided. Nothing is published automatically.')
    .replace('after Aaron or Sterling approves their access', 'after the platform owner approves their access'), status, privatePage);
}
