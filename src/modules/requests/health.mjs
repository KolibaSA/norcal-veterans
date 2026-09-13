import { isPlatformAdmin } from '../../shared/permissions.mjs';
import { esc, label, dateLabel } from '../../shared/browser-ui.mjs';
export function healthDescription(health, now = Date.now()) {
  if (!health?.configured) return 'Automatic request processing is not configured.';
  if (!health.last_successful_check) return 'Waiting for the first successful agent check.';
  const elapsed = now - Date.parse(health.last_successful_check);
  if (!Number.isFinite(elapsed) || elapsed > 15 * 60 * 1000) return 'The agent has not checked recently. Keep its computer awake with Codex running.';
  if (health.last_error && (!health.last_error_at || Date.parse(health.last_error_at) >= Date.parse(health.last_successful_check))) return 'The agent needs attention. Review the error below.';
  return health.current_request_id ? 'The agent has an active request.' : 'The agent checked successfully.';
}


// Health owns polling and its API adapter, without accessing executable drafts.
export function connectHealth(context) {
  const { $, api, permitLeave, openRecord, itemURL } = context;
  async function loadHealth() {
    if (context.tab !== 'request') return;
    if (!isPlatformAdmin(context.me)) {
      $('processor').textContent = 'Executable requests are managed by the platform owner and Super Admins. Your assignment controls which project records you can edit.';
      return;
    }
    try {
      const health = await api('agent-health');
      if (context.tab !== 'request') return;
      $('processor').innerHTML = `<strong>${esc(healthDescription(health))}</strong><p>Queued owner and Super Admin requests are checked every five minutes while the agent computer is awake with Codex running.</p><p class="small">Last successful check: ${esc(dateLabel(health.last_successful_check))} · Queued: ${esc(health.queued ?? 'Unknown')}</p>${health.current_request_id ? `<p>Current request: <a data-open-request="${esc(health.current_request_id)}" href="${itemURL('request', health.current_request_id)}">${esc(health.current_request_title || 'Open current request')}</a></p>` : ''}${health.last_error ? `<p class="error notice">${esc(health.last_error)}${health.last_error_at ? ' · ' + esc(dateLabel(health.last_error_at)) : ''}</p>` : ''}<button class="secondary" type="button" id="refreshHealth">Refresh agent status</button>`;
      $('refreshHealth').onclick = loadHealth;
      const current = $('processor').querySelector('[data-open-request]');
      if (current) current.onclick = async event => { event.preventDefault(); if (permitLeave()) await openRecord(current.dataset.openRequest, false); };
    } catch (cause) { if (context.tab === 'request') $('processor').textContent = 'Agent status is unavailable: ' + cause.message; }
  }


  return {
    sectionChanged() { $('processor').hidden = context.tab !== 'request'; },
    sectionLoaded() { if (context.tab === 'request') void loadHealth(); },
    initialized() { window.setInterval(() => { if (!document.hidden && context.tab === 'request') void loadHealth(); }, 60000); },
    loadHealth
  };
}
