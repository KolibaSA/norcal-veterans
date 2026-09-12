import { esc, label, dateLabel } from '../../shared/browser-ui.mjs';

export function connectAttachments(context) {
  const { $, api, message } = context;
  async function loadFiles(id) {
    try {
      const files = await api('attachments?record_id=' + encodeURIComponent(id));
      if (context.editing?.id !== id) return;
      $('files').innerHTML = files.map(file => `<a href="/api/hq/attachments/${encodeURIComponent(file.id)}">${esc(file.filename)} · ${Math.ceil(file.size / 1024)} KB</a>`).join('') || '<p class="small muted">No attachments.</p>';
    } catch (cause) { if (context.editing?.id === id) $('files').textContent = cause.message; }
  }

  $('fileForm').onsubmit = async event => {
    event.preventDefault();
    const file = $('file').files[0];
    if (!file || file.size > 10 * 1024 * 1024) return message('Choose a file smaller than 10 MB.', true);
    const button = event.submitter; button.disabled = true;
    try {
      const data = new FormData(); data.append('record_id', context.editing.id); data.append('file', file);
      await api('attachments', { method: 'POST', body: data });
      message('Attachment uploaded.'); $('file').value = ''; await loadFiles(context.editing.id);
    } catch (cause) { message(cause.message, true); }
    finally { button.disabled = false; }
  };

  return { editorOpened(record, { editable }) {
    $('attachmentSection').hidden = !record?.id;
    $('fileForm').hidden = !context.me.uploads || !editable;
    $('storageNote').hidden = !!context.me.uploads;
    if (record?.id) void loadFiles(record.id);
  } };
}
