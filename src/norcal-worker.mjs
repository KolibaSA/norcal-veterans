import {norcalPublicData} from './app/public-content.mjs';
export {norcalPublicData};
import legacy from '../worker/legacy/index.mjs';
import { dataset, sources } from './data.mjs';
import { render } from './site.mjs';
import { shell } from './shared/public-shell.mjs';
import { submitPublicForm } from './app/public-intake.mjs';
import { publicExtension, eventCalendar, submissionPage, upcomingEvents } from './public-tools.mjs';
import { shareProgramPage } from './modules/share-program/public.mjs';
import { securityHeaders, responseHTML, redirect } from './shared/public-http.mjs';
import { memorialServices } from './memorial-day.mjs';

const norcalWorker = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url), path = url.pathname, head = request.method === 'HEAD';
    if (path === '/hq' || path.startsWith('/hq/') || path.startsWith('/api/')) return legacy.fetch(request, env, ctx);
    if (path === '/organization' || path === '/photo-presence') return redirect('/hq');
    if (path === '/' && ['www.norcalveterans.org', 'norcalveterans.org'].includes(url.hostname) && ['GET','HEAD'].includes(request.method)) {
      url.pathname = '/yolo-solano';
      return new Response(null, { status: 302, headers: { Location: url.href, 'Cache-Control': 'no-store' } });
    }
    if (['GET','HEAD'].includes(request.method) && (/^\/(?:logos|published-assets|assets)\//.test(path) || ['/styles.css','/app.js','/favicon.svg','/ysv-logo.png','/og.png','/norcal-hero-table.png','/norcal-hero-seals.png','/american-legion-background.png','/why-norcal-background.png','/why-veterans-find.png','/why-organizations-share.png','/why-organizations-coordinate.png'].includes(path))) {
      const asset = await env.ASSETS.fetch(request);
      return new Response(asset.body, { status: asset.status, headers: { ...Object.fromEntries(asset.headers), ...securityHeaders, 'Cache-Control': 'public, max-age=300' } });
    }
    if (path === '/regions' && ['GET','HEAD'].includes(request.method)) return localPage(head ? '' : shell('Regions | NorCal Veterans', 'Explore the NorCal Veterans community.', '<section class="wrap"><h1>Explore our regions</h1><p><a class="button" href="/yolo-solano">Yolo-Solano: organizations, events and resources</a></p></section>', {path:'/regions'}));
    if (path === '/health' && ['GET','HEAD'].includes(request.method)) {
      try {
        if (!env.DB || !(await env.DB.prepare('SELECT 1 AS ready').first())?.ready) throw new Error('Unavailable');
        return Response.json({ status: 'ok', project: 'NorCal Veterans', release: 'hq-hardening-20260912' }, { headers: { 'Cache-Control': 'no-store' } });
      } catch { return Response.json({ status: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
    }
    try {
      if (!['GET','HEAD'].includes(request.method) && !(request.method === 'POST' && ['/submit','/speaker-submissions'].includes(path))) return new Response('Method not allowed.', { status: 405 });
      const live = await norcalPublicData(env.DB);
      if (request.method === 'POST') {
        try { return await submitPublicForm(request, env, live.records, (input, environment) => legacy.fetch(input, environment)); }
        catch (error) {
          const message = /D1_|SQLITE|database/i.test(error.message) ? 'The submission desk is temporarily unavailable.' : error.message;
          const html = path === '/speaker-submissions' ? shareProgramPage(url, live.records, { error: message }) : submissionPage(url, { error: message, organizations: live.records });
          return localPage(html, 400, true);
        }
      }
      if (path === '/data.json') return Response.json({ ...dataset, last_verified_date: null, verification_note: 'Publication and verification are separate. See each record for its source references and recorded review date; confirm current details with the organization.', records: live.records, events: live.events, sources, memorial_services: memorialServices }, { headers: { ...securityHeaders, 'Cache-Control': 'public, max-age=30' } });
      if (path === '/events.ics') return new Response(head ? null : eventCalendar(url.searchParams.has('event') ? live.events.filter(event => event.id === url.searchParams.get('event')) : upcomingEvents(live.events)), { headers: { ...securityHeaders, 'Content-Type': 'text/calendar; charset=utf-8' } });
      const page = (path === '/share' ? {status: 200, html: shareProgramPage(url, live.records, {received: url.searchParams.has('received')})} : null) || publicExtension(url, live.events, live.records) || render(url, live.records, live.events);
      return localPage(head ? '' : page.html, page.status);
    } catch {
      console.error(JSON.stringify({event:'public_request_failed',request_id:crypto.randomUUID(),operation:'public_render'}));
      return localPage(shell('Temporarily unavailable | NorCal Veterans', 'Please try again soon.', '<section class="wrap"><h1>Please try again in a few minutes.</h1></section>'), 503, true);
    }
  }
};

export default {
  async fetch(request, env, ctx) {
    const response = await norcalWorker.fetch(request, env, ctx);
    if (env.STAGING !== 'true') return response;
    const headers = new Headers(response.headers);
    headers.set('X-Robots-Tag', 'noindex, noarchive');
    headers.set('X-NorCal-Environment', 'staging');
    return new Response(response.body, { status: response.status, headers });
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
    .replace('after Aaron or Sterling approves their access', 'after the platform owner approves their access')
    .replace(/<a\b[^>]*\bhref="\/hq(?:[/?#][^"]*)?"[^>]*>[\s\S]*?<\/a>/g, ''), status, privatePage);
}
