import assert from 'node:assert/strict';
import test from 'node:test';
import { exportedWebEntry } from './check-exported-external-links.mjs';

test('selects the explicit production index entry or legacy Router entry, excluding maps and chunks', () => {
  assert.equal(exportedWebEntry(['index-abc.js', 'index-abc.js.map', 'route-other.js']), 'index-abc.js');
  assert.equal(exportedWebEntry(['entry-abc.js', 'entry-abc.js.map']), 'entry-abc.js');
});

test('rejects missing or ambiguous exported entries instead of skipping compiled policy verification', () => {
  for (const names of [[], ['route-other.js'], ['index-abc.js.map'], ['entry-old.js', 'index-new.js'],
    ['index-old.js', 'index-new.js']]) {
    assert.throws(() => exportedWebEntry(names), /Expected one exported web entry/);
  }
});
