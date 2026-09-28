import { isPlatformAdmin } from '../../shared/permissions.mjs';
import { HTTPError, json, readJson } from '../../shared/server-http.mjs';
import { rows, statement } from '../../shared/server-storage.mjs';

const path = '/api/hq/event-invitations';
const idPattern = /^[-_a-zA-Z0-9]{1,120}$/;
const validId = value => typeof value === 'string' && idPattern.test(value);
const fail = (message, status = 400) => json({ error: message }, status);
const directRepresentative = (user, grants, organizationId) => grants.some(grant =>
  grant.email === user.email && grant.organization_id === organizationId &&
  ['organization_admin', 'editor'].includes(grant.role));
const canHost = (user, grants, event) => !!(event.organization_id || event.host_org_id) &&
  (isPlatformAdmin(user) || directRepresentative(user, grants, event.organization_id || event.host_org_id));
const canRespond = (user, grants, organizationId) => isPlatformAdmin(user) || directRepresentative(user, grants, organizationId);

async function eventRow(env, id) {
  if (!validId(id)) return null;
  return statement(env, "SELECT id,title,region_id,organization_id,status FROM records WHERE id=? AND kind='event'", id).first();
}
async function invitationRows(env, eventId = null) {
  const filter = eventId ? 'WHERE i.event_id=?' : '';
  return rows(env, `SELECT i.*,e.title AS event_title,e.region_id,e.organization_id AS host_org_id,e.status AS event_status,
      host.title AS host_name,recipient.title AS recipient_name
    FROM organization_event_invitations i
    JOIN records e ON e.id=i.event_id AND e.kind='event'
    LEFT JOIN records host ON host.id=e.organization_id AND host.kind='organization'
    JOIN records recipient ON recipient.id=i.recipient_org_id AND recipient.kind='organization'
    ${filter} ORDER BY i.updated_at DESC,i.id DESC`, ...(eventId ? [eventId] : []));
}
function visibleTo(user, grants, row) {
  return canHost(user, grants, row) || canRespond(user, grants, row.recipient_org_id);
}
function view(row) {
  return { id: row.id, event_id: row.event_id, event_title: row.event_title,
    event_status: row.event_status, host_org_id: row.host_org_id, host_name: row.host_name,
    recipient_org_id: row.recipient_org_id, recipient_name: row.recipient_name,
    status: row.status, version: row.version, updated_at: row.updated_at,
    decision_by: row.decision_by, decision_at: row.decision_at, decision_note: row.decision_note };
}
async function listInvitations(env, user, grants, eventId) {
  const event = eventId ? await eventRow(env, eventId) : null;
  if (eventId && !event) return fail('Event unavailable.', 404);
  const matches = (await invitationRows(env, eventId)).filter(row => visibleTo(user, grants, row));
  const hostAllowed = event && canHost(user, grants, event);
  if (event && !hostAllowed && !matches.length) return fail('Event unavailable.', 404);
  const organizations = hostAllowed ? await rows(env,
    "SELECT id,title FROM records WHERE kind='organization' AND status='published' AND region_id=? AND id<>? ORDER BY title",
    event.region_id, event.organization_id) : [];
  return json({ event: event && { id: event.id, title: event.title, status: event.status,
    organization_id: event.organization_id }, can_invite: !!hostAllowed && event.status !== 'archived',
    organizations, invitations: matches.map(row => ({ ...view(row), can_respond: canRespond(user, grants, row.recipient_org_id),
      requires_note: isPlatformAdmin(user) && !directRepresentative(user, grants, row.recipient_org_id),
      can_withdraw: canHost(user, grants, row) })) });
}
function checkVersion(value) {
  if (!Number.isInteger(value) || value < 1) throw new HTTPError('Reload the invitation before changing it.', 409);
}
async function mutate(env, user, sql, values, eventId, action, mutation) {
  const now = new Date().toISOString();
  const change = statement(env, sql, ...values);
  const audit = statement(env, `INSERT INTO audit(id,actor,action,record_id,created_at)
    SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM organization_event_invitations WHERE event_id=? AND mutation_id=?)`,
  crypto.randomUUID(), user.email, action, eventId, now, eventId, mutation);
  const result = await env.DB.batch([change, audit]);
  return result[0].meta.changes === 1;
}
async function changeInvitation(env, user, grants, input) {
  const event = await eventRow(env, input.event_id);
  if (!event) return fail('Event unavailable.', 404);
  if (event.status === 'archived') return fail('Archived events cannot manage invitations.', 409);
  const orgId = input.recipient_org_id;
  if (!validId(orgId) || orgId === event.organization_id) return fail('Choose another listed organization.');
  const recipient = await statement(env,
    "SELECT id,title,region_id,status FROM records WHERE id=? AND kind='organization'", orgId).first();
  if (!recipient || recipient.status !== 'published' || recipient.region_id !== event.region_id)
    return fail('Choose a listed organization in this event’s region.');
  const existing = await statement(env,
    'SELECT * FROM organization_event_invitations WHERE event_id=? AND recipient_org_id=?', event.id, orgId).first();
  const now = new Date().toISOString(), mutation = crypto.randomUUID();
  if (input.action === 'invite') {
    if (!canHost(user, grants, event)) return fail('Only an event host representative can invite organizations.', 403);
    if (existing && !['declined','withdrawn'].includes(existing.status)) return fail('This organization already has an active invitation.', 409);
    const id = existing?.id || crypto.randomUUID();
    const sql = `INSERT INTO organization_event_invitations
      (id,event_id,recipient_org_id,status,created_by,created_at,updated_at,mutation_id)
      VALUES(?,?,?,'pending',?,?,?,?)
      ON CONFLICT(event_id,recipient_org_id) DO UPDATE SET status='pending',updated_at=excluded.updated_at,
        decision_by=NULL,decision_at=NULL,decision_note=NULL,version=version+1,mutation_id=excluded.mutation_id
      WHERE status IN ('declined','withdrawn')`;
    const done = await mutate(env, user, sql, [id,event.id,orgId,user.email,now,now,mutation], event.id, `event_invite:${orgId}`, mutation);
    return done ? json({ invited: true, event_id: event.id, recipient_org_id: orgId }) : fail('This invitation changed. Reload and try again.', 409);
  }
  if (!existing) return fail('Invitation unavailable.', 404);
  checkVersion(input.version);
  let next, note = '';
  if (input.action === 'withdraw') {
    if (!canHost(user, grants, event)) return fail('Only an event host representative can withdraw invitations.', 403);
    if (existing.status === 'withdrawn') return fail('This invitation is already withdrawn.', 409);
    next = 'withdrawn';
  } else if (input.action === 'respond' && ['accepted','declined'].includes(input.response)) {
    if (!canRespond(user, grants, orgId)) return fail('Only this organization can respond to its invitation.', 403);
    if (existing.status === 'withdrawn') return fail('This invitation has been withdrawn.', 409);
    next = input.response;
    if (isPlatformAdmin(user) && !directRepresentative(user, grants, orgId)) {
      if (typeof input.note !== 'string' || !input.note.trim() || input.note.length > 1000)
        return fail('Record how the organization confirmed its response.');
      note = input.note.trim();
    }
  } else return fail('Choose a valid invitation action.');
  const sql = `UPDATE organization_event_invitations SET status=?,updated_at=?,decision_by=?,decision_at=?,decision_note=?,
    version=version+1,mutation_id=? WHERE id=? AND version=? AND status<>'withdrawn'`;
  const done = await mutate(env, user, sql,
    [next,now,user.email,now,note,mutation,existing.id,input.version], event.id,
    `event_${next}:${orgId}${note ? ':offline' : ''}`, mutation);
  return done ? json({ event_id: event.id, recipient_org_id: orgId, status: next }) : fail('This invitation changed. Reload and try again.', 409);
}

export async function handleInvitationRoute(req, env, user, grants, url = new URL(req.url)) {
  if (url.pathname !== path) return null;
  if (req.method === 'GET') return listInvitations(env, user, grants, url.searchParams.get('event_id'));
  if (req.method === 'POST') return changeInvitation(env, user, grants, await readJson(req, 5000));
  return fail('Method not allowed.', 405);
}
