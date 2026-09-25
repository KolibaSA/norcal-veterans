// Stable CLI and export surface. Requests owns policy; the Node adapter owns local state and transport.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
export * from '../src/modules/requests/node.mjs';

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.stderr.write('The NorCal request agent has been retired. Use HQ Requests for manual tracking and history.\n');
  process.exitCode = 1;
}
