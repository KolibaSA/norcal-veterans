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
    const vfw8151Event = organizationId === 'vfw-ca-8151';
    const listedMeeting = vfw8151Event && event.kind === 'Organization meeting';
    const date = new Date(event.start_at);
    const dateHeader = `<time class="organization-card-date" datetime="${h(event.start_at)}" aria-label="${h(dateFormat.format(date))}"><span>${h(monthFormat.format(date))}</span><span class="organization-card-day">${h(dayFormat.format(date))}</span></time>`;
    const times = event.meeting_times?.length
      ? `<dl class="annual-meeting-times">${event.meeting_times.map(entry => `<div><dt>${h(wallTime(entry.time))}</dt><dd>${h(entry.label)}</dd></div>`).join('')}</dl>`
      : `<p class="event-time">${event.date_only ? 'Time to be confirmed' : h(timeFormat.format(new Date(event.start_at)))}${!event.date_only && event.end_at ? ` – ${h(timeFormat.format(new Date(event.end_at)))}` : ''}</p>`;
    if (vfw8151Event) {
      const badgeIcon = listedMeeting
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3.5 19v-2.3c0-2.8 2.2-4.7 5.5-4.7s5.5 1.9 5.5 4.7V19z"/><path d="M14.2 13.1c.8-.4 1.7-.6 2.8-.6 2.7 0 4.5 1.6 4.5 4V19h-5.3v-2.3c0-1.4-.4-2.6-1.2-3.5z"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h2v3h11l-2 4 2 4H7v7H5z"/></svg>';
      const dateLabel = listedMeeting
        ? dateFormat.format(date)
        : `${dateFormat.format(date)}${event.date_only ? ' · Time to be confirmed' : ` · ${timeFormat.format(date)}${event.end_at ? ` – ${timeFormat.format(new Date(event.end_at))}` : ''}`}`;
      return `<article class="panel event-card${listedMeeting ? ' vfw-meeting-card' : ''}">
        <div class="vfw-card-header">
          ${dateHeader}
          <span class="vfw-card-badge${listedMeeting ? '' : ' vfw-card-badge-community'}">${badgeIcon}${h(event.kind)}</span>
        </div>
        <h3>${listedMeeting ? h(event.title) : `<a href="/events/${h(event.id)}">${h(event.title)}</a>`}</h3>
        <div class="vfw-card-facts">
          <p class="vfw-card-fact"><svg class="vfw-card-icon vfw-card-calendar" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="15" rx="2"/><path d="M7.5 3v5M16.5 3v5M3.5 10h17"/></svg><time datetime="${h(event.start_at)}">${h(dateLabel)}</time></p>
          ${event.venue ? `<p class="vfw-card-fact"><svg class="vfw-card-icon vfw-card-pin" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-7.1 7-13a7 7 0 1 0-14 0c0 5.9 7 13 7 13z"/><circle cx="12" cy="9" r="2.4"/></svg><span>${h(event.venue)}</span></p>` : ''}
        </div>
        ${listedMeeting ? times : ''}
        ${event.description ? `<p class="vfw-card-description">${h(event.description)}</p>` : ''}
        ${listedMeeting ? '<p class="small-note vfw-card-confirmation">Confirm the latest details with the post before attending.</p>' : `${event.audience ? `<p class="vfw-card-attendance"><strong>Attendance</strong><span>${h(event.audience)}</span></p>` : ''}<a class="vfw-card-link" href="/events/${h(event.id)}">Event details &amp; attendance <span aria-hidden="true">→</span></a>`}
      </article>`;
    }
    return `<article class="panel event-card">
      ${dateHeader}
      <span class="eyebrow">${h(event.kind)}</span>
      <h3><a href="/events/${h(event.id)}">${h(event.title)}</a></h3>
      <time datetime="${h(event.start_at)}">${h(dateFormat.format(new Date(event.start_at)))}</time>
      ${times}
      ${event.venue ? `<p>${h(event.venue)}</p>` : ''}
      ${event.description ? `<p>${h(event.description)}</p>` : ''}
      ${event.time_note ? `<p class="small-note">${h(event.time_note)}</p>` : ''}
      <a href="/events/${h(event.id)}">Event details &amp; attendance →</a>
    </article>`;
  }).join('');
  return `<section id="upcoming-events" aria-labelledby="upcoming-events-title">
    <h2 id="upcoming-events-title">Upcoming events</h2>
    ${upcoming.length ? `<p class="small-note">Soonest first · All times Pacific.</p><div class="two-up${organizationId === 'vfw-ca-8151' ? ' vfw-event-grid' : ''}">${cards}</div>` : '<p class="panel">No upcoming events are currently published. Check back soon.</p>'}
  </section>`;
}
