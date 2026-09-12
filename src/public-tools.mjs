// Public-route composition and compatibility exports; feature behavior lives in modules.
import {submissionPage as renderSubmissionPage} from './modules/submissions/public.mjs';
import {memorialDayPage} from './memorial-day.mjs';
import {records} from './data.mjs';
import {speakerSubmissionPage} from './modules/share-program/public.mjs';
import {sanitizePublicEvent,eventsPagePublic,eventDetail} from './modules/events/public.mjs';
export {upcomingEvents,eventCalendar} from './modules/events/public.mjs';
export function submissionPage(url, options = {}) { return renderSubmissionPage(url, {organizations: records, ...options}); }
export function publicExtension(url,events,organizations=records){events=events.map(sanitizePublicEvent).filter(Boolean);if(url.pathname==='/memorial-day')return {status:200,html:memorialDayPage(url)};if(url.pathname==='/share')return {status:200,html:speakerSubmissionPage(url,organizations,{received:url.searchParams.has('received')})};if(url.pathname==='/for-organizations')return {status:200,html:submissionPage(url,{received:url.searchParams.has('received'),organizations})};if(url.pathname==='/events')return {status:200,html:eventsPagePublic(url,events)};if(url.pathname.startsWith('/events/')){const v=events.find(v=>v.id===url.pathname.slice(8)&&v.status==='published');if(v)return {status:200,html:eventDetail(v,organizations)};}return null;}
