import { escapeHtml, shell } from './shared/public-shell.mjs';
import { eventDetailIsPublic, upcomingEvents } from './modules/events/public.mjs';

const h = escapeHtml;
const counties = [
  { name: 'Yolo', slug: 'yolo-county', office: 'vso-yolo' },
  { name: 'Solano', slug: 'solano-county', office: 'vso-solano' }
];
const localPath = value => '/locations/' + value;

function countyFor(record, event) {
  return record?.location_county || event?.county || '';
}

function localCities(records, events) {
  const cities = new Map();
  for (const record of records) {
    if (!record?.city || !counties.some(county => county.name === record.location_county)) continue;
    const entry = cities.get(record.city) || { name: record.city, county: record.location_county, records: [], events: [] };
    entry.records.push(record);
    cities.set(record.city, entry);
  }
  for (const event of upcomingEvents(events.filter(eventDetailIsPublic))) {
    if (!event.city || !counties.some(county => county.name === event.county)) continue;
    const entry = cities.get(event.city) || { name: event.city, county: event.county, records: [], events: [] };
    if (entry.county === event.county) entry.events.push(event);
    cities.set(event.city, entry);
  }
  return [...cities.values()]
    .filter(entry => entry.records.length >= 2 || (entry.records.length >= 1 && entry.events.length >= 1) || entry.events.length >= 3)
    .sort((a, b) => a.county.localeCompare(b.county) || a.name.localeCompare(b.name));
}

function citySlug(city) {
  return city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function localPagePaths(records = [], events = []) {
  return [
    ...counties.map(county => localPath(county.slug)),
    ...localCities(records, events).map(city => localPath(citySlug(city.name)))
  ];
}

function eventCard(event) {
  const date = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(event.start_at));
  return `<article class="panel local-result-card"><span class="eyebrow">${h(date)} · ${h(event.kind)}</span><h3><a href="/events/${encodeURIComponent(event.id)}">${h(event.title)}</a></h3><p>${h(event.venue)} · ${h(event.city || event.county + ' County')}</p><a href="/events/${encodeURIComponent(event.id)}">View event details →</a></article>`;
}

function organizationCard(record) {
  const closedDavisPost = record.id === 'vfw-ca-6949';
  const description = String(record.member_information || '').replace(/\s+/g, ' ').trim();
  const excerpt = description.length > 300 ? description.slice(0, 297).replace(/\s+\S*$/, '') + '…' : description;
  return `<article class="panel local-result-card${closedDavisPost ? ' local-result-card-closed' : ''}"><span class="eyebrow">${closedDavisPost ? 'CLOSED · ' : ''}${h(record.organization_type)} · ${h(record.city || record.location_county + ' County')}</span><h3><a href="/organizations/${encodeURIComponent(record.id)}">${h(record.verified_name)}</a></h3>${closedDavisPost ? '<p>This Davis post has closed. See nearby VFW options below.</p>' : excerpt ? `<p>${h(excerpt)}</p>` : ''}<a href="/organizations/${encodeURIComponent(record.id)}">View closure information →</a></article>`;
}

export function davisVfwClosureNotice() {
  return `<section class="panel local-vfw-closure" aria-labelledby="davis-vfw-closure-title"><span class="eyebrow">DAVIS VFW UPDATE</span><h2 id="davis-vfw-closure-title">Davis VFW Post 6949 has closed</h2><p>If you are in the Davis area and looking for a VFW post, Dixon VFW Post 8151 actively recruits, serves the area and has members in Davis. Western Yolo VFW Post 7143 in Esparto is another option. Contact each post to confirm current meeting arrangements before visiting.</p><ul><li><a class="local-vfw-post-card" href="/organizations/vfw-ca-8151"><strong>Dixon VFW Post 8151</strong><span>Serves Davis and nearby communities · 530-702-0508</span><span class="local-vfw-card-number" aria-hidden="true">8151</span></a></li><li><a class="local-vfw-post-card" href="/organizations/vfw-ca-7143"><strong>Western Yolo VFW Post 7143</strong><span>Esparto · visit the profile for its official website</span><span class="local-vfw-card-number" aria-hidden="true">7143</span></a></li></ul></section>`;
}

