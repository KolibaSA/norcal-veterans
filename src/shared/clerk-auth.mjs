import { createClerkClient } from '@clerk/backend';
import { statement } from './server-storage.mjs';
import { HTTPError } from './server-http.mjs';

export function clerkConfiguration(env) {
  const publishableKey = env.CLERK_PUBLISHABLE_KEY;
  let host;
  try { host = atob(publishableKey.replace(/^pk_(test|live)_/, '')).replace(/\$$/, ''); } catch {}
  if (!/^pk_(test|live)_/.test(publishableKey || '') || !/^[a-z0-9.-]+$/.test(host || '') ||
      !env.CLERK_ALLOWED_ORIGINS || !env.OWNER_EMAIL) throw new Error('AUTH_NOT_CONFIGURED');
  const allowedOrigins = env.CLERK_ALLOWED_ORIGINS.split(',').map(value => value.trim());
  if (allowedOrigins.some(value => { try { return new URL(value).origin !== value; } catch { return true; } })) throw new Error('AUTH_NOT_CONFIGURED');
  return { publishableKey, issuer: 'https://' + host, allowedOrigins };
}

export function clerkClient(env) {
  const { publishableKey } = clerkConfiguration(env);
  if (!env.CLERK_SECRET_KEY) throw new Error('AUTH_NOT_CONFIGURED');
  return createClerkClient({ secretKey: env.CLERK_SECRET_KEY, publishableKey, telemetry: { disabled: true } });
}

// Response headers belong to this request and are forwarded by the HQ adapter.
export class ClerkResponse extends Error {
  constructor(response) { super('CLERK_RESPONSE'); this.response = response; }
}

export function withClerkHeaders(response, authHeaders) {
  if (!authHeaders) return response;
  const headers = new Headers(response.headers);
  for (const [name, value] of authHeaders) if (name !== 'set-cookie') headers.set(name, value);
  for (const value of authHeaders.getSetCookie()) headers.append('Set-Cookie', value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function bindClerkIdentity(env, issuer, subject, account) {
  const primary = account.emailAddresses?.find(email => email.id === account.primaryEmailAddressId);
  if (account.id !== subject || account.banned || account.locked || primary?.verification?.status !== 'verified') throw new HTTPError('A verified primary email is required.', 403);
  const email = primary.emailAddress.toLowerCase();
  const owner = email === env.OWNER_EMAIL.toLowerCase();
  if (!owner && !await statement(env, 'SELECT id FROM grants WHERE email=? LIMIT 1', email).first()) throw new HTTPError('Your account has no headquarters assignment.', 403);
  // Both keys are unique. A recreated Clerk account must never inherit a prior binding.
  await statement(env, `INSERT INTO auth_identities(issuer,subject,email,created_at)
    VALUES(?,?,?,?) ON CONFLICT DO NOTHING`, issuer, subject, email, new Date().toISOString()).run();
  const binding = await statement(env, 'SELECT email FROM auth_identities WHERE issuer=? AND subject=?', issuer, subject).first();
  if (binding?.email !== email) throw new HTTPError('This sign-in does not match the assigned account. Contact the platform owner.', 403);
  return { id: subject, email, owner, provider: 'clerk' };
}

export async function verifyClerkIdentity(request, env, responseContext) {
  const { issuer, allowedOrigins } = clerkConfiguration(env);
  if (!allowedOrigins.includes(new URL(request.url).origin)) throw new Error('UNAUTHORIZED');
  const client = clerkClient(env);
  const state = await client.authenticateRequest(request, {
    authorizedParties: allowedOrigins, acceptsToken: 'session_token',
    signInUrl: new URL('/hq/sign-in', request.url).href,
    signUpUrl: new URL('/hq/sign-up', request.url).href
  });
  responseContext.headers = state.headers;
  if (state.status === 'handshake') {
    if (!state.headers.get('Location')) throw new Error('UNAUTHORIZED');
    throw new ClerkResponse(new Response(null, { status: 307 }));
  }
  const auth = state.toAuth();
  if (!auth?.userId || auth.sessionClaims?.iss !== issuer || auth.actor) throw new Error('UNAUTHORIZED');
  // Checking the live session also honors Clerk revocation before a cached JWT expires.
  const [session, account] = await Promise.all([client.sessions.getSession(auth.sessionId), client.users.getUser(auth.userId)]);
  if (session.status !== 'active' || session.userId !== auth.userId) throw new Error('UNAUTHORIZED');
  return bindClerkIdentity(env, issuer, auth.userId, account);
}
