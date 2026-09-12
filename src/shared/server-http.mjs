export class HTTPError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export function json(value, status = 200, extraHeaders = {}) {
  return Response.json(value, { status, headers: {
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', ...extraHeaders
  } });
}

// Check bytes while reading, including bodies without a trustworthy Content-Length.
export async function readJson(request, maxBytes = 100000) {
  const announced = request.headers.get('Content-Length');
  if (announced && Number(announced) > maxBytes) {
    await request.body?.cancel();
    throw new HTTPError('Request is too large.', 413);
  }
  if (!request.body) throw new HTTPError('A JSON request body is required.');
  const reader = request.body.getReader(), chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new HTTPError('Request is too large.', 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let value;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new HTTPError('Invalid JSON request.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HTTPError('A JSON object is required.');
  return value;
}

export function field(value, name, limit, required = false) {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string' || value.includes('\0') || value.length > limit) {
    throw new HTTPError(`${name} must be text of at most ${limit} characters.`);
  }
  const text = value.trim();
  if (required && !text) throw new HTTPError(`${name} is required.`);
  return text;
}

export function logFailure(requestId, operation, status = 500) {
  // Never log URLs, request bodies, raw database errors, identities or credentials.
  console.error(JSON.stringify({ event: 'hq_request_failed', request_id: requestId, operation, status }));
}
