import { clerkConfiguration } from './clerk-auth.mjs';
import { json } from './server-http.mjs';

export function clerkCSP(env, scriptHash = '') {
  const { issuer } = clerkConfiguration(env);
  return `default-src 'self'; script-src 'self' ${scriptHash ? "'" + scriptHash + "' " : ''}${issuer} https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://img.clerk.com ${issuer}; connect-src 'self' ${issuer}; worker-src 'self' blob:; frame-src ${issuer} https://challenges.cloudflare.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self' ${issuer}`;
}

export function clerkPublicRoute(request, env) {
  const path = new URL(request.url).pathname;
  if (!['GET', 'HEAD'].includes(request.method)) return null;
  if (path === '/api/auth/config') {
    if (env.HQ_AUTH_PROVIDER !== 'clerk') return json({ provider: 'access' });
    const { publishableKey, issuer } = clerkConfiguration(env);
    return json({ provider: 'clerk', publishableKey, frontendAPI: issuer });
  }
  if (env.HQ_AUTH_PROVIDER !== 'clerk' || !/^\/hq\/(sign-in|sign-up|sign-out)(?:\/|$)/.test(path)) return null;
  const title = path.startsWith('/hq/sign-up') ? 'Accept your invitation' : path.startsWith('/hq/sign-out') ? 'Signing out' : 'Organization sign-in';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${title} | NorCalVeterans</title><style>body{margin:0;background:#f3f6fa;color:#142f55;font:16px/1.5 system-ui,sans-serif}main{max-width:440px;margin:8vh auto;padding:24px}h1{font-size:1.7rem}a{color:#174b85}#auth-message{margin:20px 0}#auth-message:empty{display:none}</style><script type="module" src="/assets/hq-auth.js"></script></head><body><main><strong>NORCALVETERANS</strong><h1>${title}</h1><p>Manage your organization's information and events.</p><div id="clerk-auth"></div><p id="auth-message" role="status">Loading secure sign-in…</p><p><a href="/">Return to the public website</a></p></main></body></html>`;
  return new Response(request.method === 'HEAD' ? null : html, { headers: {
    'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'private, no-store',
    'Content-Security-Policy': clerkCSP(env), 'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow'
  } });
}
