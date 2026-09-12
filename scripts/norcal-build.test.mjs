import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import headquarters, { scriptHash } from '../worker/legacy/hq-template.mjs';
import { bundleJavaScript, expandHeadquartersMarkup, expandHeadquartersStyles } from './build-support.mjs';

const scripts = [...headquarters.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)];

test('HQ template embeds the complete current module bundle and hashes those exact bytes', async () => {
  assert.equal(scripts.length, 1, 'HQ must start through one embedded module');
  const embedded = scripts[0][1];
  assert.equal(scriptHash, 'sha256-' + createHash('sha256').update(embedded).digest('base64'));
  const [bundle, markupSource, styleSource] = await Promise.all([
    bundleJavaScript({ entryPoints: ['worker/legacy/hq-client.mjs'] }),
    readFile(new URL('../worker/legacy/hq.html', import.meta.url), 'utf8'),
    readFile(new URL('../worker/legacy/hq.css', import.meta.url), 'utf8')
  ]);
  assert.equal(embedded, bundle, 'Generated HQ is stale; run node scripts/build.mjs.');
  const [markup, styles] = await Promise.all([expandHeadquartersMarkup(markupSource), expandHeadquartersStyles(styleSource)]);
  const expected = markup.replace('<!-- HQ_STYLES -->', () => '<style>' + styles + '</style>').replace('<!-- HQ_SCRIPT -->', () => '<script type="module">' + bundle + '</script>');
  assert.equal(headquarters, expected, 'Generated markup/styles must match their feature fragments.');
  assert.doesNotMatch(headquarters, /HQ_PARTIAL:/);
});

test('the served browser bundle resolves its own module dependencies and preserves form behavior', async () => {
  assert.equal(scripts.length, 1);
  // Loading the actual inline bytes without a filesystem base URL fails if a
  // relative import was accidentally left for the browser to resolve.
  const runtime = await import('data:text/javascript;base64,' + Buffer.from(scripts[0][1]).toString('base64'));
  assert.equal(runtime.pacificInput('2026-12-04T02:00:00.000Z'), '2026-12-03T18:00');
  assert.equal(runtime.canEditRecord({ owner: true }, { kind: 'request', status: 'in_progress' }), false);
  const record = { kind: 'event', title: 'Winter gathering', status: 'draft', payload: { start_at: '2026-12-04T02:00:00.000Z', preserved: 'keep' } };
  const fields = runtime.fieldsForRecord(record);
  assert.equal(fields.start, '2026-12-03T18:00');
  assert.equal(runtime.payloadForFields('event', fields, record.payload).preserved, 'keep');
});

test('HQ partial expansion rejects paths outside the repository and wrong asset types', async () => {
  await assert.rejects(expandHeadquartersMarkup('<!-- HQ_PARTIAL: ../outside.html -->'), /inside the repository/);
  await assert.rejects(expandHeadquartersStyles('/* HQ_PARTIAL: worker/legacy/hq-client.mjs */'), /inside the repository/);
});
