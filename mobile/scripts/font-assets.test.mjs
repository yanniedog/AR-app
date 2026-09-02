import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceManifestUrl = new URL('../assets/fonts/SOURCES.json', import.meta.url);
const sourceManifest = JSON.parse(readFileSync(sourceManifestUrl, 'utf8'));

test('bundled fonts match their pinned source manifest', () => {
  assert.equal(sourceManifest.schemaVersion, 1);
  assert.ok(Array.isArray(sourceManifest.fonts) && sourceManifest.fonts.length > 0);

  const seen = new Set();
  for (const family of sourceManifest.fonts) {
    assert.match(family.commit, /^[0-9a-f]{40}$/);
    assert.ok(Array.isArray(family.files) && family.files.length > 0);
    for (const entry of family.files) {
      assert.match(entry.file, /^[A-Za-z0-9][A-Za-z0-9._-]*\.ttf$/);
      assert.match(entry.sha256, /^[0-9a-f]{64}$/);
      assert.equal(seen.has(entry.file), false, `duplicate font entry: ${entry.file}`);
      seen.add(entry.file);
      const fontUrl = new URL(entry.file, sourceManifestUrl);
      const actual = createHash('sha256').update(readFileSync(fontUrl)).digest('hex');
      assert.equal(actual, entry.sha256, `${fileURLToPath(fontUrl)} does not match SOURCES.json`);
    }
  }
});
