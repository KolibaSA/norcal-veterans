import {escapeHtml as h} from '../../shared/public-shell.mjs';
import {upcomingEvents} from './presentation.mjs';

const dateFormat = new Intl.DateTimeFormat('en-US', {dateStyle: 'full', timeZone: 'America/Los_Angeles'});
const timeFormat = new Intl.DateTimeFormat('en-US', {hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles'});
const monthFormat = new Intl.DateTimeFormat('en-US', {month: 'long', timeZone: 'America/Los_Angeles'});
const dayFormat = new Intl.DateTimeFormat('en-US', {day: 'numeric', timeZone: 'America/Los_Angeles'});
const wallTime = value => {
  const [hour, minute] = value.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
};

export function organizationUpcomingEvents(events, organizationId, now = Date.now()) {
  const upcoming = upcomingEvents(events, now).filter(event => event.organization_id === organizationId);
  const cards = upcoming.map(event => {
    const listedMeeting = organizationId === 'vfw-ca-8151' && event.kind === 'Organization meeting';
    const date = new Date(event.start_at);
    const dateHeader = `<time class="organization-card-date" datetime="${h(event.start_at)}" aria-label="${h(dateFormat.format(date))}"><span>${h(monthFormat.format(date))}</span><span class="organization-card-day">${h(dayFormat.format(date))}</span></time>`;
    const times = event.meeting_times?.length
      ? `<dl class="annual-meeting-times">${event.meeting_times.map(entry => `<div><dt>${h(wallTime(entry.time))}</dt><dd>${h(entry.label)}</dd></div>`).join('')}</dl>`
      : `<p class="event-time">${event.date_only ? 'Time to be confirmed' : h(timeFormat.format(new Date(event.start_at)))}${!event.date_only && event.end_at ? ` – ${h(timeFormat.format(new Date(event.end_at)))}` : ''}</p>`;
    return `<article class="panel event-card">
      ${dateHeader}
      <span class="eyebrow">${h(event.kind)}</span>
      <h3>${listedMeeting ? h(event.title) : `<a href="/events/${h(event.id)}">${h(event.title)}</a>`}</h3>
      <time datetime="${h(event.start_at)}">${h(dateFormat.format(new Date(event.start_at)))}</time>
      ${times}
      ${event.venue ? `<p>${h(event.venue)}</p>` : ''}
      ${event.description ? `<p>${h(event.description)}</p>` : ''}
      ${event.time_note ? `<p class="small-note">${h(event.time_note)}</p>` : ''}
      ${listedMeeting ? '<p class="small-note">Confirm the latest details with the post before attending.</p>' : `<a href="/events/${h(event.id)}">Event details &amp; attendance →</a>`}
    </article>`;
  }).join('');
  return `<section id="upcoming-events" aria-labelledby="upcoming-events-title">
    <h2 id="upcoming-events-title">Upcoming events</h2>
    ${upcoming.length ? `<p class="small-note">Soonest first · All times Pacific.</p><div class="two-up">${cards}</div>` : '<p class="panel">No upcoming events are currently published. Check back soon.</p>'}
  </section>`;
}
