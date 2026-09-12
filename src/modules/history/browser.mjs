import { esc, label, dateLabel } from '../../shared/browser-ui.mjs';
import { recordPath } from '../../shared/browser-ui.mjs';

export function createFeature() { return { kind: 'audit', title: 'Change history', connect: connectHistory }; }
export function connectHistory(context) {
  const { $, api } = context;
  async function loadRevisions(id) {
    try {
      const revisions = await api(recordPath(id) + '/history');
      if (context.editing?.id !== id) return;
      $('revisions').innerHTML = revisions.map(revision => `<details><summary>${esc(dateLabel(revision.created_at))} · ${esc(revision.actor)} · revision ${esc(revision.version)}</summary><h4>${esc(revision.record?.title)}</h4><p>Status: ${esc(label(revision.record?.status))}</p><pre>${esc(revision.record?.body)}</pre><details><summary>Other saved fields</summary><pre>${esc(JSON.stringify(revision.record?.payload ?? {}, null, 2))}</pre></details></details>`).join('') || '<p>No saved revisions are available yet. New saves will appear here.</p>';
    } catch (cause) { if (context.editing?.id === id) $('revisions').textContent = cause.message; }
  }

  return {
    async render({ isCurrent }) {
        const entries = await api('audit');
        if (!isCurrent()) return;
        $('content').innerHTML = `<div class="panel audit"><table><caption>Most recent headquarters changes</caption><thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">Action</th><th scope="col">Item</th></tr></thead><tbody>${entries.map(entry => `<tr><td>${esc(dateLabel(entry.created_at))}</td><td>${esc(entry.actor)}</td><td>${esc(label(entry.action))}</td><td>${esc(entry.record_id)}</td></tr>`).join('')}</tbody></table></div>`;

    },
    editorOpened(record) {
      $('revisionSection').hidden = !record?.id;
      $('revisions').textContent = 'Loading revision history…';
      if (record?.id) void loadRevisions(record.id);
    }
  };
}
