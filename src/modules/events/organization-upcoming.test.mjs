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

test('VFW date headers use Pacific month and day for events and meetings only on that profile', () => {
  const examples = [
    {...event, id:'meeting', title:'January meeting', kind:'Organization meeting', start_at:'2027-01-08T03:00:00Z'},
    {...event, id:'fundraiser', title:'January fundraiser', date_only:true, start_at:'2027-01-09T08:00:00Z'}
  ];
  const html = organizationUpcomingEvents(examples, 'vfw-ca-8151', now);
  assert.equal((html.match(/class="vfw-card-date"/g) || []).length, 2);
  assert.ok(html.includes('<span>January</span><span class="vfw-card-day">7</span>'));
  assert.ok(html.includes('<span>January</span><span class="vfw-card-day">9</span>'));
  assert.ok(html.indexOf('class="vfw-card-date"') < html.indexOf('January meeting'));
  assert.ok(html.indexOf('January meeting') < html.indexOf('January fundraiser'));
  for (const detail of ['Thursday, January 7, 2027', '7:00 PM', 'Time to be confirmed', 'Public hall', 'href="/events/fundraiser"']) assert.ok(html.includes(detail), detail);
  assert.doesNotMatch(html, /href="\/events\/meeting"/);
  assert.doesNotMatch(organizationUpcomingEvents(examples.map(item => ({...item, organization_id:'other'})), 'other', now), /vfw-card-date/);
  assert.doesNotMatch(eventsPagePublic(new URL('https://site.test/events'), examples), /vfw-card-date/);
});

test('all organization templates use scoped cards and the shared Events calendar stays intact', () => {
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
  assert.match(eventsPagePublic(new URL('https://site.test/events'), []), /class="panel month-calendar"/);
});
