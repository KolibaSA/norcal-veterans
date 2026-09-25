import test from 'node:test';
import assert from 'node:assert/strict';
import { db, token, envBase } from '../../scripts/legacy-test-helpers.mjs';
import worker from '../norcal-worker.mjs';
import { bindClerkIdentity, verifyClerkIdentity, withClerkHeaders } from './clerk-auth.mjs';

const issuer = 'https://norcal-fixture.clerk.accounts.dev';
function account(id, email, verified = true) {
  return { id, primaryEmailAddressId: 'primary', emailAddresses: [{ id: 'primary', emailAddress: email, verification: { status: verified ? 'verified' : 'unverified' } }] };
}

test('Clerk binding requires assigned verified primary email and prevents account replacement', async t => {
  const env = { ...envBase, DB: db(t) };
  const owner = account('user_owner', env.OWNER_EMAIL);
  assert.equal((await bindClerkIdentity(env, issuer, owner.id, owner)).owner, true);
  assert.equal((await bindClerkIdentity(env, issuer, owner.id, owner)).id, owner.id);
  await assert.rejects(() => bindClerkIdentity(env, issuer, 'user_replacement', account('user_replacement', env.OWNER_EMAIL)), /does not match/);
  await assert.rejects(() => bindClerkIdentity(env, issuer, 'user_unverified', account('user_unverified', env.OWNER_EMAIL, false)), /verified primary/);
  await assert.rejects(() => bindClerkIdentity(env, issuer, 'user_unassigned', account('user_unassigned', 'unassigned@example.com')), /no headquarters assignment/);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM auth_identities').get().n, 1);
});

