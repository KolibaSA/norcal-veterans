import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

// Wrangler already pins esbuild in pnpm-lock.yaml. Resolve its dependency in
// both pnpm's isolated layout and ordinary node_modules without changing it.
const require = createRequire(import.meta.url);
export const esbuild = createRequire(require.resolve('wrangler/package.json'))('esbuild');
export const projectRoot = path.resolve(import.meta.dirname, '..');

export async function bundleJavaScript(options) {
  const result = await esbuild.build({
    absWorkingDir: projectRoot, bundle: true, write: false, format: 'esm',
    platform: 'browser', target: 'es2022', charset: 'utf8', legalComments: 'none',
    metafile: true, logLevel: 'silent', ...options
  });
  if (Object.values(result.metafile.outputs).some(output => output.imports.length)) {
    throw new Error('A generated runtime still has unresolved imports.');
  }
  return result.outputFiles[0].text;
}

async function expandPartial(markup, extension, { root = projectRoot, stack = [] } = {}) {
  const expression = extension === '.html' ? /<!--\s*HQ_PARTIAL:\s*([^>]+?)\s*-->/g : /\/\*\s*HQ_PARTIAL:\s*([^*]+?)\s*\*\//g;
  let result = '', position = 0;
  for (const match of markup.matchAll(expression)) {
    const name = match[1].trim(), filename = path.resolve(root, name);
    const relative = path.relative(root, filename);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !relative.endsWith(extension)) {
      throw new Error('HQ partial must be a ' + extension + ' file inside the repository: ' + name);
    }
    if (stack.includes(filename)) throw new Error('HQ partial cycle: ' + [...stack, filename].join(' -> '));
    const fragment = await fs.readFile(filename, 'utf8');
    result += markup.slice(position, match.index) + await expandPartial(fragment, extension, { root, stack: [...stack, filename] });
    position = match.index + match[0].length;
  }
  return result + markup.slice(position);
}

export const expandHeadquartersMarkup = (source, options) => expandPartial(source, '.html', options);
export const expandHeadquartersStyles = (source, options) => expandPartial(source, '.css', options);
