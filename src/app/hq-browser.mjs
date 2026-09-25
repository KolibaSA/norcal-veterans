import { createRegistry, itemURL } from './hq-registry.mjs';
import { startBrowserRuntime } from '../shared/browser-runtime.mjs';
import { hqAPI } from '../shared/browser-http.mjs';
import { loadScopeOptions } from '../modules/organizations/browser.mjs';
import { connectAttachments } from '../modules/attachments/browser.mjs';
import { loadClerk } from '../shared/clerk-browser.mjs';

export async function startHeadquarters() {
  if (document.body.dataset.authProvider === 'clerk') {
    try { await loadClerk(); }
    catch (error) { document.getElementById('identity').textContent = error.message; return; }
  }
  return startBrowserRuntime({
    registry: createRegistry(), defaultTab: 'request', api: hqAPI, itemURL,
    initializeOptions: ({ api, $ }) => loadScopeOptions(api, $('org')),
    extensions: [connectAttachments]
  });
}
