import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectArchitecture } from './check-architecture.mjs';
import { esbuild, projectRoot } from './build-support.mjs';

const input = (...paths) => ({ imports: paths.map(path => typeof path === 'string' ? { path } : path) });
const policy = { publicEntries: ['browser.mjs', 'domain.mjs', 'server.mjs'], runtimeEntries: ['src/app/worker.mjs'] };

test('module boundary checker allows interfaces but catches private imports through any consumer', () => {
  const graph = {
    'src/app/worker.mjs': input('src/modules/events/server.mjs'),
    'src/modules/events/server.mjs': input('src/modules/organizations/domain.mjs', 'src/modules/events/validate.mjs'),
    'src/modules/events/validate.mjs': input(),
    'src/modules/organizations/domain.mjs': input()
  };
  assert.deepEqual(inspectArchitecture(graph, policy), []);
  graph['src/modules/events/server.mjs'].imports.push({ path: 'src/modules/organizations/validate.mjs' });
  assert.match(inspectArchitecture(graph, policy).join('\n'), /imports private organizations implementation/);
});

test('module checker catches cycles through compatibility files and shared feature coupling', () => {
  const graph = {
    'src/app/worker.mjs': input('src/modules/events/server.mjs'),
    'src/modules/events/server.mjs': input('worker/legacy/validation.mjs'),
    'worker/legacy/validation.mjs': input('src/modules/events/server.mjs'),
    'src/shared/utility.mjs': input('src/modules/events/server.mjs')
  };
  const failures = inspectArchitecture(graph, policy).join('\n');
  assert.match(failures, /Dependency cycle involving modular code/);
  assert.match(failures, /shared utilities must remain independent/);
});

test('runtime checker follows transitive dependencies and permits a separate Node agent entry', () => {
  const graph = {
    'src/app/worker.mjs': input('src/modules/requests/server.mjs'),
    'src/modules/requests/server.mjs': input(),
    'src/modules/requests/node.mjs': input({ path: 'node:child_process', external: true })
  };
  assert.deepEqual(inspectArchitecture(graph, policy), []);
  graph['src/modules/requests/server.mjs'].imports.push({ path: 'src/modules/requests/node.mjs' });
  assert.match(inspectArchitecture(graph, policy).join('\n'), /Node-only code is reachable.*src\/app\/worker\.mjs.*node\.mjs/);
  graph['src/modules/requests/server.mjs'] = input({ path: 'fs', external: true });
  assert.match(inspectArchitecture(graph, policy).join('\n'), /Node-only code is reachable.*fs/);
});

test('Share a Program builds using only its feature and shared utilities', async () => {
  const result = await esbuild.build({
    absWorkingDir: projectRoot,
    stdin: { contents: "export * from './src/modules/share-program/public.mjs';\nexport * from './src/modules/share-program/domain.mjs';", resolveDir: projectRoot, sourcefile: 'share-program-isolation.mjs' },
    bundle: true, write: false, metafile: true, format: 'esm', platform: 'browser', logLevel: 'silent'
  });
  const unrelated = Object.keys(result.metafile.inputs).filter(filename =>
    filename !== 'share-program-isolation.mjs' && !filename.startsWith('src/modules/share-program/') && !filename.startsWith('src/shared/'));
  assert.deepEqual(unrelated, [], 'Editing this feature must not require organization, event, access or application implementations.');
  assert.deepEqual(Object.values(result.metafile.outputs).flatMap(output => output.imports), []);
});
