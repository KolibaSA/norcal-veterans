import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarMilestones,publicMonthCalendar,publicYearMeetingGrid} from '../src/public-calendar.mjs';

const events=[
 {id:'mine',title:'Post picnic',organization_id:'vfw-ca-8762',status:'published',date_only:true,start_at:'2026-09-12T00:00:00-07:00'},
 {id:'other',title:'Other meeting',organization_id:'vfw-ca-7244',status:'published',date_only:true,start_at:'2026-09-15T00:00:00-07:00'},
 {id:'draft',title:'Private draft',organization_id:'vfw-ca-8762',status:'draft',date_only:true,start_at:'2026-09-16T00:00:00-07:00'}
];

test('community calendar includes federal holidays and military service birthdays',()=>{
 const milestones=calendarMilestones(2026);assert.ok(milestones.some(item=>item.date==='2026-05-25'&&item.title==='Memorial Day'));assert.ok(milestones.some(item=>item.date==='2026-11-11'&&item.title==='Veterans Day'));assert.ok(milestones.some(item=>item.date==='2026-09-18'&&item.title==='Air Force Birthday'));
 const html=publicMonthCalendar(new URL('https://example.test/events?month=2026-09'),events);assert.ok(html.includes('September 2026'));assert.ok(html.includes('Post picnic'));assert.ok(html.includes('Other meeting'));assert.ok(html.includes('birthday-air-force'));assert.ok(!html.includes('Private draft'));
});

test('organization calendar shows only that organization and no general milestones',()=>{
 const html=publicMonthCalendar(new URL('https://example.test/organizations/vfw-ca-8762?month=2026-09'),events,{organizationId:'vfw-ca-8762',path:'/organizations/vfw-ca-8762',includeMilestones:false,title:'Post events'});assert.ok(html.includes('Post picnic'));assert.ok(!html.includes('Other meeting'));assert.ok(!html.includes('Air Force Birthday'));assert.ok(html.includes('/organizations/vfw-ca-8762?month=2026-08#calendar'));
});

test('annual meeting grid lists all twelve VFW 8151 monthly meeting boxes',()=>{
 const meetings=Array.from({length:12},(_,index)=>({id:`meeting-${index+1}`,title:index===11?'Christmas Potluck':'Dixon VFW Post 8151 monthly meeting',description:'Monthly gathering.',organization_id:'vfw-ca-8151',kind:'Organization meeting',status:'published',start_at:`2027-${String(index+1).padStart(2,'0')}-20T02:00:00Z`,meeting_times:[{time:'18:00',label:'Social hour'},{time:'19:00',label:'Post meeting'},{time:'20:00',label:'Social time'}]}));
 const html=publicYearMeetingGrid(new URL('https://example.test/organizations/vfw-ca-8151'),[...meetings,{id:'other',title:'Other post',organization_id:'vfw-ca-8762',kind:'Organization meeting',status:'published',start_at:'2027-01-20T03:00:00Z'}],{organizationId:'vfw-ca-8151',path:'/organizations/vfw-ca-8151',title:'Dixon VFW Post 8151 annual meetings'});
 assert.equal((html.match(/class="annual-meeting-card /g)||[]).length,12);
 assert.ok(html.includes('January'));assert.ok(html.includes('December'));assert.ok(html.includes('Christmas Potluck'));assert.match(html,/6 p\.m\.<\/dt><dd>Social hour/);assert.match(html,/7 p\.m\.<\/dt><dd>Post meeting/);assert.match(html,/8 p\.m\.<\/dt><dd>Social time/);assert.ok(!html.includes('Other post'));assert.ok(html.includes('All twelve monthly meeting slots are listed below.'));assert.ok(!html.includes('Meeting details'));assert.ok(!html.includes('href="/events/meeting-'));
 const month=publicMonthCalendar(new URL('https://example.test/organizations/vfw-ca-8151?month=2027-01'),meetings,{organizationId:'vfw-ca-8151',path:'/organizations/vfw-ca-8151',includeMilestones:false,title:'Dixon VFW Post 8151 events'});
 assert.ok(month.includes('Dixon VFW Post 8151 monthly meeting'));assert.ok(!month.includes('href="/events/meeting-1"'));
});
