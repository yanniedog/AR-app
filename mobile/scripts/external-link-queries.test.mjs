import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { addExternalLinkQueries } = require('../plugins/with-external-link-queries.js');

test('HTTPS browser lookup is declared without duplicating or replacing other queries', () => {
  const manifest = { queries: [{ package: [{ $: { 'android:name': 'existing.app' } }] }] };
  addExternalLinkQueries(manifest);
  addExternalLinkQueries(manifest);
  assert.equal(manifest.queries.length, 1);
  assert.equal(manifest.queries[0].package[0].$['android:name'], 'existing.app');
  const intent = manifest.queries[0].intent[0];
  assert.equal(intent.action[0].$['android:name'], 'android.intent.action.VIEW');
  assert.equal(intent.category[0].$['android:name'], 'android.intent.category.BROWSABLE');
  assert.equal(intent.data[0].$['android:scheme'], 'https');
});

test('HTTPS browser lookup is added to an empty Android manifest', () => {
  const manifest = {};
  addExternalLinkQueries(manifest);
  assert.equal(manifest.queries.length, 1);
});
