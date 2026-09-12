import { esc, label, dateLabel } from '../../shared/browser-ui.mjs';

export function createFeature() { return { kind: 'access', title: 'Organization & region access', connect: connectAccess }; }
export function connectAccess(context) {
  const { $, api, message, loadSection } = context;
  async function renderAccess({ isCurrent }) {
    if (!context.me.owner) throw new Error('Only the platform owner manages access.');
    const grants = await api('access');
    if (!isCurrent()) return;
    $('content').innerHTML = `<div class="notice">Assignments control access within this headquarters. People must also be allowed through Cloudflare Access. Revocation here takes effect on their next request.</div><form id="grant" class="panel"><h2>Assign an administrator or editor</h2><label for="email">Email</label><input id="email" type="email" required><label for="role">Role</label><select id="role"><option value="region_admin">Region administrator</option><option value="organization_admin">Organization administrator</option><option value="editor">Editor</option></select><label for="scopeType">Scope</label><select id="scopeType"><option value="region">Region</option><option value="organization">Organization</option></select><label for="scopeValue">Region slug or organization ID</label><input id="scopeValue" required value="yolo-solano"><p class="small muted">Organization IDs appear in each organization profile's scope.</p><button type="submit">Save assignment</button></form><div class="panel">${grants.map(grant => `<div class="record"><div><b>${esc(grant.email)}</b><p>${esc(label(grant.role))} · ${esc(grant.region_id || grant.organization_id)}</p></div><button type="button" class="secondary" data-revoke="${esc(grant.id)}" aria-label="Revoke ${esc(grant.email)} assignment">Revoke</button></div>`).join('')}</div>`;
    $('grant').onsubmit = async event => {
      event.preventDefault();
      const button = event.submitter; button.disabled = true;
      try {
        const value = { email: $('email').value, role: $('role').value };
        value[$('scopeType').value === 'region' ? 'region_id' : 'organization_id'] = $('scopeValue').value;
        await api('access', { method: 'POST', body: JSON.stringify(value) });
        message('Assignment saved.'); await loadSection();
      } catch (cause) { message(cause.message, true); }
      finally { button.disabled = false; }
    };
    $('content').querySelectorAll('[data-revoke]').forEach(button => {
      button.onclick = async () => {
        if (!window.confirm('Revoke this assignment? The person will lose this scope on their next request.')) return;
        button.disabled = true;
        try { await api('access/' + encodeURIComponent(button.dataset.revoke), { method: 'DELETE' }); message('Assignment revoked.'); await loadSection(); }
        catch (cause) { message(cause.message, true); button.disabled = false; }
      };
    });
  }

  return { render: renderAccess };
}
