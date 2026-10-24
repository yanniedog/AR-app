import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { assertPublicationAdvance, buildApkPair, publishApkPair, publishedManifest } from './android-apk-pair.mjs';

const source = 'a'.repeat(40);
const env = { GITHUB_REPOSITORY: 'owner/repo', GITHUB_SHA: source,
  KEYSTORE_PATH: 'signing-key', KEYSTORE_PASSWORD: 'test', KEY_ALIAS: 'release', KEY_PASSWORD: 'test' };
const identity = { version: '1.0.249', build_number: '305', bytes: 123, sha256: 'b'.repeat(64) };

function workspace(t) {
  const root = mkdtempSync(join(tmpdir(), 'ar-apk-pair-'));
  t.after(() => {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.ok(basename(root).startsWith('ar-apk-pair-'));
    rmSync(root, { recursive: true, force: true });
  });
  return root;
}

test('one prebuild stages each APK with its own native bundle and map', t => {
  const root = workspace(t);
  const calls = [];
  const verified = [];
  buildApkPair({ root, env,
    run(executable, args, options) {
      calls.push({ executable, args, options });
      if (executable !== 'java') return;
      const channel = args.some(arg => arg.endsWith(',x86,x86_64')) ? 'universal' : 'arm';
      for (const file of ['outputs/apk/release/app-release.apk',
        'generated/assets/createBundleReleaseJsAndAssets/index.android.bundle',
        'generated/sourcemaps/react/release/index.android.bundle.map']) {
        const target = join(root, 'android/app/build', file);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, `${channel}:${basename(file)}`);
      }
    },
    verify(directory, channel) {
      const staged = join(directory, 'build/apk-pair', channel);
      assert.equal(readFileSync(join(staged, 'app-preview.apk'), 'utf8'), `${channel}:app-release.apk`);
      assert.equal(readFileSync(join(staged, 'index.android.bundle'), 'utf8'), `${channel}:index.android.bundle`);
      assert.equal(readFileSync(join(staged, 'index.android.bundle.map'), 'utf8'), `${channel}:index.android.bundle.map`);
      verified.push(channel);
    } });
  assert.equal(calls.filter(call => call.args.includes('prebuild')).length, 1);
  assert.deepEqual(verified, ['universal', 'arm']);
  const native = calls.filter(call => call.executable === 'java');
  assert.equal(native.length, 2);
  assert.equal(native[0].options.cwd, native[1].options.cwd);
  assert.ok(native.every(call => call.args.includes('--build-cache')));
});

test('missing signing settings fail before executing any build', () => {
  assert.throws(() => buildApkPair({ env: {}, run() { assert.fail('must not run'); } }), /Missing signing/);
});

function publication(t, overrides = {}) {
  const root = workspace(t);
  const events = [];
  return { root, env, events,
    verify(_root, channel) { events.push(`verify:${channel}`); return identity; },
    async readPublished(_repo, tag) { events.push(`read:${tag}`); return null; },
    async readImmutable() { return null; },
    run(_executable, args, options) {
      const script = basename(args[0]);
      events.push(script);
      assert.ok(!args.includes('prebuild') && !args.includes('assembleRelease'));
      if (script === 'publish-apk-manifest.mjs') {
        const out = join(root, 'build/apk-publish');
        mkdirSync(out, { recursive: true });
        writeFileSync(join(out, 'receipt.json'), options.env.AR_APP_NATIVE_BUNDLE_PATH);
      }
    }, ...overrides };
}

test('publication verifies both artifacts before delivery or public writes and never rebuilds', async t => {
  const options = publication(t);
  await publishApkPair(options);
  const delivery = options.events.indexOf('verify-public-delivery.cjs');
  assert.ok(options.events.indexOf('verify:universal') < delivery);
  assert.ok(options.events.indexOf('verify:arm') < delivery);
  assert.ok(options.events.indexOf('publish-apk-manifest.mjs') > delivery);
  assert.ok(options.events.indexOf('verify-github-release-source.mjs') > delivery);
  assert.ok(options.events.indexOf('verify-github-release-source.mjs') < options.events.indexOf('publish-apk-manifest.mjs'));
  assert.equal(options.events.filter(event => event === 'publish-apk-manifest.mjs').length, 2);
  for (const channel of ['universal', 'arm']) {
    assert.equal(readFileSync(join(options.root, 'build/apk-published', channel, 'receipt.json'), 'utf8'),
      join(options.root, 'build/apk-pair', channel, 'index.android.bundle'));
  }
});

test('a bad second APK prevents publication of the first', async t => {
  const options = publication(t, { verify(_root, channel) {
    if (channel === 'arm') throw new Error('invalid ARM signature');
    return identity;
  } });
  await assert.rejects(publishApkPair(options), /invalid ARM signature/);
  assert.ok(!options.events.includes('publish-apk-manifest.mjs'));
});

