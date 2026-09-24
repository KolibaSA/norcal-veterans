import test from 'node:test';
import assert from 'node:assert/strict';
import {eventDetail,eventCalendar,eventsPagePublic,sanitizePublicEvent,upcomingEvents} from './public.mjs';
test('event detail works independently with optional supplied organization choices',()=>{
  const event=sanitizePublicEvent({id:'synthetic-event',title:'Synthetic event',description:'Synthetic content',
    start_at:'2030-01-15T18:00:00-08:00',venue:'Synthetic public hall',status:'published',organization_id:'synthetic-host',tickets_enabled:true,tickets_url:'https://example.org/tickets'});
  const standalone=eventDetail(event);
  assert.match(standalone,/Synthetic event/);assert.doesNotMatch(standalone,/View related organization/);
  assert.match(standalone,/class="wrap detail-page event-detail-page"/);
  assert.doesNotMatch(standalone,/Buy Tickets/);
  assert.match(eventDetail(event,[{id:'synthetic-host'}]),/href="\/organizations\/synthetic-host"/);
});

test('organization meetings stay off the public Events page without changing calendar safeguards',()=>{
  const meeting=sanitizePublicEvent({id:'organization-meeting-vfw-ca-8151-2030-01',title:'Dixon VFW Post 8151 monthly meeting',description:'Monthly gathering.',start_at:'2030-01-18T02:00:00Z',venue:'Olde Vets Hall',status:'published',organization_id:'vfw-ca-8151',kind:'Organization meeting',organizer:'Dixon VFW Post 8151',county:'Solano',city:'Dixon',audience:'Contact the post for attendance details.',meeting_times:[{time:'18:00',label:'Social hour'},{time:'19:00',label:'Post meeting'},{time:'20:00',label:'Social time'}]});
  const html=eventsPagePublic(new URL('https://test/events?month=2030-01'),[meeting]);
  assert.doesNotMatch(html,/Dixon VFW Post 8151 monthly meeting/);assert.doesNotMatch(html,/href="\/events\/organization-meeting-vfw-ca-8151-2030-01"/);
  assert.deepEqual(meeting.meeting_times.map(entry=>entry.label),['Social hour','Post meeting','Social time']);
  assert.doesNotMatch(eventCalendar([meeting]),/URL:https:\/\/www\.norcalveterans\.org\/events\/organization-meeting-vfw-ca-8151-2030-01/);
});

test('events page lists every Yolo and Solano city and filters by the selected city',()=>{
  const base={description:'Community gathering.',start_at:'2099-01-15T18:00:00-08:00',venue:'Public hall',status:'published',kind:'Volunteering',organizer:'Local host',audience:'Community members welcome.'};
  const html=eventsPagePublic(new URL('https://test/events?city=Winters'),[
    {...base,id:'winters-event',title:'Winters volunteer day',county:'Yolo',city:'Winters'},
    {...base,id:'davis-event',title:'Davis volunteer day',county:'Yolo',city:'Davis'}
  ]);
  assert.match(html,/for="event-city">Explore by city/);
  assert.match(html,/name="city"/);
  for(const city of ['Davis','West Sacramento','Winters','Woodland','Benicia','Dixon','Fairfield','Rio Vista','Suisun City','Vacaville','Vallejo'])assert.match(html,new RegExp(`<option value="${city}"`),city);
  assert.match(html,/value="Winters" selected/);
  assert.match(html,/Winters volunteer day/);
  assert.doesNotMatch(html,/Davis volunteer day|class="panel month-calendar"|id="calendar"|MONTH AT A GLANCE/);
});

