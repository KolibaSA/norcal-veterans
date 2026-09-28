import { createRecordFeature } from '../../shared/browser-records.mjs';
import { esc } from '../../shared/browser-ui.mjs';

// This feature owns its record lifecycle; the shared editor handles common fields.
export function createFeature() {
  return createRecordFeature({ kind: 'coordination', title: 'Coordination', statuses: ["draft","active","archived"],
    connect(context) {
      const { $, api, message } = context;
      async function showEventInvitations() {
        if (context.tab !== 'coordination' || !api) return;
        let panel = $('eventCoordination');
        if (!panel) {
          $('content').insertAdjacentHTML('afterbegin', '<section id="eventCoordination" class="panel" aria-labelledby="eventCoordinationTitle"><h2 id="eventCoordinationTitle">Event invitations</h2><div id="eventCoordinationList" aria-live="polite">Loading invitations…</div></section>');
          panel = $('eventCoordination');
        }
        try {
          const { invitations } = await api('event-invitations');
          if (context.tab !== 'coordination' || !panel.isConnected) return;
          $('eventCoordinationList').innerHTML = invitations.length ? invitations.map(item =>
            `<div class="event-invite-item"><span><strong>${esc(item.event_title)}</strong> · ${esc(item.host_name || 'Event host')} invited ${esc(item.recipient_name)} · ${esc(item.status === 'accepted' ? 'Going' : item.status)}` +
            (item.event_status === 'published' ? ` · <a href="/events/${encodeURIComponent(item.event_id)}">Public event</a>` : '') +
            `</span><span class="actions">` +
            (item.can_respond && item.status !== 'withdrawn' && item.event_status !== 'archived' ? `<button type="button" class="secondary" data-event-response="accepted" data-event="${esc(item.event_id)}" data-org="${esc(item.recipient_org_id)}" data-version="${item.version}" data-note="${item.requires_note}">Going</button><button type="button" class="secondary" data-event-response="declined" data-event="${esc(item.event_id)}" data-org="${esc(item.recipient_org_id)}" data-version="${item.version}" data-note="${item.requires_note}">Declined</button>` : '') +
            '</span></div>').join('') : '<p class="small muted">No event invitations in your assignment.</p>';
          for (const button of $('eventCoordinationList').querySelectorAll('[data-event-response]')) button.onclick = async () => {
            let note = '';
            if (button.dataset.note === 'true') {
              note = window.prompt('How did this organization confirm its response? Record a brief source note.') || '';
              if (!note.trim()) return;
            }
            button.disabled = true;
            try {
              await api('event-invitations', { method: 'POST', body: JSON.stringify({ action: 'respond',
                event_id: button.dataset.event, recipient_org_id: button.dataset.org,
                response: button.dataset.eventResponse, version: Number(button.dataset.version), note }) });
              message('Invitation response saved.'); await showEventInvitations();
            } catch (cause) { message(cause.message, true); button.disabled = false; }
          };
        } catch (cause) { if (context.tab === 'coordination') $('eventCoordinationList').textContent = cause.message; }
      }
      return { sectionLoaded() { if (context.tab === 'coordination') void showEventInvitations(); } };
    }
  });
}
