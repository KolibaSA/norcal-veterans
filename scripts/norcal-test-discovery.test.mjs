import test from 'node:test';
import assert from 'node:assert/strict';
import { selectTestFiles } from './test-discovery.mjs';

const files = ['scripts/site.test.mjs', 'scripts/norcal-api.test.mjs', 'scripts/legacy-security.test.mjs', 'src/modules/events/browser.test.mjs', 'src/modules/events/nested/domain.test.mjs', 'src/modules/event-other/server.test.mjs', 'src/shared/privacy.test.mjs', 'src/app/routing.test.mjs'];

test('focused test selection stays inside the exact feature and includes nested tests', () => {
  assert.deepEqual(selectTestFiles(files, ['--module', 'events']).files, ['src/modules/events/browser.test.mjs', 'src/modules/events/nested/domain.test.mjs']);
  assert.throws(() => selectTestFiles(files, ['--module', 'event']), /No focused tests/);
  assert.throws(() => selectTestFiles(files, ['--module', '../events']), /one module directory name/);
  assert.throws(() => selectTestFiles(files, ['--typo']), /Unknown test option/);
});

test('full gate retains imported fixtures; active gate also discovers shared and app tests', () => {
  assert.deepEqual(selectTestFiles(files, []).files, [...files].sort());
  const selected = selectTestFiles(files, ['--active']).files;
  assert.ok(!selected.includes('scripts/site.test.mjs'));
  assert.equal(selected.length, files.length - 1);
  assert.ok(selected.includes('src/app/routing.test.mjs'));
});
