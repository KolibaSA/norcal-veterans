const calendarEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=value=>String(value).padStart(2,'0');
const dayKey=(year,month,day)=>`${year}-${pad(month)}-${pad(day)}`;
const nthWeekday=(year,month,weekday,n)=>{const first=new Date(Date.UTC(year,month-1,1)),offset=(weekday-first.getUTCDay()+7)%7;return dayKey(year,month,1+offset+(n-1)*7);};
const lastWeekday=(year,month,weekday)=>{const last=new Date(Date.UTC(year,month,0)),offset=(last.getUTCDay()-weekday+7)%7;return dayKey(year,month,last.getUTCDate()-offset);};
const birthdayStyles={Army:'army','Coast Guard':'coast-guard','Air Force':'air-force',Navy:'navy','Marine Corps':'marine-corps','Space Force':'space-force'};

export function calendarMilestones(year){
 const fixed=[['01-01',"New Year's Day"],['06-19','Juneteenth National Independence Day'],['07-04','Independence Day'],['11-11','Veterans Day'],['12-25','Christmas Day']];
 const holidays=fixed.map(([date,title])=>({date:`${year}-${date}`,title,kind:'Federal holiday'})).concat([
  {date:nthWeekday(year,1,1,3),title:'Birthday of Martin Luther King, Jr.',kind:'Federal holiday'},
  {date:nthWeekday(year,2,1,3),title:"Washington's Birthday",kind:'Federal holiday'},
  {date:lastWeekday(year,5,1),title:'Memorial Day',kind:'Federal holiday'},
  {date:nthWeekday(year,9,1,1),title:'Labor Day',kind:'Federal holiday'},
  {date:nthWeekday(year,10,1,2),title:'Columbus Day',kind:'Federal holiday'},
  {date:nthWeekday(year,11,4,4),title:'Thanksgiving Day',kind:'Federal holiday'}
 ]);
 const birthdays=[['06-14','Army'],['08-04','Coast Guard'],['09-18','Air Force'],['10-13','Navy'],['11-10','Marine Corps'],['12-20','Space Force']].map(([date,branch])=>({date:`${year}-${date}`,title:`${branch} Birthday`,kind:'Service birthday',branch,style:birthdayStyles[branch]}));
 return [...holidays,...birthdays];
}

const eventDate=event=>event.date_only?String(event.start_at).slice(0,10):new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(event.start_at));
const monthValue=url=>{const value=url.searchParams.get('month');if(/^\d{4}-(0[1-9]|1[0-2])$/.test(value||''))return value;return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit'}).format(new Date());};
const shiftMonth=(value,amount)=>{const [year,month]=value.split('-').map(Number),date=new Date(Date.UTC(year,month-1+amount,1));return `${date.getUTCFullYear()}-${pad(date.getUTCMonth()+1)}`;};
const meetingYear=event=>Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric'}).format(new Date(event.start_at)));
const meetingMonth=event=>Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',month:'numeric'}).format(new Date(event.start_at)));
const meetingDateLabel=event=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(new Date(event.start_at));
const meetingTimeLabel=event=>event.date_only?'Time to be confirmed':new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',hour:'numeric',minute:'2-digit'}).format(new Date(event.start_at));
const labeledTime=value=>{const [hour,minute]=String(value||'').split(':').map(Number);if(!Number.isInteger(hour)||!Number.isInteger(minute))return '';return `${hour%12||12}${minute?':'+String(minute).padStart(2,'0'):''} ${hour<12?'a.m.':'p.m.'}`;};
const meetingMonthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
const isVfw8151Meeting=event=>event.kind==='Organization meeting'&&event.organization_id==='vfw-ca-8151';
const calendarItem=item=>item.id?(isVfw8151Meeting(item)?`<span class="calendar-item calendar-event">${calendarEscape(item.title)}</span>`:`<a class="calendar-item calendar-event" href="/events/${calendarEscape(item.id)}">${calendarEscape(item.title)}</a>`):`<span class="calendar-item ${item.kind==='Service birthday'?'calendar-service':'calendar-holiday'}">${calendarEscape(item.title)}</span>`;

export function publicMonthCalendar(url,events,{organizationId='',path='/events',includeMilestones=true,title='Community calendar'}={}){
 const selected=monthValue(url),[year,month]=selected.split('-').map(Number),first=new Date(Date.UTC(year,month-1,1)),days=new Date(Date.UTC(year,month,0)).getUTCDate(),offset=first.getUTCDay();
 const filtered=events.filter(event=>event.status==='published'&&(!organizationId||event.organization_id===organizationId)).map(event=>({...event,date:eventDate(event)}));
 const items=includeMilestones?[...filtered,...calendarMilestones(year)]:filtered;
 const byDay=new Map;for(const item of items){const list=byDay.get(item.date)||[];list.push(item);byDay.set(item.date,list);}
 const cells=[];for(let position=0;position<42;position++){const day=position-offset+1;if(day<1||day>days){cells.push('<div class="calendar-day calendar-day-empty" aria-hidden="true"></div>');continue;}const date=dayKey(year,month,day),dayItems=byDay.get(date)||[],birthday=dayItems.find(item=>item.kind==='Service birthday');cells.push(`<div class="calendar-day ${birthday?'calendar-birthday birthday-'+birthday.style:''}" ${birthday?`data-branch="${calendarEscape(birthday.branch)}"`:''}><time datetime="${date}">${day}</time><div class="calendar-items">${dayItems.map(calendarItem).join('')}</div></div>`);}
 const label=new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'UTC'}).format(first),link=value=>`${path}?month=${value}#calendar`;
  const annualMeetings=organizationId==='vfw-ca-8151'?publicYearMeetingGrid(url,events,{organizationId,path,title:title.replace(/ events$/,' annual meetings')}):'';
  return `<section class="panel month-calendar" id="calendar" aria-labelledby="calendar-title"><div class="calendar-heading"><div><span class="eyebrow">MONTH AT A GLANCE</span><h2 id="calendar-title">${calendarEscape(title)}</h2></div><nav aria-label="Choose calendar month"><a href="${calendarEscape(link(shiftMonth(selected,-1)))}">Previous</a><strong>${calendarEscape(label)}</strong><a href="${calendarEscape(link(shiftMonth(selected,1)))}">Next</a></nav></div><div class="calendar-weekdays" aria-hidden="true">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=>`<span>${day}</span>`).join('')}</div><div class="calendar-grid">${cells.join('')}</div>${includeMilestones?'<p class="small-note">Federal holidays and military service birthdays are reference dates. Service birthday tiles use original branch-name medallions because official military seals are restricted to authorized use.</p>':''}</section>${annualMeetings}`;
}

