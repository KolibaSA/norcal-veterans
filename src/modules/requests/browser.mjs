import { createRecordFeature } from '../../shared/browser-records.mjs';
import { connectActivity } from './activity.mjs';
import { connectHealth } from './health.mjs';
export { healthDescription } from './health.mjs';

export function canEditRequest(me, record) { return !!me?.owner && record.status !== 'in_progress'; }
export function createFeature() {
  return createRecordFeature({ kind: 'request', title: 'Requests', editorLabel: 'request',
    statuses: ['queued', 'in_progress', 'needs_input', 'completed', 'cancelled', 'closed'],
    heading: 'What would you like to work on?', newLabel: 'New request',
    canCreate: me => !!me.owner, canEdit: canEditRequest,
    allowStatus: (status, record) => status !== 'in_progress' || record.status === 'in_progress',
    saveLabel: record => record.status === 'queued' ? 'Save and queue request' : 'Save item',
    savedMessage: record => record.status === 'queued' ? 'Request saved and queued.' : 'Saved.',
    notice: (_me, record, editable) => !editable
      ? record.status === 'in_progress' ? 'The agent is processing these instructions. Add a comment below, or reconcile the run before changing the instructions.'
        : 'Executable requests are managed by the platform owner.'
      : 'Saving this request as queued authorizes the agent to process these instructions. Comments and results appear separately below.',
    connect: connectRequests
  });
}

export function connectRequests(context) {
  return { ...connectActivity(context), ...connectHealth(context) };
}
