import { readdirSync } from 'node:fs';
import path from 'node:path';

export function discoverTestFiles(root, directory) {
  try {
    return readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
      const filename = directory + '/' + entry.name;
      return entry.isDirectory() ? discoverTestFiles(root, filename) : filename.endsWith('.test.mjs') ? [filename] : [];
    }).sort();
  } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}

export function selectTestFiles(files, args) {
  let active = false, moduleName;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--active') active = true;
    else if (args[index] === '--module') {
      if (moduleName || !/^[a-z][a-z0-9-]*$/.test(args[index + 1] || '')) throw new Error('Use --module followed by one module directory name.');
      moduleName = args[++index];
    } else throw new Error('Unknown test option: ' + args[index]);
  }
  const selected = files.filter(file => moduleName
    ? file.startsWith(`src/modules/${moduleName}/`)
    : !active || file.startsWith('src/') || /^scripts\/(?:norcal-.*|legacy-security)\.test\.mjs$/.test(file)).sort();
  if (!selected.length) throw new Error(moduleName ? `No focused tests found for module "${moduleName}". Check docs/modules.md and the module's README.` : 'No test files found.');
  return { files: selected, moduleName, active };
}
