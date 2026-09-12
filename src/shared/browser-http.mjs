// Transport only: feature API paths, payloads and rules belong to their modules.
export async function hqAPI(path, options = {}) {
  const formData = options.body instanceof FormData;
  const response = await fetch('/api/hq/' + path, {
    ...options, headers: { ...(formData ? {} : { 'Content-Type': 'application/json' }), ...options.headers }
  });
  let data;
  try { data = await response.json(); } catch { throw new Error('The server did not return a valid response. Check your sign-in and try again.'); }
  if (!response.ok) {
    const cause = new Error(data.error || 'Unable to complete this request.');
    cause.status = response.status;
    throw cause;
  }
  return data;
}
