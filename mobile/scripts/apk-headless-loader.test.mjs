import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';
import { zipSync } from 'fflate';
import { HEADLESS_LOADER, inspectHeadlessLoaderDex, verifyApkHeadlessLoader } from './apk-headless-loader.mjs';

const require = createRequire(import.meta.url);
const descriptor = name => `L${name.replaceAll('.', '/')};`;

// Minimal DEX table fixtures exercise definitions and encoded constructors,
// including the dangerous case where only a reflection-name string survives.
function dexFixture({ defined = true, className = HEADLESS_LOADER,
  parameter = 'android.content.Context', constructorFlags = 0x10001, classFlags = 1,
  hasCode = true } = {}) {
  const bytes = Buffer.alloc(4096);
  const strings = ['<init>', descriptor(HEADLESS_LOADER), descriptor(className), descriptor(parameter), 'V'];
  const stringsOffset = 112, typesOffset = stringsOffset + strings.length * 4;
  const protosOffset = typesOffset + 3 * 4, methodsOffset = protosOffset + 12;
  const classesOffset = methodsOffset + 8;
  let offset = classesOffset + (defined ? 32 : 0);
  const u32 = (at, value) => bytes.writeUInt32LE(value, at);
  const u16 = (at, value) => bytes.writeUInt16LE(value, at);
  const uleb = value => {
    do { const next = value & 127; value = Math.floor(value / 128); bytes[offset++] = next | (value ? 128 : 0); } while (value);
  };
  strings.forEach((value, index) => {
    u32(stringsOffset + index * 4, offset);
    uleb(value.length);
    offset += bytes.write(value, offset);
    bytes[offset++] = 0;
  });
  while (offset % 4) offset++;
  const parameters = offset;
  u32(offset, 1); u16(offset + 4, 1); offset += 8;
  const code = offset;
  u16(offset, 2); u16(offset + 2, 2); u32(offset + 12, 1); u16(offset + 16, 0x000e); offset += 18;
  const classData = offset;
  uleb(0); uleb(0); uleb(1); uleb(0);
  uleb(0); uleb(constructorFlags); uleb(hasCode ? code : 0);
  bytes.write('dex\n039\0', 0, 'ascii');
  u32(32, offset); u32(36, 112); u32(40, 0x12345678);
  for (const [at, count, tableOffset] of [[56, strings.length, stringsOffset], [64, 3, typesOffset],
    [72, 1, protosOffset], [88, 1, methodsOffset], [96, defined ? 1 : 0, classesOffset]]) {
    u32(at, count); u32(at + 4, tableOffset);
  }
  u32(typesOffset, 2); u32(typesOffset + 4, 3); u32(typesOffset + 8, 4);
  u32(protosOffset + 4, 2); u32(protosOffset + 8, parameters);
  u16(methodsOffset, 0); u16(methodsOffset + 2, 0); u32(methodsOffset + 4, 0);
  if (defined) { u32(classesOffset, 0); u32(classesOffset + 4, classFlags); u32(classesOffset + 24, classData); }
  return bytes.subarray(0, offset);
}

test('finds the actual public loader and Context constructor in a secondary DEX', () => {
  const apk = zipSync({ 'classes.dex': dexFixture({ defined: false }), 'classes2.dex': dexFixture() });
  assert.deepEqual(verifyApkHeadlessLoader(apk), {
    className: HEADLESS_LOADER, dex: 'classes2.dex', publicContextConstructor: true,
  });
});

test('manifest/reflection strings alone and a renamed class cannot pass', () => {
  for (const fixture of [dexFixture({ defined: false }), dexFixture({ className: 'a.b.C' })]) {
    assert.ok(fixture.includes(Buffer.from(descriptor(HEADLESS_LOADER))));
    assert.throws(() => verifyApkHeadlessLoader(zipSync({ 'classes.dex': fixture })), /found 0/);
  }
  assert.throws(() => verifyApkHeadlessLoader(zipSync({})), /found 0/);
});

test('rejects inaccessible, abstract, removed and wrong-signature constructors', () => {
  for (const options of [{ constructorFlags: 0x10002 }, { classFlags: 0 }, { classFlags: 0x401 },
    { hasCode: false }, { parameter: 'java.lang.String' }]) {
    assert.throws(() => verifyApkHeadlessLoader(zipSync({ 'classes.dex': dexFixture(options) })), /missing public/);
  }
  assert.throws(() => verifyApkHeadlessLoader(zipSync({
    'classes.dex': dexFixture(), 'classes2.dex': dexFixture(),
  })), /found 2/);
});

test('malformed DEX bounds fail closed', () => {
  assert.throws(() => inspectHeadlessLoaderDex(dexFixture().subarray(0, 30)), /DEX/);
  const fixture = dexFixture();
  fixture.writeUInt32LE(0xfffffffe, 100);
  assert.throws(() => inspectHeadlessLoaderDex(fixture), /DEX bounds/);
});

test('the installed Expo prebuild plugin writes the narrow reflected-class keep rule idempotently', async () => {
  const app = JSON.parse(await readFile(new URL('../app.json', import.meta.url), 'utf8')).expo;
  const options = app.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-build-properties')[1];
  const manifest = await readFile(new URL('../node_modules/expo-modules-core/android/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
  assert.ok(manifest.includes(`android:value="${HEADLESS_LOADER}"`));
  assert.equal(options.android.enableMinifyInReleaseBuilds, true);
  const { withBuildProperties } = require('expo-build-properties/build/withBuildProperties');
  const folder = await mkdtemp(join(tmpdir(), 'ar-headless-proguard-'));
  try {
    await mkdir(join(folder, 'app'));
    const path = join(folder, 'app', 'proguard-rules.pro');
    await writeFile(path, '# Existing application rules\n-keep class example.Existing\n');
    const execute = () => {
      // Each prebuild has a new config; the real plugin purges its old block
      // before appending current rules, while preserving user-authored rules.
      const config = withBuildProperties({ name: 'fixture', slug: 'fixture' }, options);
      return config.mods.android.dangerous({ ...config, modRequest: { platformProjectRoot: folder } });
    };
    await execute();
    const once = await readFile(path, 'utf8');
    assert.match(once, /-keep class expo\.modules\.adapters\.react\.apploader\.RNHeadlessAppLoader \{\s+public <init>\(android\.content\.Context\);\s+\}/);
    assert.ok(once.includes('-keep class example.Existing'));
    assert.doesNotMatch(options.android.extraProguardRules, /allowobfuscation|allowshrinking|\*\*/);
    await execute();
    assert.equal(await readFile(path, 'utf8'), once);
  } finally { await rm(folder, { recursive: true, force: true }); }
});

test('both built-APK validation and every publication path enforce the DEX contract', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/mobile-android-apk.yml', import.meta.url), 'utf8');
  const publisher = await readFile(new URL('./publish-apk-manifest.mjs', import.meta.url), 'utf8');
  assert.match(workflow, /verifyApkHeadlessLoader\(readFileSync\(process\.env\.APK_PATH\)\)/);
  const validation = workflow.indexOf('verifyApkHeadlessLoader(readFileSync');
  assert.ok(validation < workflow.indexOf('id: publish'));
  const publishBody = publisher.slice(publisher.indexOf('async function publishRelease('));
  const guard = publishBody.indexOf('verifyApkHeadlessLoader(apkBuf)');
  assert.ok(guard > 0 && guard < publishBody.indexOf('await publishVersionedRelease('));
});
