import { readdirSync } from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';
import { pathToFileURL } from 'node:url';
import { esbuild, projectRoot } from './build-support.mjs';

export const architecturePolicy = Object.freeze({
  // Interfaces are small feature-owned facades; everything else is private.
  publicEntries: ['browser.mjs', 'server.mjs', 'node.mjs', 'index.mjs', 'domain.mjs', 'public.mjs', 'intake.mjs'],
  runtimeEntries: ['src/norcal-worker.mjs', 'worker/legacy/hq-client.mjs']
});
const normalized = name => name.replaceAll('\\', '/').replace(/^\.\//, '');
const featureOf = name => /^src\/modules\/([^/]+)\//.exec(name)?.[1];
const modular = name => /^src\/(?:modules|shared|app)\//.test(name);
const nodeBuiltins = new Set(builtinModules.flatMap(name => [name, name.replace(/^node:/, ''), 'node:' + name.replace(/^node:/, '')]));

export function inspectArchitecture(inputs, policy = architecturePolicy) {
  const graph = new Map(Object.entries(inputs).map(([file, value]) => [normalized(file), value.imports.map(edge => ({ ...edge, path: normalized(edge.path) }))]));
  const failures = new Set();
  for (const [from, imports] of graph) for (const edge of imports) {
    if (edge.external) continue;
    const targetFeature = featureOf(edge.path), sourceFeature = featureOf(from);
    if (targetFeature && targetFeature !== sourceFeature && !policy.publicEntries.includes(edge.path.slice(('src/modules/' + targetFeature + '/').length))) {
      failures.add(`${from} imports private ${targetFeature} implementation ${edge.path}; use its public interface.`);
    }
    if (sourceFeature && edge.path.startsWith('src/app/')) failures.add(`${from} imports application composition ${edge.path}; inject the dependency through its interface.`);
    if (from.startsWith('src/shared/') && (targetFeature || edge.path.startsWith('src/app/'))) failures.add(`${from} depends on feature/application code ${edge.path}; shared utilities must remain independent.`);
  }

  // Strongly connected components catch cycles even when the path runs through
  // a preserved compatibility facade. Existing fixture-only cycles are outside
  // the modular architecture; any cycle touching new code is rejected.
  let nextIndex = 0;
  const index = new Map(), low = new Map(), stack = [], pending = new Set();
  function visit(file) {
    index.set(file, nextIndex); low.set(file, nextIndex++); stack.push(file); pending.add(file);
    for (const edge of graph.get(file) || []) {
      if (edge.external || !graph.has(edge.path)) continue;
      if (!index.has(edge.path)) { visit(edge.path); low.set(file, Math.min(low.get(file), low.get(edge.path))); }
      else if (pending.has(edge.path)) low.set(file, Math.min(low.get(file), index.get(edge.path)));
    }
    if (low.get(file) !== index.get(file)) return;
    const component = [];
    let member;
    do { member = stack.pop(); pending.delete(member); component.push(member); } while (member !== file);
    const selfImport = component.length === 1 && graph.get(file).some(edge => !edge.external && edge.path === file);
    if ((component.length > 1 || selfImport) && component.some(modular)) failures.add('Dependency cycle involving modular code: ' + component.sort().join(', '));
  }
  for (const file of graph.keys()) if (!index.has(file)) visit(file);

  for (const entry of policy.runtimeEntries) {
    if (!graph.has(entry)) { failures.add('Missing runtime entry in dependency graph: ' + entry); continue; }
    const seen = new Set();
    function inspectRuntime(file, chain) {
      if (seen.has(file)) return;
      seen.add(file);
      for (const edge of graph.get(file) || []) {
        const next = [...chain, edge.path];
        if (nodeBuiltins.has(edge.path) || /^(?:scripts|node_modules)\//.test(edge.path) || /(?:^|\/)node(?:-[^/]*)?\.mjs$/.test(edge.path)) {
          failures.add('Node-only code is reachable from deployed/browser runtime: ' + next.join(' -> '));
        } else if (!edge.external) inspectRuntime(edge.path, next);
      }
    }
    inspectRuntime(entry, [entry]);
  }
  return [...failures].sort();
}

function sourceEntries(directory) {
  try {
    return readdirSync(path.join(projectRoot, directory), { withFileTypes: true }).flatMap(entry => {
      const filename = directory + '/' + entry.name;
      return entry.isDirectory() ? sourceEntries(filename) : filename.endsWith('.mjs') && !filename.endsWith('.test.mjs') ? [filename] : [];
    });
  } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}

export async function checkArchitecture() {
  const entryPoints = [...new Set([...architecturePolicy.runtimeEntries, ...['src/modules', 'src/app', 'src/shared'].flatMap(sourceEntries)])];
  const result = await esbuild.build({
    absWorkingDir: projectRoot, entryPoints, outdir: '.architecture-check',
    bundle: true, write: false, metafile: true, format: 'esm', platform: 'neutral',
    external: [...nodeBuiltins], packages: 'external', logLevel: 'silent'
  });
  const failures = inspectArchitecture(result.metafile.inputs);
  if (failures.length) throw new Error('Architecture check failed:\n' + failures.map(message => '- ' + message).join('\n'));
  return { files: Object.keys(result.metafile.inputs).length, entryPoints: entryPoints.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = await checkArchitecture();
  console.log(`Architecture checks passed (${result.files} source files, ${result.entryPoints} entry points).`);
}