test('Clerk SDK authentication protects HQ, honors revocation and keeps organization writes scoped', async t => {
  const env = { ...envBase, DB: db(t), HQ_AUTH_PROVIDER: 'clerk', CLERK_PUBLISHABLE_KEY: 'pk_test_' + Buffer.from('norcal-fixture.clerk.accounts.dev$').toString('base64'), CLERK_SECRET_KEY: 'sk_test_fixture', CLERK_ALLOWED_ORIGINS: 'https://site.test' };
  const previousFetch = globalThis.fetch;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  const jwks = await (await previousFetch('https://test-team.cloudflareaccess.com/cdn-cgi/access/certs')).json();
  let revoked = false, invitationCount = 0;
  globalThis.fetch = async (input, options) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (url.pathname === '/v1/jwks') return Response.json(jwks);
    if (url.pathname.startsWith('/v1/sessions/')) {
      const id = url.pathname.split('/').at(-1);
      return Response.json({ object: 'session', id, user_id: id.replace('sess_', 'user_'), status: revoked ? 'revoked' : 'active' });
    }
    if (url.pathname === '/v1/users') return Response.json({ data: [], total_count: 0 });
    if (url.pathname === '/v1/invitations') {
      if ((options?.method || input.method) === 'POST') { invitationCount++; return Response.json({ object: 'invitation', id: 'inv_fixture', email_address: 'org@example.com', status: 'pending' }); }
      return Response.json({ data: [], total_count: 0 });
    }
    if (url.pathname.startsWith('/v1/users/')) {
      const id = url.pathname.split('/').at(-1), email = id === 'user_owner' ? env.OWNER_EMAIL : 'org@example.com';
      return Response.json({ object: 'user', id, primary_email_address_id: 'primary', email_addresses: [{ id: 'primary', email_address: email, verification: { status: 'verified' }, linked_to: [] }] });
    }
    throw new Error('Unexpected authentication request: ' + url.pathname);
  };
  try {
    async function request(path, who = 'owner', method = 'GET', body, claims = {}, origin = 'https://site.test') {
      const jwt = await token('unused@example.com', { iss: issuer, sub: 'user_' + who, sid: 'sess_' + who, azp: 'https://site.test', aud: undefined, v: 2, sts: 'active', ...claims });
      return worker.fetch(new Request('https://site.test' + path, { method, headers: { Authorization: 'Bearer ' + jwt, Origin: origin, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }), env);
    }
    assert.equal((await worker.fetch(new Request('https://site.test/api/hq/me'), env)).status, 401);
    assert.equal((await worker.fetch(new Request('https://site.test/hq'), env)).status, 302);
    assert.equal((await worker.fetch(new Request('https://site.test/hq/sign-in'), env)).status, 200);
    const config = await (await worker.fetch(new Request('https://site.test/api/auth/config'), env)).json();
    assert.deepEqual(Object.keys(config).sort(), ['frontendAPI', 'provider', 'publishableKey']);
    for (const claims of [{ exp: 1 }, { iss: 'https://attacker.example.com' }, { azp: 'https://attacker.example.com' }, { sts: 'pending' }, { act: { sub: 'impersonator' } }]) {
      assert.equal((await request('/api/hq/me', 'owner', 'GET', undefined, claims)).status, 401);
    }
    const ownerToken = await token('unused@example.com', { iss: issuer, sub: 'user_owner', sid: 'sess_owner', azp: 'https://site.test', aud: undefined, v: 2, sts: 'active' });
    assert.equal((await verifyClerkIdentity(new Request('https://site.test/api/hq/me', { headers: { Authorization: 'Bearer ' + ownerToken } }), env, {})).owner, true);
    let response = await request('/api/hq/me');
    assert.equal(response.status, 200);
    assert.equal((await response.json()).owner, true);
    const organization = { kind: 'organization', title: 'Clerk test organization', region_id: 'test-region', status: 'draft', payload: { city: 'Davis' } };
    response = await request('/api/hq/records', 'owner', 'POST', organization);
    assert.equal(response.status, 201);
    const { id } = await response.json();
    response = await request('/api/hq/access', 'owner', 'POST', { email: 'org@example.com', role: 'organization_admin', organization_id: id });
    assert.equal(response.status, 201);
    const grant = await response.json();
    response = await request('/api/hq/records/' + id, 'org');
    const saved = await response.json();
    assert.equal(response.status, 200);
    assert.equal((await request('/api/hq/records/' + id, 'org', 'PUT', { ...saved, title: 'Updated through Clerk' })).status, 200);
    assert.equal((await (await request('/api/hq/records/' + id, 'org')).json()).title, 'Updated through Clerk');
    const other = await (await request('/api/hq/records', 'owner', 'POST', { ...organization, title: 'Other organization' })).json();
    assert.equal((await request('/api/hq/records/' + other.id, 'org')).status, 404);
    assert.equal((await request('/api/hq/access/' + grant.id + '/invite', 'org', 'POST', {})).status, 403);
    assert.equal((await request('/api/hq/access/' + grant.id + '/invite', 'owner', 'POST', {}, {}, 'https://attacker.example.com')).status, 403);
    assert.equal((await request('/api/hq/access/' + grant.id + '/invite', 'owner', 'POST', {})).status, 200);
    assert.equal(invitationCount, 1);
    revoked = true;
    assert.equal((await request('/api/hq/me', 'org')).status, 401);
    revoked = false;
    assert.equal((await request('/api/hq/access/' + grant.id, 'owner', 'DELETE')).status, 200);
    assert.equal((await request('/api/hq/me', 'org')).status, 403);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test('Clerk response forwarding preserves handshake status, destination and every cookie', () => {
  const headers = new Headers({ Location: 'https://clerk.example.com/handshake' });
  headers.append('Set-Cookie', 'first=1; Secure; HttpOnly');
  headers.append('Set-Cookie', 'second=2; Secure; HttpOnly');
  const response = withClerkHeaders(new Response(null, { status: 307 }), headers);
  assert.equal(response.status, 307);
  assert.equal(response.headers.get('Location'), 'https://clerk.example.com/handshake');
  assert.equal(response.headers.getSetCookie().length, 2);
});
