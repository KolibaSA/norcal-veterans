import { createRecordFeature } from '../../shared/browser-records.mjs';
import { esc } from '../../shared/browser-ui.mjs';
export function pacificInput(value, dateOnly = false) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return dateOnly ? value : value + 'T00:00';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).map(x => [x.type, x.value]));
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  return dateOnly ? day : `${day}T${parts.hour}:${parts.minute}`;
}

const eventDatePattern = /^\d{4}-\d{2}-\d{2}$/;
export function eventDateList(value) {
  const values = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(values.map(item => String(item).trim()).filter(item => eventDatePattern.test(item)))].sort();
}
const eventDateLabel = value => new Intl.DateTimeFormat('en-US', {
  weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'
}).format(new Date(value + 'T12:00:00Z'));
function renderAdditionalDates($) {
  const dates = eventDateList($('additionalDates').value);
  $('additionalDates').value = dates.join(',');
  $('additionalDateList').innerHTML = dates.length
    ? dates.map(date => `<span class="event-date-chip"><time datetime="${date}">${eventDateLabel(date)}</time><button type="button" class="secondary" data-remove-event-date="${date}" aria-label="Remove ${eventDateLabel(date)}">Remove</button></span>`).join('')
    : '<span class="small muted">No additional dates added.</span>';
  $('additionalDateList').querySelectorAll('[data-remove-event-date]').forEach(button => {
    button.onclick = () => {
      $('additionalDates').value = dates.filter(date => date !== button.dataset.removeEventDate).join(',');
      renderAdditionalDates($);
    };
  });
}

