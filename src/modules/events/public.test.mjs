import test from 'node:test';
import assert from 'node:assert/strict';
import {eventDetail,eventCalendar,eventsPagePublic,sanitizePublicEvent} from './public.mjs';
test('event detail works independently with optional supplied organization choices',()=>{
  const event=sanitizePublicEvent({id:'synthetic-event',title:'Synthetic event',description:'Synthetic content',
    start_at:'2030-01-15T18:00:00-08:00',venue:'Synthetic public hall',status:'published',organization_id:'synthetic-host'});
  const standalone=eventDetail(event);
  assert.match(standalone,/Synthetic event/);assert.doesNotMatch(standalone,/View related organization/);
  assert.match(eventDetail(event,[{id:'synthetic-host'}]),/href="\/organizations\/synthetic-host"/);
});

test('VFW 8151 monthly meetings stay listed without detail-page links',()=>{
  const meeting=sanitizePublicEvent({id:'organization-meeting-vfw-ca-8151-2030-01',title:'Dixon VFW Post 8151 monthly meeting',description:'Monthly gathering.',start_at:'2030-01-18T02:00:00Z',venue:'Olde Vets Hall',status:'published',organization_id:'vfw-ca-8151',kind:'Organization meeting',organizer:'Dixon VFW Post 8151',county:'Solano',city:'Dixon',audience:'Contact the post for attendance details.',meeting_times:[{time:'18:00',label:'Social hour'},{time:'19:00',label:'Post meeting'},{time:'20:00',label:'Social time'}]});
  const html=eventsPagePublic(new URL('https://test/events?month=2030-01'),[meeting]);
  assert.match(html,/Dixon VFW Post 8151 monthly meeting/);assert.doesNotMatch(html,/href="\/events\/organization-meeting-vfw-ca-8151-2030-01"/);
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
