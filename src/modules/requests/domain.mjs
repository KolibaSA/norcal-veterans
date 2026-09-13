import { isPlatformAdmin } from '../../shared/permissions.mjs';
import { validatePayload } from '../../shared/record-validation.mjs';
import { HTTPError } from '../../shared/server-http.mjs';
import { statement } from '../../shared/server-storage.mjs';

// Supported security interfaces for every record envelope: execution credentials
// must stay server-owned even when an editor places them on another record kind.
export function stripEditorCredentials(payload) {
  delete payload.request_approval;
  delete payload.norcal_hq_agent;
  return payload;
}

export function redactPayload(payload) {
  if (payload.norcal_hq_agent) delete payload.norcal_hq_agent.claim_token;
  delete payload.request_approval;
  return payload;
}

export function authorizeSave({ user }) {
  if (!isPlatformAdmin(user)) throw new HTTPError('Only the platform owner or a Super Admin can approve or change executable requests.', 403);
}

export async function beforeSave({ env, existing, status, id }) {
  const active = existing && await statement(env, "SELECT id FROM request_runs WHERE request_id=? AND state='in_progress'", id).first();
  if (status === 'in_progress' || existing?.status === 'in_progress' || active) {
    throw new HTTPError('In-progress instructions are locked. Add a comment or use Resolve stalled request after checking the work.', 409);
  }
}

export function authorizePayload(payload, { previous, status, version, user }) {
  if (previous?.norcal_hq_agent) payload.norcal_hq_agent = previous.norcal_hq_agent;
  if (status === 'queued') payload.request_approval = { approved_by: user.email, approved_version: version };
  return payload;
}

export const recordDefinition = Object.freeze({
  kind: 'request', statuses: ['queued', 'in_progress', 'needs_input', 'completed', 'closed', 'cancelled'],
  validate: validatePayload, authorizeSave, beforeSave, authorizePayload,
  // Recheck within the atomic write: a racing claim must preserve its snapshot.
  updateGuard: " AND status<>'in_progress' AND NOT EXISTS(SELECT 1 FROM request_runs WHERE request_id=records.id AND state='in_progress')"
});
