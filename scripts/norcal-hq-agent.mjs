// Stable CLI and export surface. Requests owns policy; the Node adapter owns local state and transport.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { HELP, parseArgs, runOperation } from '../src/modules/requests/node.mjs';
export * from '../src/modules/requests/node.mjs';

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const input = parseArgs(process.argv.slice(2));
    process.stdout.write(input.help ? HELP : JSON.stringify(runOperation(input.command, input.options), null, 2) + '\n');
  } catch (cause) {
    process.stderr.write(JSON.stringify({ status: 'error', error: cause.message }) + '\n');
    process.exitCode = 1;
  }
}