export function eventFields(record = {}) {
  const p = record.payload ?? {}, dayOnly = p.date_only === true;
  const additionalDates = (Array.isArray(p.additional_occurrences) ? p.additional_occurrences : [])
    .map(occurrence => pacificInput(occurrence?.start_at, true)).filter(Boolean);
  return {
    dateOnly: dayOnly, start: p.starts_local ?? pacificInput(p.start_at, dayOnly),
    end: p.ends_local ?? pacificInput(p.end_at, dayOnly), venue: p.venue ?? '', eventCity: p.city ?? '',
    additionalDate: '', additionalDates: eventDateList(additionalDates).join(','),
    eventCounty: p.county ?? '', eventKind: p.kind ?? '', organizer: p.organizer ?? '', audience: p.audience ?? '',
    eventImage: p.image_url ?? '',
    eventVolunteer: p.volunteer_enabled === true, volunteerUrl: p.volunteer_url ?? '',
    eventDonate: p.donate_enabled === true, donateUrl: p.donate_url ?? '',
    eventTickets: p.tickets_enabled === true, ticketsUrl: p.tickets_url ?? '',
    source: p.source_url ?? '', sourceChecked: p.source_checked?.slice(0, 10) ?? '', timeNote: p.time_note ?? '',
    sourceKind: p.source_kind ?? '', sourceNote: p.source_note ?? '', reviewNotes: p.review_notes ?? ''
  };
}
export function eventPayload(fields, previous = {}) {
  const p = structuredClone(previous);

    Object.assign(p, {
      title: fields.recordTitle, description: fields.recordBody, starts_local: fields.start,
      ends_local: fields.dateOnly ? '' : fields.end, date_only: !!fields.dateOnly,
      additional_dates: eventDateList(fields.additionalDates),
      venue: fields.venue, city: fields.eventCity, county: fields.eventCounty,
      kind: fields.eventKind || 'Community event', organizer: fields.organizer, audience: fields.audience,
      image_url: fields.eventImage,
      volunteer_enabled: !!fields.eventVolunteer, volunteer_url: fields.volunteerUrl,
      donate_enabled: !!fields.eventDonate, donate_url: fields.donateUrl,
      tickets_enabled: !!fields.eventTickets, tickets_url: fields.ticketsUrl,
      source_url: fields.source, source_checked: fields.sourceChecked || null, time_note: fields.timeNote,
      source_kind: fields.sourceKind, source_note: fields.sourceNote, review_notes: fields.reviewNotes
    });
  return p;
}
export function updateDateFields($) {
  const dateOnly = $('dateOnly').checked;
  for (const id of ['start', 'end']) {
    const value = $(id).value;
    $(id).type = dateOnly ? 'date' : 'datetime-local';
    $(id).value = dateOnly ? value.slice(0, 10) : value && value.length === 10 ? value + 'T00:00' : value;
  }
  $('end').disabled = dateOnly;
}
export function createFeature() {
  return createRecordFeature({ kind: 'event', title: 'Events', editorLabel: 'event', statuses: ['draft', 'published', 'archived'],
    editorSections: ['eventFields', 'reviewFields'], fields: eventFields, payload: eventPayload,
    configureEditor({ $, values }) {
      $('start').type = values.dateOnly ? 'date' : 'datetime-local';
      $('end').type = values.dateOnly ? 'date' : 'datetime-local';
      $('end').disabled = !!values.dateOnly;
      $('start').required = true; $('venue').required = true; $('additionalDate').required = false;
    },
    connect(context) {
      const { $, message, api, loadSection } = context;
      let invitationEventId = null;
      async function loadInvitations(eventId) {
        if (!api || !eventId) return;
        try {
          const result = await api('event-invitations?event_id=' + encodeURIComponent(eventId));
          if (invitationEventId !== eventId) return;
          $('eventInviteControls').hidden = !result.can_invite;
          const active = new Set(result.invitations.filter(item => ['pending','accepted'].includes(item.status)).map(item => item.recipient_org_id));
          const choices = result.organizations.filter(org => !active.has(org.id));
          $('eventInviteOrganization').innerHTML = '<option value="">Choose an organization</option>' +
            choices.map(org => `<option value="${esc(org.id)}">${esc(org.title)}</option>`).join('');
          $('eventInviteButton').disabled = !choices.length;
          $('eventInviteList').innerHTML = result.invitations.length ? result.invitations.map(item =>
            `<div class="event-invite-item"><span><strong>${esc(item.recipient_name)}</strong> · ${esc(item.status === 'accepted' ? 'Going' : item.status)}</span><span class="actions">` +
            (item.can_respond && item.status !== 'withdrawn' ? `<button type="button" class="secondary" data-invite-response="accepted" data-invite-org="${esc(item.recipient_org_id)}" data-invite-version="${item.version}" data-invite-note="${item.requires_note}">Going</button><button type="button" class="secondary" data-invite-response="declined" data-invite-org="${esc(item.recipient_org_id)}" data-invite-version="${item.version}" data-invite-note="${item.requires_note}">Declined</button>` : '') +
            (item.can_withdraw && item.status !== 'withdrawn' ? `<button type="button" class="secondary" data-invite-withdraw="${esc(item.recipient_org_id)}" data-invite-version="${item.version}">Withdraw</button>` : '') +
            '</span></div>').join('') : '<p class="small muted">No organizations invited yet.</p>';
          for (const button of $('eventInviteList').querySelectorAll('[data-invite-response],[data-invite-withdraw]')) button.onclick = async () => {
            const recipient_org_id = button.dataset.inviteOrg || button.dataset.inviteWithdraw;
            let note = '';
            if (button.dataset.inviteNote === 'true') {
              note = window.prompt('How did this organization confirm its response? Record a brief source note.') || '';
              if (!note.trim()) return;
            }
            button.disabled = true;
            try {
              await api('event-invitations', { method: 'POST', body: JSON.stringify({ event_id: eventId, recipient_org_id,
                action: button.dataset.inviteWithdraw ? 'withdraw' : 'respond', response: button.dataset.inviteResponse,
                version: Number(button.dataset.inviteVersion), note }) });
              message('Invitation updated.'); await loadInvitations(eventId);
            } catch (cause) { message(cause.message, true); button.disabled = false; }
          };
        } catch (cause) { if (invitationEventId === eventId) $('eventInviteList').textContent = cause.message; }
      }
      $('eventInviteButton').onclick = async () => {
        const eventId = invitationEventId, recipient_org_id = $('eventInviteOrganization').value;
        if (!eventId || !recipient_org_id) return $('eventInviteOrganization').focus();
        $('eventInviteButton').disabled = true;
        try {
          await api('event-invitations', { method: 'POST', body: JSON.stringify({ event_id: eventId, recipient_org_id, action: 'invite' }) });
          message('Organization invited. The invitation remains private until it responds Going.');
          await loadInvitations(eventId);
        } catch (cause) { message(cause.message, true); $('eventInviteButton').disabled = false; }
      };
      $('dateOnly').onchange = () => updateDateFields($);
      $('addEventDate').onclick = () => {
        const date = $('additionalDate').value, firstDate = $('start').value.slice(0, 10);
        if (!date) return $('additionalDate').focus();
        if (firstDate && date <= firstDate) return message('Choose an additional date after the first event date.', true);
        $('additionalDates').value = eventDateList([...eventDateList($('additionalDates').value), date]).join(',');
        $('additionalDate').value = '';
        renderAdditionalDates($);
      };
      $('deleteEvent').onclick = async () => {
        const record = context.editing;
        if (!record?.id || !window.confirm(`Delete “${record.title}”? This removes it from HQ and all public event listings. Any unsaved edits will also be lost.`)) return;
        $('deleteEvent').disabled = true;
        try {
          await api('records/' + encodeURIComponent(record.id), { method: 'DELETE', body: JSON.stringify({ version: record.version }) });
          message('Event deleted.');
          await loadSection();
        } catch (cause) { message(cause.message, true); }
        finally { $('deleteEvent').disabled = false; }
      };
      return {
        editorOpened(record, { editable }) { if (context.tab !== 'event') return;
          renderAdditionalDates($); $('deleteEventSection').hidden = !record?.id || !editable;
          invitationEventId = record?.id || null; $('eventInvitations').hidden = !record?.id;
          if (record?.id) { $('eventInviteList').textContent = 'Loading invitations…'; void loadInvitations(record.id); }
        },
        editorClosed() { invitationEventId = null; $('eventInvitations').hidden = true; },
        resetEditor() { invitationEventId = null; $('eventInvitations').hidden = true;
          $('start').required = false; $('venue').required = false; $('additionalDate').required = false; $('additionalDate').value = ''; $('deleteEventSection').hidden = true; }
      };
    }
  });
}
