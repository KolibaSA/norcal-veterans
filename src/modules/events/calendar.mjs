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

export function publicMonthCalendar(url,events,{organizationId='',path='/events',includeMilestones=true,title='Community calendar'}={}){
 const selected=monthValue(url),[year,month]=selected.split('-').map(Number),first=new Date(Date.UTC(year,month-1,1)),days=new Date(Date.UTC(year,month,0)).getUTCDate(),offset=first.getUTCDay();
 const filtered=events.filter(event=>event.status==='published'&&(!organizationId||event.organization_id===organizationId)).map(event=>({...event,date:eventDate(event)}));
 const items=includeMilestones?[...filtered,...calendarMilestones(year)]:filtered;
 const byDay=new Map;for(const item of items){const list=byDay.get(item.date)||[];list.push(item);byDay.set(item.date,list);}
 const cells=[];for(let position=0;position<42;position++){const day=position-offset+1;if(day<1||day>days){cells.push('<div class="calendar-day calendar-day-empty" aria-hidden="true"></div>');continue;}const date=dayKey(year,month,day),dayItems=byDay.get(date)||[],birthday=dayItems.find(item=>item.kind==='Service birthday');cells.push(`<div class="calendar-day ${birthday?'calendar-birthday birthday-'+birthday.style:''}" ${birthday?`data-branch="${calendarEscape(birthday.branch)}"`:''}><time datetime="${date}">${day}</time><div class="calendar-items">${dayItems.map(item=>item.id?`<a class="calendar-item calendar-event" href="/events/${calendarEscape(item.id)}">${calendarEscape(item.title)}</a>`:`<span class="calendar-item ${item.kind==='Service birthday'?'calendar-service':'calendar-holiday'}">${calendarEscape(item.title)}</span>`).join('')}</div></div>`);}
 const label=new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'UTC'}).format(first),link=value=>`${path}?month=${value}#calendar`;
 return `<section class="panel month-calendar" id="calendar" aria-labelledby="calendar-title"><div class="calendar-heading"><div><span class="eyebrow">MONTH AT A GLANCE</span><h2 id="calendar-title">${calendarEscape(title)}</h2></div><nav aria-label="Choose calendar month"><a href="${calendarEscape(link(shiftMonth(selected,-1)))}">Previous</a><strong>${calendarEscape(label)}</strong><a href="${calendarEscape(link(shiftMonth(selected,1)))}">Next</a></nav></div><div class="calendar-weekdays" aria-hidden="true">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=>`<span>${day}</span>`).join('')}</div><div class="calendar-grid">${cells.join('')}</div>${includeMilestones?'<p class="small-note">Federal holidays and military service birthdays are reference dates. Service birthday tiles use original branch-name medallions because official military seals are restricted to authorized use.</p>':''}</section>`;
}