test('events page groups compact cards by month and identifies hosts and accepted partners',()=>{
  const organizations=[
    {id:'vfw-ca-8151',verified_name:'Dixon VFW Post 8151',organization_type:'VFW'},
    {id:'legion-ca-77',verified_name:'Yolo American Legion Post 77',organization_type:'American Legion'},
    {id:'mcl-yolo',verified_name:'Marine Corps League - Yolo County Detachment 627',organization_type:'Marine Corps League'}
  ];
  const base={description:'A deliberately omitted card description.',venue:'Grocery Outlet, Davis, CA',status:'published',kind:'Community event',county:'Yolo',city:'Davis',audience:'Community members welcome.'};
  const html=eventsPagePublic(new URL('https://test/events'),[
    {...base,id:'poppy',title:'VFW Post 8151 Buddy Poppy Fundraiser',start_at:'2099-09-16T18:00:00-07:00',organization_id:'vfw-ca-8151',accepted_organization_ids:['legion-ca-77','mcl-yolo'],image_url:'https://images.example.org/not-a-poppy.jpg',volunteer_enabled:true,volunteer_url:'https://example.org/volunteer'},
    {...base,id:'train',title:'Halloween Train',start_at:'2099-10-31T11:00:00-07:00',organization_id:'legion-ca-77',image_url:'https://images.example.org/train.jpg',volunteer_enabled:true,volunteer_url:'https://example.org/volunteer',donate_enabled:true,donate_url:'https://example.org/donate',tickets_enabled:true,tickets_url:'https://example.org/tickets'}
  ],organizations);
  assert.match(html,/September 2099/);assert.match(html,/October 2099/);
  assert.match(html,/class="event-card-media"><span class="event-card-fallback"/);
  assert.match(html,/src="https:\/\/images\.example\.org\/train\.jpg"/);
  assert.match(html,/<h2>Buddy Poppy Fundraiser<\/h2>/);assert.doesNotMatch(html,/<h2><a[^>]*>Buddy Poppy Fundraiser<\/a>/);
  assert.match(html,/class="event-card-hit-area" href="\/events\/poppy"/);assert.match(html,/event-card--poppy/);
  assert.doesNotMatch(html,/>Details\s*</);
  assert.match(html,/href="https:\/\/example\.org\/volunteer"[^>]*>Volunteer Now/);
  assert.match(html,/href="https:\/\/example\.org\/donate"[^>]*>Donate Now/);
  assert.match(html,/href="https:\/\/example\.org\/tickets"[^>]*>Buy Tickets/);
  assert.match(html,/viewBox="0 0 64 64"/);assert.match(html,/circle cx="32" cy="29" r="3\.5"/);
  assert.doesNotMatch(html,/not-a-poppy\.jpg/);
  assert.match(html,/Dixon VFW Post 8151/);assert.match(html,/Yolo American Legion Post 77/);assert.match(html,/Marine Corps League - Yolo County Detachment 627/);
  assert.match(html,/event-card-theme--vfw/);assert.match(html,/>8151<\/span>/);
  assert.doesNotMatch(html,/deliberately omitted card description/);
});

test('one event record renders, prunes, details, and exports multiple dates',()=>{
  const event={id:'multi',title:'Multi-date fundraiser',description:'One event record.',date_only:true,start_at:'2026-11-07T08:00:00Z',additional_occurrences:[
    {start_at:'2026-11-11T08:00:00Z',end_at:null},{start_at:'2026-11-08T08:00:00Z',end_at:null}
  ],venue:'Public hall',status:'published',kind:'Community event',city:'Dixon',county:'Solano'};
  const page=eventsPagePublic(new URL('https://test/events'),[event]);
  assert.match(page,/<strong>7, 8 &amp; 11<\/strong>/);assert.match(page,/MULTI-DAY EVENT/);
  for(const value of ['Sat, Nov 7','Sun, Nov 8','Wed, Nov 11'])assert.match(page,new RegExp(value));
  const pruned=upcomingEvents([event],Date.parse('2026-11-08T20:00:00Z'))[0];
  assert.deepEqual(pruned.occurrences.map(occurrence=>occurrence.start_at),['2026-11-08T08:00:00.000Z','2026-11-11T08:00:00.000Z']);
  const single=upcomingEvents([event],Date.parse('2026-11-09T20:00:00Z'))[0];
  assert.equal(single.occurrences.length,1);assert.equal(single.start_at,'2026-11-11T08:00:00.000Z');
  const detail=eventDetail(event);assert.equal((detail.match(/<li><time/g)||[]).length,3);
  const calendar=eventCalendar([event]);assert.equal((calendar.match(/BEGIN:VEVENT/g)||[]).length,3);
  for(const day of ['20261107','20261108','20261111'])assert.match(calendar,new RegExp(`DTSTART;VALUE=DATE:${day}`));
});
