import { createRegistry, itemURL } from './hq-registry.mjs';
import { startBrowserRuntime } from '../shared/browser-runtime.mjs';
import { hqAPI } from '../shared/browser-http.mjs';
import { loadScopeOptions } from '../modules/organizations/browser.mjs';
import { connectAttachments } from '../modules/attachments/browser.mjs';

export function startHeadquarters() {
  return startBrowserRuntime({
    registry: createRegistry(), defaultTab: 'request', api: hqAPI, itemURL,
    initializeOptions: ({ api, $ }) => loadScopeOptions(api, $('org')),
    extensions: [connectAttachments]
  });
}
