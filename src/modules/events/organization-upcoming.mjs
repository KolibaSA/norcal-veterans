import {eventOccurrences,publicEventCard,upcomingEvents} from './presentation.mjs';

function groupedOccurrences(events, organizationId) {
  const grouped = [];
  const communityGroups = new Map();
  for (const event of events) {
    const occurrences = eventOccurrences(event);
    if (organizationId !== 'vfw-ca-8151' || event.kind === 'Organization meeting') {
      grouped.push(occurrences);
      continue;
    }
    const key = [event.title, event.organization_id, event.venue, event.city, event.county]
      .map(value => String(value || '').trim().toLowerCase()).join('\u0000');
    const existing = communityGroups.get(key);
    if (existing) existing.push(...occurrences);
    else { communityGroups.set(key, occurrences); grouped.push(occurrences); }
  }
  return grouped;
}

function combinedEvent(occurrences) {
  const event = occurrences[0];
  return {
    ...event,
    accepted_organization_ids: [...new Set(occurrences.flatMap(item => item.accepted_organization_ids || []))],
    volunteer_enabled: occurrences.some(item => item.volunteer_enabled && item.volunteer_url),
    volunteer_url: occurrences.find(item => item.volunteer_enabled && item.volunteer_url)?.volunteer_url || '',
    donate_enabled: occurrences.some(item => item.donate_enabled && item.donate_url),
    donate_url: occurrences.find(item => item.donate_enabled && item.donate_url)?.donate_url || '',
    tickets_enabled: occurrences.some(item => item.tickets_enabled && item.tickets_url),
    tickets_url: occurrences.find(item => item.tickets_enabled && item.tickets_url)?.tickets_url || ''
  };
}

export function organizationUpcomingEvents(events, organizationId, now = Date.now(), organizations = []) {
  const upcoming = upcomingEvents(events, now).filter(event => event.organization_id === organizationId);
  const groups = groupedOccurrences(upcoming, organizationId);
  const cards = groups.map(occurrences => {
    const event = combinedEvent(occurrences);
    return publicEventCard(event, organizations, occurrences);
  }).join('');
  return `<section id="upcoming-events" class="events-page organization-events" aria-labelledby="upcoming-events-title">
    <h2 id="upcoming-events-title">Upcoming events</h2>
    ${upcoming.length ? `<p class="small-note">Soonest first · All times Pacific.</p><div class="event-card-grid">${cards}</div>` : '<p class="panel">No upcoming events are currently published. Check back soon.</p>'}
  </section>`;
}
