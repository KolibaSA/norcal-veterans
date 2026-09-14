import test from 'node:test';
import assert from 'node:assert/strict';
import {organizationUpcomingEvents} from './public.mjs';
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

test('only Post 8151 replaces its calendar and shows an empty state', () => {
  const target = render(new URL('https://site.test/organizations/vfw-ca-8151'), records, []).html;
  assert.match(target, /Upcoming events/);
  assert.match(target, /No upcoming events are currently published/);
  assert.doesNotMatch(target, /class="panel month-calendar"|id="annual-meetings"/);
  const other = records.find(record => record.id !== 'vfw-ca-8151' && record.id.startsWith('vfw-'));
  assert.ok(other);
  assert.match(render(new URL(`https://site.test/organizations/${other.id}`), records, []).html, /class="panel month-calendar"/);
});
