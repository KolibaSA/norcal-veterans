import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { discoverTestFiles, selectTestFiles } from './test-discovery.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const discovered = ['scripts', 'src/modules', 'src/shared', 'src/app'].flatMap(directory => discoverTestFiles(root, directory));
const { files, moduleName, active } = selectTestFiles(discovered, process.argv.slice(2));
console.log(moduleName ? `Testing only the ${moduleName} module (${files.length} test files).` : active ? 'Testing the deployed NorCal Worker, HQ, agent and feature modules.' : 'Testing active NorCal code and feature modules plus preserved source-application regression fixtures.');
const result = spawnSync(process.execPath, ['--test', '--test-isolation=none', ...files], { cwd: root, stdio: 'inherit', windowsHide: true });
if (result.error) { console.error('Tests could not start:', result.error.code); process.exit(1); }
process.exit(result.status ?? 1);
