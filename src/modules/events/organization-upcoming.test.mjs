import test from 'node:test';
import assert from 'node:assert/strict';
import {organizationUpcomingEvents, eventsPagePublic} from './public.mjs';
import {render} from '../../site.mjs';
import {records} from '../../data.mjs';

const now = Date.parse('2026-09-13T20:00:00Z');
const event = {id:'later', title:'Later event', start_at:'2026-10-01T18:00:00-07:00', venue:'Public hall', status:'published', organization_id:'vfw-ca-8151'};

test('upcoming organization cards filter, sort and safely preserve meeting details', () => {
  const html = organizationUpcomingEvents([
    event,
    {...event, id:'past', title:'Past event', start_at:'2026-01-01T18:00:00-08:00'},
    {...event, id:'draft', title:'Draft event', status:'draft'},
    {...event, id:'other', title:'Other organization', organization_id:'other'},
    {...event, id:'first', title:'First <meeting>', kind:'Organization meeting', start_at:'2026-09-20T18:00:00-07:00', meeting_times:[{time:'18:00',label:'Social hour'},{time:'19:00',label:'Post meeting'},{time:'20:00',label:'Social time'}]},
    {...event, id:'date-only', title:'Date only', start_at:'2026-09-13T07:00:00Z', date_only:true}
  ], 'vfw-ca-8151', now);
  assert.ok(html.indexOf('Date only') < html.indexOf('First &lt;meeting&gt;'));
  assert.ok(html.indexOf('First &lt;meeting&gt;') < html.indexOf('Later event'));
  assert.doesNotMatch(html, /Past event|Draft event|Other organization|href="\/events\/first"/);
  for (const value of ['6:00 PM','Social hour','7:00 PM','Post meeting','8:00 PM','Social time','Public hall','Time to be confirmed','href="/events/later"']) assert.ok(html.includes(value), value);
});

test('organization cards standardize Pacific month and day without changing shared event cards', () => {
  const examples = [
    {...event, id:'meeting', title:'January meeting', kind:'Organization meeting', start_at:'2027-01-08T03:00:00Z'},
    {...event, id:'fundraiser', title:'January fundraiser', date_only:true, start_at:'2027-01-09T08:00:00Z'}
  ];
  const html = organizationUpcomingEvents(examples, 'vfw-ca-8151', now);
  assert.equal((html.match(/class="organization-card-date"/g) || []).length, 1);
  assert.equal((html.match(/class="event-card-date"/g) || []).length, 1);
  assert.ok(html.includes('<span>January</span><span class="organization-card-day">7</span>'));
  assert.ok(html.includes('<span>Jan</span><strong>9</strong>'));
  assert.ok(html.indexOf('class="organization-card-date"') < html.indexOf('January meeting'));
  assert.ok(html.indexOf('January meeting') < html.indexOf('January fundraiser'));
  for (const detail of ['Thursday, January 7, 2027', '7:00 PM', 'Time to be confirmed', 'Public hall', 'href="/events/fundraiser"']) assert.ok(html.includes(detail), detail);
  assert.doesNotMatch(html, /href="\/events\/meeting"/);
  assert.match(html,/class="events-page vfw-public-event-card"/);
  assert.match(html,/class="event-card event-card--public/);
  const futureOrganization = organizationUpcomingEvents(examples.map(item => ({...item, organization_id:'future-org'})), 'future-org', now);
  assert.equal((futureOrganization.match(/class="organization-card-date"/g) || []).length, 2);
  assert.doesNotMatch(eventsPagePublic(new URL('https://site.test/events'), examples), /organization-card-date/);
});

test('Post 8151 groups future community occurrences by event and location', () => {
  const occurrence=(id,day,venue,city,extra={})=>({id,title:`Buddy Poppy Fundraiser — ${city}`,description:'Poppy distribution.',date_only:true,start_at:`2026-11-${String(day).padStart(2,'0')}T08:00:00Z`,venue,status:'published',organization_id:'vfw-ca-8151',kind:'Community event',city,county:'Solano',...extra});
  const events=[7,8,11].flatMap(day=>[
    occurrence(`dixon-${day}`,day,'Safeway, 1235 Stratford Avenue, Dixon, CA 95620','Dixon',day===7?{volunteer_enabled:true,volunteer_url:'https://example.org/volunteer',donate_enabled:true,donate_url:'https://example.org/donate'}:{}),
    occurrence(`davis-${day}`,day,'Grocery Outlet, 1800 East 8th Street, Davis, CA 95616','Davis')
  ]);
  const html=organizationUpcomingEvents(events,'vfw-ca-8151',Date.parse('2026-11-06T20:00:00Z'));
  assert.equal((html.match(/vfw-public-event-card/g)||[]).length,2);
  assert.equal((html.match(/event-card-date--multi/g)||[]).length,2);
  assert.equal((html.match(/<strong>7, 8 &amp; 11<\/strong>/g)||[]).length,2);
  for(const date of ['Sat, Nov 7','Sun, Nov 8','Wed, Nov 11'])assert.match(html,new RegExp(date));
  assert.equal((html.match(/Safeway, 1235 Stratford Avenue/g)||[]).length,1);
  assert.equal((html.match(/Grocery Outlet, 1800 East 8th Street/g)||[]).length,1);
  assert.match(html,/MULTI-DAY EVENT/);assert.match(html,/Event Dates:/);assert.match(html,/Time TBD/);
  assert.match(html,/href="https:\/\/example\.org\/volunteer"[^>]*>Volunteer Now/);
  assert.match(html,/href="https:\/\/example\.org\/donate"[^>]*>Donate Now/);
  const pruned=organizationUpcomingEvents(events,'vfw-ca-8151',Date.parse('2026-11-08T20:00:00Z'));
  assert.equal((pruned.match(/<strong>8 &amp; 11<\/strong>/g)||[]).length,2);assert.doesNotMatch(pruned,/Sat, Nov 7/);
  const single=organizationUpcomingEvents(events,'vfw-ca-8151',Date.parse('2026-11-09T20:00:00Z'));
  assert.equal((single.match(/event-card-date--multi/g)||[]).length,0);assert.equal((single.match(/<strong>11<\/strong>/g)||[]).length,2);
});

test('all organization templates and the shared Events page use card listings without a month grid', () => {
  const selected = [records.find(r => r.id === 'vfw-ca-8762'), records.find(r => r.organization_type === 'American Legion'), records.find(r => r.id === 'mcl-yolo')];
  for (const record of selected) {
    assert.ok(record);
    const url = new URL('https://site.test/organizations/' + record.id);
    const empty = render(url, records, []).html;
    assert.match(empty, /No upcoming events are currently published/);
    assert.doesNotMatch(empty, /class="panel month-calendar"|id="annual-meetings"/);
    const assigned = {...event, id:'assigned-event', title:'Assigned event', organization_id:record.id, start_at:'2099-01-01T18:00:00-08:00'};
    const populated = render(url, records, [assigned, {...assigned, id:'other-event', title:'Other organization event', organization_id:'other'}]).html;
    assert.ok(populated.includes('href="/events/assigned-event"'));
    assert.doesNotMatch(populated, /Other organization event/);
  }
  assert.match(render(new URL('https://site.test/mcl-yolo'), records, []).html, /id="upcoming-events"/);
  assert.doesNotMatch(eventsPagePublic(new URL('https://site.test/events'), []), /class="panel month-calendar"|id="calendar"|MONTH AT A GLANCE/);
});
