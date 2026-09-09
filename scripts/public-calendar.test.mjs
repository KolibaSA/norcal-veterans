import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarMilestones,publicMonthCalendar} from '../src/public-calendar.mjs';

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
