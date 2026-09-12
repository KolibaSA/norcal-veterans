import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const activeOnly = process.argv.includes('--active');
const files = readdirSync(new URL('.', import.meta.url)).filter(name => name.endsWith('.test.mjs') &&
  (!activeOnly || name.startsWith('norcal-') || name === 'legacy-security.test.mjs')).sort().map(name => 'scripts/' + name);
if (!files.length) throw new Error('No test files found.');
console.log(activeOnly ? 'Testing the deployed NorCal Worker, HQ and agent.' : 'Testing active NorCal code plus preserved source-application regression fixtures.');
const result = spawnSync(process.execPath, ['--test', '--test-isolation=none', ...files], { cwd: root, stdio: 'inherit', windowsHide: true });
if (result.error) { console.error('Tests could not start:', result.error.code); process.exit(1); }
process.exit(result.status ?? 1);
