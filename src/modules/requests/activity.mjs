import { esc, label, dateLabel } from '../../shared/browser-ui.mjs';
// Activity owns immutable-run history, comment/reconciliation actions and unsaved activity state.
export function connectActivity(context) {
  const { $, api, message, loadSection } = context;
  const requestPath = id => 'requests/' + encodeURIComponent(id);
  let requestHistory = null;
  async function loadActivity(id = context.editing?.id) {
    if (!id || !context.me.owner) return;
    $('refreshActivity').disabled = true;
    try {
      const activity = await api(requestPath(id) + '/history');
      if (context.editing?.id !== id) return;
      requestHistory = activity;
      const entries = activity.entries ?? [];
      $('activity').innerHTML = entries.map(entry => `<article class="timeline"><h4>${esc(label(entry.kind))}${entry.status ? ' · ' + esc(label(entry.status)) : ''}</h4><p class="small muted">${esc(entry.actor)} · ${esc(dateLabel(entry.created_at))}</p><pre>${esc(entry.body)}</pre></article>`).join('') || '<p class="muted">No results or comments yet.</p>';
      if (activity.active_run) $('activity').insertAdjacentHTML('afterbegin', `<p class="notice">Current run started ${esc(dateLabel(activity.active_run.claimed_at))}. Its instructions are preserved in the run history.</p>`);
      const runs = activity.runs ?? [];
      if (runs.length) $('activity').insertAdjacentHTML('beforeend', `<details><summary>Request run history</summary>${runs.map(run => `<details><summary>${esc(label(run.state))} · ${esc(dateLabel(run.claimed_at))}</summary><h4>${esc(run.snapshot?.title)}</h4><pre>${esc(run.snapshot?.body)}</pre></details>`).join('')}</details>`);
      $('recovery').hidden = !activity.active_run && activity.status !== 'in_progress';
      if (activity.version !== context.editing.version || activity.status !== context.editing.status) {
        message('This request has changed. Your unsaved form is preserved; close and reopen it for the latest instructions. Activity and reconciliation use the current request status.');
      }
    } catch (cause) { if (context.editing?.id === id) $('activity').textContent = cause.message; }
    finally { $('refreshActivity').disabled = false; }
  }
  $('commentForm').onsubmit = async event => {
    event.preventDefault();
    if (!context.editing?.id || !requestHistory) return message('Refresh request activity before adding a comment.', true);
    const button = event.submitter; button.disabled = true;
    try {
      await api(requestPath(context.editing.id) + '/comments', { method: 'POST', body: JSON.stringify({ body: $('commentBody').value, expected_version: requestHistory.version }) });
      $('commentForm').reset(); message('Comment added.'); await loadActivity();
    } catch (cause) { message(cause.message, true); if (cause.status === 409) await loadActivity(); }
    finally { button.disabled = false; }
  };
  $('reconcileForm').onsubmit = async event => {
    event.preventDefault();
    if (!context.editing?.id || !requestHistory) return message('Refresh request activity before reconciling it.', true);
    const button = event.submitter; button.disabled = true;
    try {
      await api(requestPath(context.editing.id) + '/reconcile', { method: 'POST', body: JSON.stringify({
        expected_version: requestHistory.version, expected_status: requestHistory.status,
        expected_run_id: requestHistory.active_run?.id ?? null,
        status: $('reconcileStatus').value, note: $('reconcileNote').value
      }) });
      const id = context.editing.id;
      $('reconcileForm').reset(); context.markClean();
      message('Outcome recorded. The request can move forward without automatically repeating the previous work.');
      await loadSection({ item: id });
    } catch (cause) { message(cause.message, true); if (cause.status === 409) await loadActivity(); }
    finally { button.disabled = false; }
  };

  $('refreshActivity').onclick = () => loadActivity();
  return {
    resetEditor() {
      requestHistory = null;
      $('commentForm').reset(); $('reconcileForm').reset(); $('recovery').open = false;
      $('requestActivity').hidden = true;
    },
    editorOpened(record) {
      $('requestActivity').hidden = context.tab !== 'request' || !record?.id || !context.me.owner;
      if (!$('requestActivity').hidden) void loadActivity(record.id);
    },
    editorClosed() { $('commentForm').reset(); $('reconcileForm').reset(); },
    dirty: () => !!$('commentBody').value.trim() || !!$('reconcileNote').value.trim(),
    loadActivity
  };
}