function locationPage({ name, countyName, path, records, events, isCounty, childCities = [], countyOffice }) {
  const countyRecords = records.filter(record => record.location_county === countyName || record.service_area?.counties?.includes(countyName));
  const countyEvents = upcomingEvents(events.filter(eventDetailIsPublic).filter(event => countyFor(null, event) === countyName));
  const shownRecords = isCounty ? countyRecords : records.filter(record => record.city === name);
  const shownEvents = isCounty ? countyEvents : countyEvents.filter(event => event.city === name);
  const title = isCounty ? `${name} County veterans organizations and events` : `${name}, ${countyName} County veterans organizations and events`;
  const description = isCounty
    ? `Explore published veterans organizations, upcoming community events, county services and resources in ${name} County, California.`
    : `Find published veterans organizations and upcoming community events in ${name}, ${countyName} County, California.`;
  const resourcePath = isCounty ? '/resources/local' : '/resources';
  const countyLink = `<a class="button outline" href="${localPath(counties.find(item => item.name === countyName).slug)}">Explore ${h(countyName)} County →</a>`;
  const offices = isCounty ? records.filter(record => record.id === countyOffice) : [];
  const officeLinks = offices.map(organizationCard).join('');
  const cityLinks = isCounty ? childCities.map(city => `<a class="button outline" href="${localPath(citySlug(city.name))}">${h(city.name)} →</a>`).join('') : '';
  const locationName = isCounty ? `${name} County` : name;
  const closureNotice = !isCounty && name === 'Davis' && countyName === 'Yolo' ? davisVfwClosureNotice() : '';
  const content = `<section class="wrap local-seo-page"><nav class="local-breadcrumbs" aria-label="Breadcrumb"><a href="/yolo-solano">Yolo-Solano</a>${isCounty ? '' : ` <span aria-hidden="true">›</span> <a href="${localPath(counties.find(item => item.name === countyName).slug)}">${h(countyName)} County</a>`}</nav><header class="local-seo-hero"><span class="eyebrow">LOCAL VETERAN COMMUNITY · ${h(countyName.toUpperCase())} COUNTY</span><h1>${h(locationName)} veterans organizations and events</h1><p class="intro">${isCounty ? `Explore published veteran organizations, events and local services across ${h(name)} County. Listings link to their available sources and review notes; confirm current details with the provider.` : `Explore published veteran organization profiles and upcoming events listed for ${h(name)}. Confirm current schedules, services and attendance details with each organization.`}</p><div class="local-seo-actions"><a class="button" href="${resourcePath}">Veteran resources →</a><a class="button outline" href="/events">All Yolo-Solano events →</a>${isCounty ? '' : countyLink}</div></header>${closureNotice}${isCounty && cityLinks ? `<section class="panel local-city-links"><h2>Explore communities in ${h(name)} County</h2><div>${cityLinks}</div></section>` : ''}${isCounty ? `<section class="local-results"><div class="regional-heading"><div><span class="eyebrow">COUNTY SERVICE OFFICE</span><h2>Benefits and claims support</h2></div></div><div class="local-result-grid">${officeLinks || `<p><a href="/organizations/${h(countyOffice)}">${h(name)} County Veterans Services Office</a></p>`}</div></section>` : ''}<section class="local-results"><div class="regional-heading"><div><span class="eyebrow">PUBLISHED LOCAL PROFILES</span><h2>Organizations in ${h(locationName)}</h2></div><span class="result-count">${shownRecords.length} ${shownRecords.length === 1 ? 'profile' : 'profiles'}</span></div>${shownRecords.length ? `<div class="local-result-grid">${shownRecords.map(organizationCard).join('')}</div>` : '<p>There are no organization profiles currently published for this area.</p>'}</section><section class="local-results"><div class="regional-heading"><div><span class="eyebrow">UPCOMING COMMUNITY LISTINGS</span><h2>Events in ${h(locationName)}</h2></div><span class="result-count">${shownEvents.length} ${shownEvents.length === 1 ? 'event' : 'events'}</span></div>${shownEvents.length ? `<div class="local-result-grid">${shownEvents.map(eventCard).join('')}</div>` : '<p>No upcoming public event details are currently listed for this area. Browse the regional calendar for events across Yolo and Solano counties.</p>'}<p><a href="/events">Browse the full regional events calendar →</a></p></section><section class="panel local-related-links"><h2>More ways to connect</h2><p>Use the regional directory to filter by county or city, or open the resource guide for official benefits, education, employment, housing and wellness providers.</p><a href="/yolo-solano?place=${encodeURIComponent(countyName + ' County')}#directory">Browse the ${h(countyName)} County directory →</a><span aria-hidden="true"> · </span><a href="${resourcePath}">Explore veteran resources →</a></section></section>`;
  return { status: 200, html: shell(`${title} | NorCal Veterans`, description, content, { path, detail: true }) };
}

export function renderLocalPage(pathname, records = [], events = []) {
  const county = counties.find(entry => localPath(entry.slug) === pathname);
  if (county) return locationPage({
    name: county.name,
    countyName: county.name,
    path: localPath(county.slug),
    records,
    events,
    isCounty: true,
    childCities: localCities(records, events).filter(city => city.county === county.name),
    countyOffice: county.office
  });
  const city = localCities(records, events).find(entry => localPath(citySlug(entry.name)) === pathname);
  if (!city) return null;
  return locationPage({ name: city.name, countyName: city.county, path: localPath(citySlug(city.name)), records, events, isCounty: false });
}
