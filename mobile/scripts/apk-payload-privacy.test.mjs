import assert from 'node:assert/strict';
import test from 'node:test';
import { zipSync, strToU8 } from 'fflate';
import { verifyApkPayloadPrivacy } from './apk-payload-privacy.mjs';

const bundle = strToU8('technical bytecode fixture');
const map = { version: 3, sources: ['src/App.tsx'] };
const apk = extra => zipSync({ 'assets/index.android.bundle': bundle, ...extra });

test('binds exact packaged runtime to the native build module inventory', () => {
  assert.match(verifyApkPayloadPrivacy(apk({}), bundle, map).apk_sha256, /^[a-f0-9]{64}$/);
  assert.throws(() => verifyApkPayloadPrivacy(apk({}), strToU8('other build'), map), /does not match/);
  assert.throws(() => verifyApkPayloadPrivacy(apk({}), bundle, {}), /missing or invalid/);
});

test('rejects bundled data in source modules and separate APK assets', () => {
  for (const source of ['assets/sample/core.json', '..\\src\\data\\sample.js']) {
    assert.throws(() => verifyApkPayloadPrivacy(apk({}), bundle, { ...map, sources: [source] }), /bundled product data/);
  }
  for (const name of ['assets/sample/arbitrary.bin', 'assets/core-2026-09-16-abc.json.gz', 'assets/details.json']) {
    assert.throws(() => verifyApkPayloadPrivacy(apk({ [name]: strToU8('{}') }), bundle, map), /dataset asset/);
  }
});

test('unknown assets and key-bearing bootstrap cannot be published', () => {
  assert.throws(() => verifyApkPayloadPrivacy(apk({ 'assets/export.zip': bundle }), bundle, map), /Unknown APK asset/);
  for (const name of ['assets/app.manifest', 'assets/app.config']) {
    assert.throws(() => verifyApkPayloadPrivacy(apk({ [name]: strToU8(JSON.stringify({ extra: { payloadDecKeyHex: 'technical' } })) }), bundle, map), /prohibited key/);
    verifyApkPayloadPrivacy(apk({ [name]: strToU8('{"id":"technical-bootstrap","assets":[]}'), 'assets/font.ttf': bundle }), bundle, map);
  }
});
