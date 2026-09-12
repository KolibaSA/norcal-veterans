import { esc, label, dateLabel } from '../../shared/browser-ui.mjs';
import { createRecordFeature } from '../../shared/browser-records.mjs';
export function submissionDraft(submission, kind) {
  if (!['event', 'organization'].includes(kind)) throw new Error('Choose an event or organization draft.');
  return {
    kind, title: submission.title, body: submission.payload?.public_description ?? '', status: 'draft',
    region_id: submission.region_id, organization_id: kind === 'event' ? submission.organization_id : null,
    payload: { intake_submission_id: submission.id, review_notes: 'Draft prepared from public submission: ' + submission.title }
  };
}


export function createFeature() {
  return createRecordFeature({ kind: 'submission', title: 'Public submissions', editorLabel: 'public submission',
    statuses: ['pending', 'reviewed', 'rejected'], connect: connectSubmissions });
}
export function connectSubmissions(context) {
  const { $, permitLeave, message } = context;
  async function prepareDraft(kind) {
    if (!context.editing || !permitLeave()) return;
    const submission = context.editing, draft = submissionDraft(submission, kind);
    await context.openDraft(kind, draft, submission);
    message('Draft prepared. Review the source and add a public description before saving.');
  }
  $('draftEvent').onclick = () => prepareDraft('event');
  $('draftOrganization').onclick = () => prepareDraft('organization');

  return {
    resetEditor() { $('submissionActions').hidden = true; },
    editorOpened(record, { source }) {
      $('submissionActions').hidden = context.tab !== 'submission' || !record?.id;
      $('submissionSource').hidden = !source;
      $('submissionSource').innerHTML = source ? '<h3>Original submission: ' + esc(source.title) + '</h3><p class="preserve">' + esc(source.body) + '</p><p class="small">This original text remains private. Write and verify the public description before publishing.</p>' : '';
    }
  };
}
