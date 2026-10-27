// Cache only anonymous public output. Each dynamic hit checks the primary D1
// revision, so invalidation does not depend on per-data-center cache deletion.
export const PUBLIC_CACHE_SECONDS = 30;
const staticPaths = new Set(['/regions', '/privacy', '/resources', '/about', '/memorial-day']);
const dynamicPaths = new Set(['/yolo-solano', '/events', '/events.ics', '/data.json', '/sitemap.xml']);
const dynamicDetail = /^\/(organizations|events|locations)\/[-_a-zA-Z0-9]{1,120}$/;

function pageKind(path) {
  if (staticPaths.has(path)) return 'static';
  if (dynamicPaths.has(path) || dynamicDetail.test(path)) return 'dynamic';
  return null;
}

function clientResponse(response, state, head) {
  const headers = new Headers(response.headers);
  // Browsers and intermediate caches must return to the Worker for the revision
  // check. Only the explicitly stored edge copy has a positive lifetime.
  if (!/private|no-store/i.test(headers.get('Cache-Control') || '')) {
    headers.set('Cache-Control', 'no-cache, max-age=0, must-revalidate');
  }
  headers.set('X-NorCal-Cache', state);
  headers.delete('X-NorCal-Cache-Expires');
  return new Response(head ? null : response.body, { status: response.status, headers });
}

export async function cachedPublicResponse(request, env, ctx, render, { cache = globalThis.caches?.default, now = Date.now } = {}) {
  const url = new URL(request.url), kind = pageKind(url.pathname);
  if (!kind || !['GET', 'HEAD'].includes(request.method)) return render();
  const head = request.method === 'HEAD';
  const fresh = async () => clientResponse(await render(), 'BYPASS', head);
  if (!cache || !env.CF_VERSION_METADATA?.id || env.PUBLIC_CACHE_DISABLED === 'true' ||
      ['Authorization', 'Cookie', 'Range', 'Cf-Access-Jwt-Assertion'].some(header => request.headers.has(header)) ||
      /no-cache|no-store|max-age\s*=\s*0/i.test(request.headers.get('Cache-Control') || '') ||
      /no-cache/i.test(request.headers.get('Pragma') || '')) return fresh();

  const started = now();
  let key;
  try {
    const revision = kind === 'dynamic'
      ? (await env.DB.prepare('SELECT revision FROM public_cache_state WHERE id=1').first())?.revision
      : 0;
    if (!Number.isSafeInteger(revision) || revision < 0) return fresh();
    url.hash = '';
    // Preserve every query parameter, including future region/page filters and
    // repeated values. Sorting names improves reuse without merging variants.
    url.searchParams.sort();
    url.pathname = '/__public-cache/v1/' + encodeURIComponent(env.CF_VERSION_METADATA.id) + '/' + revision + url.pathname;
    key = new Request(url.href);
    const hit = await cache.match(key);
    if (hit && Number(hit.headers.get('X-NorCal-Cache-Expires')) > now()) return clientResponse(hit, 'HIT', head);
  } catch {
    console.warn(JSON.stringify({ event: 'public_cache_unavailable', operation: 'lookup' }));
    return fresh();
  }

  const response = await render();
  // HEAD may reuse GET, but must never poison its entry with an empty body.
  const cacheable = !head && response.status === 200 && !response.headers.has('Set-Cookie') &&
    !response.headers.has('Vary') && !/private|no-store/i.test(response.headers.get('Cache-Control') || '');
  const remaining = Math.floor((started + PUBLIC_CACHE_SECONDS * 1000 - now()) / 1000);
  if (cacheable && remaining > 0) {
    const copy = response.clone(), headers = new Headers(copy.headers);
    headers.set('Cache-Control', 'public, max-age=' + remaining);
    headers.set('X-NorCal-Cache-Expires', String(started + PUBLIC_CACHE_SECONDS * 1000));
    const save = (async () => {
      try { await cache.put(key, new Response(copy.body, { status: copy.status, headers })); }
      catch { console.warn(JSON.stringify({ event: 'public_cache_unavailable', operation: 'store' })); }
    })();
    if (ctx?.waitUntil) ctx.waitUntil(save);
    else await save;
  }
  return clientResponse(response, cacheable ? 'MISS' : 'BYPASS', head);
}