export function publicYearMeetingGrid(url,events,{organizationId='',path='/events',title='Annual meeting schedule'}={}){
 const meetings=events.filter(event=>event.status==='published'&&event.organization_id===organizationId&&event.kind==='Organization meeting');
 const years=[...new Set(meetings.map(meetingYear))].sort((a,b)=>a-b),currentYear=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric'}).format(new Date())),requested=Number(url.searchParams.get('meeting_year'));
 const year=years.includes(requested)?requested:years.find(value=>value>=currentYear)??years.at(-1)??currentYear,byMonth=new Map;
 for(const meeting of meetings){if(meetingYear(meeting)!==year)continue;const month=meetingMonth(meeting),list=byMonth.get(month)||[];list.push(meeting);byMonth.set(month,list);}
 const yearLink=value=>`${path}?meeting_year=${value}#annual-meetings`,previousYear=years.filter(value=>value<year).at(-1),nextYear=years.find(value=>value>year),availableYears=years.length>1?`<nav class="annual-meeting-years" aria-label="Choose meeting year">${previousYear?`<a href="${calendarEscape(yearLink(previousYear))}">Previous year</a>`:''}<strong>${year}</strong>${nextYear?`<a href="${calendarEscape(yearLink(nextYear))}">Next year</a>`:''}</nav>`:`<strong class="annual-meeting-year">${year}</strong>`;
 const cards=meetingMonthNames.map((name,index)=>{const month=index+1,monthMeetings=byMonth.get(month)||[];return `<article class="annual-meeting-card ${monthMeetings.length?'has-meeting':'is-empty'}"><h3>${name}</h3>${monthMeetings.length?`<div class="annual-meeting-list">${monthMeetings.map(meeting=>{const times=meeting.meeting_times?.length?`<dl class="annual-meeting-times">${meeting.meeting_times.map(entry=>`<div><dt>${calendarEscape(labeledTime(entry.time))}</dt><dd>${calendarEscape(entry.label)}</dd></div>`).join('')}</dl>`:`<strong>${calendarEscape(meetingTimeLabel(meeting))}</strong>`;return `<div class="annual-meeting-entry"><time datetime="${calendarEscape(String(meeting.start_at))}">${calendarEscape(meetingDateLabel(meeting))}</time>${times}${meeting.title?`<span>${calendarEscape(meeting.title)}</span>`:''}${meeting.description?`<p>${calendarEscape(meeting.description)}</p>`:''}</div>`;}).join('')}</div>`:'<p class="annual-meeting-empty">No meeting published yet.</p>'}</article>`;}).join('');
 return `<section class="panel annual-meeting-grid" id="annual-meetings" aria-labelledby="annual-meetings-title"><div class="calendar-heading"><div><span class="eyebrow">THE YEAR AHEAD</span><h2 id="annual-meetings-title">${calendarEscape(title)}</h2></div>${availableYears}</div><p class="annual-meeting-intro">All twelve monthly meeting slots are listed below. Confirm the latest details with the post before attending.</p><div class="annual-meeting-cards">${cards}</div></section>`;
}