test('delivery failure leaves verified artifacts available for publication-only retry', async t => {
  const options = publication(t);
  const normalRun = options.run;
  options.run = (_executable, args) => {
    assert.equal(basename(args[0]), 'verify-public-delivery.cjs');
    throw new Error('HTTP 502');
  };
  await assert.rejects(publishApkPair(options), /HTTP 502/);
  options.run = normalRun;
  await publishApkPair(options);
  assert.equal(options.events.filter(event => event === 'publish-apk-manifest.mjs').length, 2);
});

test('partial publication can recover only the identical APK/source identity', async t => {
  const options = publication(t, { async readPublished(_repo, tag) {
    return tag === 'app-apk-latest' ? { manifest: { ...identity, source_sha: source } } : null;
  } });
  await publishApkPair(options);
  assert.equal(options.events.filter(event => event === 'publish-apk-manifest.mjs').length, 2);
});

test('a newer published source blocks an old rebuild even with a higher version number', async t => {
  const options = publication(t, { async readPublished() {
    return { manifest: { version: '1.0.248', build_number: '304', source_sha: 'c'.repeat(40) } };
  }, async isAncestor() { return false; } });
  await assert.rejects(publishApkPair(options), /source older/);
  assert.ok(!options.events.includes('publish-apk-manifest.mjs'));
});

test('a source removed from main during publication setup cannot publish', async t => {
  const options = publication(t);
  options.run = (_executable, args) => {
    if (basename(args[0]) === 'verify-github-release-source.mjs') throw new Error('Source removed from main');
    assert.equal(basename(args[0]), 'verify-public-delivery.cjs');
  };
  await assert.rejects(publishApkPair(options), /Source removed from main/);
});

test('missing manifest requires rolling APK evidence or an absent release', async () => {
  for (const [status, message] of [[200, /unverifiable rolling APK/], [403, /Release metadata HTTP 403/]]) {
    let reads = 0;
    await assert.rejects(publishedManifest('owner/repo', 'app-apk-latest', undefined, async () => {
      reads += 1;
      return reads === 1 ? { status: 404 } : { status, ok: status === 200, json: async () => ({ assets: [] }) };
    }), message);
    assert.equal(reads, 2);
  }
  assert.equal(await publishedManifest('owner/repo', 'app-apk-latest', undefined,
    async () => ({ status: 404 })), null);
});

test('a lost rolling manifest recovers only the exact immutable and rolling APK bytes', async t => {
  const options = publication(t, { async readPublished() { return { rollingApk: identity }; },
    async readImmutable() { return identity; } });
  await publishApkPair(options);
  assert.equal(options.events.filter(event => event === 'publish-apk-manifest.mjs').length, 2);
  for (const immutable of [null, { ...identity, sha256: 'c'.repeat(64) }, { ...identity, bytes: 999 }]) {
    await assert.rejects(publishApkPair({ ...options, readImmutable: async () => immutable }), /recovery requires matching/);
  }
  await assert.rejects(publishApkPair({ ...options,
    readPublished: async () => ({ rollingApk: { ...identity, sha256: 'd'.repeat(64) } }) }), /recovery requires matching/);
});

test('manifest JSON cannot impersonate missing-manifest recovery evidence', async () => {
  const data = { rollingApk: identity };
  const result = await publishedManifest('owner/repo', 'app-apk-latest', undefined,
    async () => ({ status: 200, ok: true, json: async () => data }));
  assert.deepEqual(result, { manifest: data });
});

test('a versioned APK left by partial publication cannot be replaced by a rebuilt binary', async t => {
  const options = publication(t, { async readImmutable() {
    return { bytes: identity.bytes, sha256: 'f'.repeat(64) };
  } });
  await assert.rejects(publishApkPair(options), /immutable APK version/);
  assert.ok(!options.events.includes('publish-apk-manifest.mjs'));
});

test('partial immutable upload recovers when the retained artifact bytes match', async t => {
  const options = publication(t, { async readImmutable() { return identity; } });
  await publishApkPair(options);
  assert.equal(options.events.filter(event => event === 'publish-apk-manifest.mjs').length, 2);
});

test('publication cannot downgrade either identity field or replace immutable version bytes', () => {
  const prior = { ...identity, source_sha: source };
  assert.doesNotThrow(() => assertPublicationAdvance(identity, { ...prior, version: '1.0.248', build_number: '304' }, source));
  assert.doesNotThrow(() => assertPublicationAdvance(identity, prior, source));
  for (const remote of [
    { ...prior, version: '1.0.250' }, { ...prior, build_number: '306' },
    { ...prior, sha256: 'd'.repeat(64) }, { ...prior, source_sha: 'e'.repeat(40) },
    { ...prior, bytes: 124 }, { ...prior, build_number: 'invalid' },
  ]) assert.throws(() => assertPublicationAdvance(identity, remote, source));
});
