import {formData, field, redirect} from '../shared/public-http.mjs';
import {programSubmission} from '../modules/share-program/domain.mjs';
import {organizationSubmission} from '../modules/submissions/public.mjs';

// Application workflow: feature-owned form input -> existing private review API.
// acceptSubmission receives a Request and must use the protected intake route.
export async function submitPublicForm(request, env, organizations, acceptSubmission) {
  const form = await formData(request);
  if (field(form, 'website_check')) throw new Error('Submission could not be accepted.');
  const program = new URL(request.url).pathname === '/speaker-submissions';
  const record = program ? programSubmission(form, organizations) : organizationSubmission(form, organizations);
  if (!request.headers.get('CF-Connecting-IP')) throw new Error('Submission could not be verified. Please try again.');
  const headers = new Headers(request.headers);
  headers.delete('Content-Length');
  headers.set('Content-Type', 'application/json');
  const result = await acceptSubmission(new Request(new URL('/api/submissions', request.url), {
    method: 'POST', headers, body: JSON.stringify(record)
  }), env);
  if (!result.ok) throw new Error((await result.json()).error || 'Your submission could not be saved.');
  return redirect((program ? '/share' : '/for-organizations') + '?received=1');
}
