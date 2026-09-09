import test from 'node:test';
import assert from 'node:assert/strict';
import {memorialServices,memorialDayPage} from '../src/memorial-day.mjs';
import {buddyPoppyEvents} from '../src/buddy-poppy-events.mjs';
import {seedEvents} from '../src/research-additions.mjs';
import {upcomingEvents,eventCalendar} from '../src/public-tools.mjs';
test('remembrance guide separates historical editions from unannounced next ceremonies',()=>{
 const html=memorialDayPage(new URL('https://test/memorial-day'));
 assert.match(html,/May 31, 2027/);assert.match(html,/Past schedule/);assert.match(html,/May 26, 2025/);
 assert.equal(memorialServices.length,11);
 for(const city of ['Davis','Woodland','Dixon','Winters','Vacaville','Benicia','Vallejo','Rio Vista','Fairfield / Suisun City'])assert.ok(memorialServices.some(v=>v.city===city),city);
 const filtered=memorialDayPage(new URL('https://test/memorial-day?county=Yolo'));
 assert.match(filtered,/Woodland Cemetery/);assert.doesNotMatch(filtered,/Mare Island Naval Cemetery/);
 assert.ok(!seedEvents.some(v=>v.id.includes('memorial')),'Historical schedules must not become future calendar entries');
});
test('poppy fundraiser has separate date reminders for three days and two locations',()=>{
 assert.equal(buddyPoppyEvents.length,6);assert.equal(new Set(buddyPoppyEvents.map(v=>v.id)).size,6);
 for(const v of buddyPoppyEvents){assert.equal(v.date_only,true);assert.equal(v.source_kind,'project_team');assert.match(v.time_note,/Time to be confirmed/);assert.match(v.start_at,/2026-11-(07|08|11)T/);}
 assert.equal(upcomingEvents(seedEvents,Date.parse('2026-09-02T00:00:00Z')).length,12);
 const ics=eventCalendar(buddyPoppyEvents);assert.equal((ics.match(/DTSTART;VALUE=DATE:/g)||[]).length,6);assert.doesNotMatch(ics,/DTSTART:202611/);
});
