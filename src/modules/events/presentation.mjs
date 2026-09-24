import {shell,escapeHtml,origin} from '../../shared/public-shell.mjs';
import {sanitizePublicEvent} from './serialization.mjs';
const pe=escapeHtml;
const publicDate=s=>new Intl.DateTimeFormat('en-US',{dateStyle:'full',timeStyle:'short',timeZone:'America/Los_Angeles'}).format(new Date(s));
const publicEventDate=v=>v.date_only?new Intl.DateTimeFormat('en-US',{dateStyle:'full',timeZone:'America/Los_Angeles'}).format(new Date(v.start_at))+' · Time to be confirmed':publicDate(v.start_at);
const pacificDayKey=s=>new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'America/Los_Angeles'}).format(new Date(s));
const isVfw8151Meeting=v=>v.kind==='Organization meeting'&&v.organization_id==='vfw-ca-8151';
export function eventOccurrences(v){
 const schedule=Array.isArray(v?.occurrences)&&v.occurrences.length?v.occurrences:[{start_at:v?.start_at,end_at:v?.end_at||null}];
 return schedule.map(occurrence=>({...v,start_at:occurrence.start_at,end_at:occurrence.end_at||null,occurrences:undefined})).sort((a,b)=>Date.parse(a.start_at)-Date.parse(b.start_at));
}
const occurrenceIsUpcoming=(v,now)=>v.date_only?pacificDayKey(v.start_at)>=pacificDayKey(now):Date.parse(v.end_at||v.start_at)+(!v.end_at?86400000:0)>=now;
export const upcomingEvents=(events,now=Date.now())=>events.map(sanitizePublicEvent).filter(v=>v&&v.status==='published').map(v=>{
 const occurrences=eventOccurrences(v).filter(occurrence=>occurrenceIsUpcoming(occurrence,now));
 if(!occurrences.length)return null;
 const first=occurrences[0];
 return {...v,start_at:first.start_at,end_at:first.end_at,occurrences:occurrences.map(({start_at,end_at})=>({start_at,end_at}))};
}).filter(Boolean).sort((a,b)=>Date.parse(a.start_at)-Date.parse(b.start_at));
function eventReview(v){
 if(v.source_kind==='project_team')return `<span class="label">Project team update</span><h2>Check before you go.</h2><p>${pe(v.source_note||'Event details supplied by the project team.')}</p><p>${v.source_checked&&v.source_url?'Supporting source reviewed '+pe(v.source_checked)+'.':'Independent source verification is pending.'}</p>`;
 if(v.source_checked&&v.source_url)return `<span class="label">Published source checked</span><h2>Check before you go.</h2><p>Source reviewed ${pe(v.source_checked)}. This listing has not been directly confirmed with the organizer.</p>`;
 return '<span class="label">Verification pending</span><h2>Check before you go.</h2><p>This published listing has no recorded source review. Confirm the details directly with the organizer.</p>';
}
const icons={
 calendar:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2v3M17 2v3M3.5 9h17M5.5 4h13a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01"/></svg>',
 location:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
 poppy:'<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 29c-9 3-17-2-15-9 2-6 10-7 15-2-4-8-1-16 6-17 7-1 11 7 7 13 8-4 16 0 15 7-1 7-10 9-15 3 5 7 2 15-5 16-7 0-10-8-6-14-4 6-12 8-17 4-6-5-2-14 5-16 6-1 11 4 12 9Z"/><circle cx="32" cy="29" r="3.5"/><path d="M32 33c1 9-2 17-7 23M29 45c-4-3-8-3-11 0M28 49c4-3 8-2 10 1"/></svg>',
 football:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.7 4.3c2.3 2.3.8 7.6-3.3 11.7s-9.4 5.6-11.7 3.3-.8-7.6 3.3-11.7 9.4-5.6 11.7-3.3Z"/><path d="m8.5 15.5 7-7M10.5 9.5l4 4M8.7 11.3l4 4"/></svg>',
 volunteer:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.1-7-9.4a4 4 0 0 1 7-2.5 4 4 0 0 1 7 2.5C19 15.9 12 20 12 20Z"/><path d="M12 4v4M9.5 6h5"/></svg>',
 ceremony:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 22V3M7 4h11l-2.5 4L18 12H7"/></svg>',
 community:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3.5 20c.3-4 2.2-6 5.5-6s5.2 2 5.5 6M14 15c3.7-.8 6 .9 6.5 4.5"/></svg>'
};
function eventVisual(v){
 const text=`${v.kind||''} ${v.title||''} ${v.description||''}`.toLowerCase();
 if(/poppy/.test(text))return 'poppy';
 if(/army\s*[–—-]?\s*navy|football|watch party/.test(text))return 'football';
 if(/volunteer|service day|community service|cleanup|clean-up/.test(text))return 'volunteer';
 if(/ceremon|memorial|remembrance|wreath|honou?r|commemor/.test(text))return 'ceremony';
 return 'community';
}
const eventMonthFormat=new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'America/Los_Angeles'});
const eventMonthShort=new Intl.DateTimeFormat('en-US',{month:'short',timeZone:'America/Los_Angeles'});
const eventDayFormat=new Intl.DateTimeFormat('en-US',{day:'numeric',timeZone:'America/Los_Angeles'});
const eventTimeFormat=new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/Los_Angeles'});
const eventChipFormat=new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'America/Los_Angeles'});
function organizationMark(organization){
 const name=organization?.verified_name||'';
 return (name.match(/\b(?:post|detachment|chapter|unit)\s*(?:no\.?\s*)?#?\s*([a-z]?\d+[a-z-]*)\b/i)||[])[1]||name.split(/\s+/).filter(Boolean).slice(0,3).map(word=>word[0]).join('').toUpperCase();
}
function organizationTheme(organization){
 const type=organization?.organization_type||'';
 if(type==='VFW')return 'vfw';if(type==='American Legion')return 'legion';if(type==='Marine Corps League')return 'mcl';if(type==='Toys for Tots')return 'toys';if(type==='Veterans Beer Club')return 'vbc';if(type==='DAV')return 'dav';if(type==='County Veterans Office')return 'county';if(type==='Equine program provider')return 'equine';if(type==='Veteran remembrance program')return 'remembrance';if(type==='Veterans nonprofit')return 'nonprofit';return 'community';
}
function compactEventTitle(title,organization){
 let output=String(title||'').trim(),name=String(organization?.verified_name||'').trim();
 const candidates=[name,...name.match(/\b(?:VFW\s+Post|American\s+Legion(?:\s+Post)?|Marine\s+Corps\s+League(?:\s*[-–—]\s*[^,]+)?\s+Detachment)\s*#?\s*\d+\b/ig)||[]].filter(Boolean).sort((a,b)=>b.length-a.length);
 for(const candidate of candidates){const escaped=candidate.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');output=output.replace(new RegExp(`(?:^|\\s*[–—:|-]\\s*|\\s+)${escaped}(?=\\s|[–—:|-]|$)`,'i'),' ').replace(/^[\s–—:|-]+|[\s–—:|-]+$/g,'').replace(/\s{2,}/g,' ');}
 return output||String(title||'Event');
}
function eventTime(v){
 if(v.date_only)return 'Time to be confirmed';
 const start=eventTimeFormat.format(new Date(v.start_at));
 return v.end_at?`${start} – ${eventTimeFormat.format(new Date(v.end_at))}`:start;
}
const meetingTimeLabel=value=>{const [hour,minute]=value.split(':').map(Number);return `${hour%12||12}:${String(minute).padStart(2,'0')} ${hour<12?'AM':'PM'}`;};
function compactOccurrenceDays(occurrences){
 const months=new Set(occurrences.map(event=>eventMonthShort.format(new Date(event.start_at))));
 const values=occurrences.map(event=>months.size===1?eventDayFormat.format(new Date(event.start_at)):`${eventMonthShort.format(new Date(event.start_at))} ${eventDayFormat.format(new Date(event.start_at))}`);
 return values.length===2?`${values[0]} & ${values[1]}`:`${values.slice(0,-1).join(', ')} & ${values.at(-1)}`;
}
function occurrenceTime(occurrences){
 const values=occurrences.map(event=>eventTime(event));
 return occurrences.every(event=>event.date_only)?'Time TBD':values.every(value=>value===values[0])?values[0]:'Times vary';
}
export function publicEventCard(v,organizations=[],occurrences=eventOccurrences(v)){
 occurrences=[...occurrences].sort((a,b)=>Date.parse(a.start_at)-Date.parse(b.start_at));
 const multi=occurrences.length>1;
 const host=organizations.find(organization=>organization.id===v.organization_id),visual=eventVisual(v),title=compactEventTitle(v.title,host),accepted=(v.accepted_organization_ids||[]).map(id=>organizations.find(organization=>organization.id===id)).filter(organization=>organization&&organization.id!==host?.id),shown=accepted.slice(0,2),remaining=accepted.length-shown.length;
 const hostName=host?.verified_name||v.organizer||'',hostBadge=host?`<a class="event-card-host" href="/organizations/${pe(host.id)}">${pe(hostName)}</a>`:hostName?`<span class="event-card-host">${pe(hostName)}</span>`:'';
 const participants=shown.length?`<p class="event-card-partners"><span>with</span> ${shown.map(organization=>`<a href="/organizations/${pe(organization.id)}">${pe(organization.verified_name)}</a>`).join(' <span aria-hidden="true">·</span> ')}${remaining?` <a href="/events/${pe(v.id)}">+${remaining} more</a>`:''}</p>`:'';
 const image=v.image_url&&visual!=='poppy'?`<img src="${pe(v.image_url)}" alt="${pe(title)} event image" width="320" height="320" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:`<span class="event-card-fallback" aria-hidden="true">${icons[visual]}</span>`;
 const dateBlock=multi?`<div class="event-card-date event-card-date--multi"><span>${new Set(occurrences.map(event=>eventMonthShort.format(new Date(event.start_at)))).size===1?pe(eventMonthShort.format(new Date(v.start_at))):'DATES'}</span><strong>${pe(compactOccurrenceDays(occurrences))}</strong><em>MULTI-DAY EVENT</em></div>`:`<time class="event-card-date" datetime="${pe(v.date_only?pacificDayKey(v.start_at):v.start_at)}"><span>${pe(eventMonthShort.format(new Date(v.start_at)))}</span><strong>${pe(eventDayFormat.format(new Date(v.start_at)))}</strong></time>`;
 const dates=multi?`<div class="event-card-occurrences"><b>Event Dates:</b><span>${occurrences.map(event=>`<time datetime="${pe(event.date_only?pacificDayKey(event.start_at):event.start_at)}">${pe(eventChipFormat.format(new Date(event.start_at)))}</time>`).join('')}</span></div>`:'';
 const meetingTimes=Array.isArray(v.meeting_times)&&v.meeting_times.length?`<div class="event-card-meeting-times"><b>Meeting times:</b><span>${v.meeting_times.map(entry=>`<span><strong>${pe(meetingTimeLabel(entry.time))}</strong> ${pe(entry.label)}</span>`).join('')}</span></div>`:'';
 const actions=[v.volunteer_enabled&&v.volunteer_url?`<a class="event-card-action event-card-action--volunteer" href="${pe(v.volunteer_url)}">Volunteer Now</a>`:'',v.donate_enabled&&v.donate_url?`<a class="event-card-action event-card-action--donate" href="${pe(v.donate_url)}">Donate Now</a>`:'',v.tickets_enabled&&v.tickets_url?`<a class="event-card-action event-card-action--tickets" href="${pe(v.tickets_url)}">Buy Tickets</a>`:''].filter(Boolean).join('');
 return `<article class="event-card event-card--public event-card--${visual}${actions?' event-card--has-actions':''}">
  <div class="event-card-media">${image}</div>
  ${dateBlock}
  <div class="event-card-content"><div class="event-card-title-row"><h2>${pe(title)}</h2>${hostBadge}</div>${participants}${dates}${meetingTimes}<p class="event-card-summary"><strong>${pe(multi?occurrenceTime(occurrences):eventTime(v))}</strong><span aria-hidden="true"> · </span>${pe(v.venue)}</p></div>
  <div class="event-card-backdrop event-card-theme--${organizationTheme(host)}" aria-hidden="true"><span>${pe(organizationMark(host))}</span></div>
  ${actions?`<div class="event-card-actions">${actions}</div>`:''}
  <a class="event-card-hit-area" href="/events/${pe(v.id)}" aria-label="View details for ${pe(title)}"><span class="sr-only">View details for ${pe(title)}</span></a>
 </article>`;
}
const eventCityGroups=[
 ['Yolo County',['Davis','West Sacramento','Winters','Woodland']],
 ['Solano County',['Benicia','Dixon','Fairfield','Rio Vista','Suisun City','Vacaville','Vallejo']]
];
const eventCities=new Set(eventCityGroups.flatMap(([,cities])=>cities));
const eventCityOptions=selected=>'<option value="">All Yolo &amp; Solano cities</option>'+eventCityGroups.map(([county,cities])=>`<optgroup label="${county}">${cities.map(city=>`<option value="${city}" ${selected===city?'selected':''}>${city}</option>`).join('')}</optgroup>`).join('');
export function eventsPagePublic(url,events,organizations=[]){
 const requestedCity=url.searchParams.get('city')||'',city=eventCities.has(requestedCity)?requestedCity:'',upcoming=upcomingEvents(events).filter(v=>v.kind!=='Organization meeting'&&(!city||v.city===city));
 const months=new Map();for(const event of upcoming){const key=eventMonthFormat.format(new Date(event.start_at));const values=months.get(key)||[];values.push(event);months.set(key,values);}
 const listing=upcoming.length?[...months].map(([month,items])=>`<section class="event-month" aria-labelledby="event-month-${pe(month.replace(/\W+/g,'-').toLowerCase())}"><h2 id="event-month-${pe(month.replace(/\W+/g,'-').toLowerCase())}">${pe(month)}</h2><div class="event-card-grid">${items.map(event=>publicEventCard(event,organizations)).join('')}</div></section>`).join(''):'<div class="panel"><h2>No upcoming listings for this selection.</h2><p>More events are being verified. Browse all cities or share a proposed event below.</p></div>';
 return shell('Community events | Yolo Solano Veterans','Find published veteran community events, remembrance ceremonies and volunteer opportunities in Yolo and Solano counties.',`<section class="wrap about-page events-page"><span class="eyebrow">MAKE TIME FOR COMMUNITY</span><h1>Show up.<br><em>Connect. Give back.</em></h1><p class="intro">Published local events and opportunities to serve across Yolo and Solano counties.</p><section class="panel"><span class="eyebrow">REMEMBER &amp; HONOR</span><h2>Memorial Day services</h2><p>Find services by city, with verified past schedules and 2027 details to be confirmed.</p><a class="button outline" href="/memorial-day">Explore the city-by-city guide →</a></section><form class="panel inline-form" method="get"><label for="event-city">Explore by city</label><select id="event-city" name="city">${eventCityOptions(city)}</select><button class="button">Show events</button><a href="/events.ics">Download calendar ↓</a></form><p class="results-note">${upcoming.length} upcoming listings · Pacific time. Open each listing for its source and verification status; confirm schedule, accessibility and attendance rules with the host. Calendar downloads are a snapshot and do not refresh automatically.</p>${listing}<div class="partner-strip panel"><h2>Have something to share?</h2><p>Send the public details and organizer’s source. A review comes before publication.</p><a class="button light" href="/for-organizations?kind=event">Propose an event →</a></div></section>`,{path:'/events'});
}
export function eventDetail(v,organizations=[]){
 const current=upcomingEvents([v])[0],event=current||sanitizePublicEvent(v)||v,occurrences=eventOccurrences(event),host=organizations.find(r=>r.id===event.organization_id),past=!current;
 const when=occurrences.length===1?`${pe(publicEventDate(occurrences[0]))}${!event.date_only&&occurrences[0].end_at?'<br>Ends '+pe(publicDate(occurrences[0].end_at)):''}`:`<ul class="event-detail-dates">${occurrences.map(occurrence=>`<li><time datetime="${pe(event.date_only?pacificDayKey(occurrence.start_at):occurrence.start_at)}">${pe(publicEventDate(occurrence))}${!event.date_only&&occurrence.end_at?' – '+pe(eventTimeFormat.format(new Date(occurrence.end_at))):''}</time></li>`).join('')}</ul>`;
 return shell(`${event.title} | Yolo Solano Veterans`,event.description,`<section class="wrap detail-page event-detail-page"><a class="back" href="/events">← All events</a><div class="profile-heading"><span class="eyebrow">${pe(event.kind)} · ${pe(event.county)} COUNTY</span><h1>${pe(event.title)}</h1>${past?'<span class="label amber">Past event</span>':''}<p>${pe(event.description)}</p></div><div class="profile-grid"><section class="panel"><h2>Plan your visit</h2><dl><div><dt>When</dt><dd>${when}</dd></div><div><dt>Where</dt><dd>${pe(event.venue)}<br><a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(event.venue)}" target="_blank" rel="noopener noreferrer">Open venue in Maps ↗</a></dd></div><div><dt>Who can attend?</dt><dd>${pe(event.audience)}</dd></div><div><dt>Organizer</dt><dd>${pe(event.organizer)}${host?`<br><a href="/organizations/${host.id}">View related organization →</a>`:''}</dd></div></dl>${event.time_note?`<p class="small-note">${pe(event.time_note)}</p>`:''}<div class="profile-actions">${event.source_url?`<a class="button" href="${pe(event.source_url)}" target="_blank" rel="noopener noreferrer">${event.source_kind==='project_team'?'Organizer website':'Organizer details / registration'} ↗</a>`:''}<a class="button outline" href="/events.ics?event=${pe(event.id)}">Add to calendar ↓</a></div></section><aside class="panel">${eventReview(event)}<p>Follow the organizer’s latest instructions for registration, accessibility, weather changes and cancellations.</p><a href="/for-organizations?kind=event">Suggest a correction →</a></aside></div></section>`,{path:'/events/'+event.id,detail:true});
}
const icsEscape=s=>String(s||'').replaceAll('\\','\\\\').replace(/\r?\n/g,'\\n').replaceAll(';','\\;').replaceAll(',','\\,');
const utc=s=>new Date(s).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
function foldICS(line){const lines=[];let current='',bytes=0;for(const c of line){const n=new TextEncoder().encode(c).length;if(bytes+n>74){lines.push(current);current=' ';bytes=1;}current+=c;bytes+=n;}lines.push(current);return lines.join('\r\n');}
export function eventCalendar(events){events=events.map(sanitizePublicEvent).filter(Boolean);const stamp=utc(new Date());const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Yolo Solano Veterans//Community Calendar//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:Yolo Solano Veterans'];for(const v of events){if(v.status!=='published')continue;const occurrences=eventOccurrences(v);for(const occurrence of occurrences){const day=pacificDayKey(occurrence.start_at),nextDay=new Date(Date.parse(day+'T00:00:00Z')+86400000).toISOString().slice(0,10),schedule=v.date_only?['DTSTART;VALUE=DATE:'+day.replaceAll('-',''),'DTEND;VALUE=DATE:'+nextDay.replaceAll('-','')]:['DTSTART:'+utc(occurrence.start_at),...(occurrence.end_at?['DTEND:'+utc(occurrence.end_at)]:[])],note=(v.date_only?'Time to be confirmed. This calendar entry reserves the date; event hours have not been announced.\n':'')+v.description+'\n'+v.audience+(v.source_kind==='project_team'?'\n'+(v.source_note||'Details supplied by the project team.'):'')+(v.source_url?'\nConfirm latest details: '+v.source_url:''),uid=occurrences.length>1?`${v.id}-${day}`:v.id;lines.push('BEGIN:VEVENT','UID:'+icsEscape(uid)+'@yolo-county-veterans','DTSTAMP:'+stamp,...schedule,'SUMMARY:'+icsEscape(v.title+(v.date_only?' — Time to be confirmed':'')),'DESCRIPTION:'+icsEscape(note),'LOCATION:'+icsEscape(v.venue),...(!isVfw8151Meeting(v)?['URL:'+origin+'/events/'+encodeURIComponent(v.id)]:[]),'END:VEVENT');}}lines.push('END:VCALENDAR');return lines.map(foldICS).join('\r\n')+'\r\n';}
