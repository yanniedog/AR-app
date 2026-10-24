#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { generateInstallAssets, releaseTargetRefForRepository, missingImmutableUploadPaths,
  mergePublishedChangelogs, readPublishedChangelogs, fetchReleaseAssets } from './app-release-utils.mjs';

async function renderInstaller(t, { tag, manifestTag = tag, downloadUrl, repo = 'yanniedog/AR-app' }) {
  const directory = mkdtempSync(join(tmpdir(), 'ar-installer-'));
  t.after(() => {
    rmSync(join(directory, 'install.html'), { force: true });
    rmSync(join(directory, 'app-preview-qr.png'), { force: true });
    rmdirSync(directory);
  });
  const assets = await generateInstallAssets(directory, downloadUrl, repo, tag, manifestTag);
  return { assets, html: readFileSync(assets.installPath, 'utf8'), qr: readFileSync(assets.qrPath) };
}

function bodyCopy(html) {
  return html.match(/<body>([\s\S]*?)<\/body>/)[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

test('uses the source SHA only when publishing into the source repository', () => {
  assert.equal(
    releaseTargetRefForRepository('yanniedog/AR-app', {
      GITHUB_REPOSITORY: 'yanniedog/AR-app',
      GITHUB_SHA: '0123456789abcdef0123456789abcdef01234567',
    }),
    '0123456789abcdef0123456789abcdef01234567',
  );
});

test('uses an explicitly pinned release source ahead of the workflow event SHA', () => {
  assert.equal(
    releaseTargetRefForRepository('yanniedog/AR-app', {
      GITHUB_REPOSITORY: 'yanniedog/AR-app',
      GITHUB_SHA: '1'.repeat(40),
      RELEASE_SOURCE_SHA: '2'.repeat(40),
    }),
    '2'.repeat(40),
  );
});

test('does not send a foreign source SHA to a cross-repository release', () => {
  assert.equal(
    releaseTargetRefForRepository('yanniedog/AR-local', {
      GITHUB_REPOSITORY: 'yanniedog/AR-app',
      GITHUB_SHA: '0123456789abcdef0123456789abcdef01234567',
    }),
    '',
  );
});

for (const [tag, manifestTag, versionTag] of [
  ['app-apk-latest', 'app-apk-latest', 'app-v1.0.239'],
  ['app-apk-arm-latest', 'app-apk-arm-latest', 'app-arm-v1.0.239'],
  ['app-v1.0.239', 'app-apk-latest', 'app-v1.0.239'],
  ['app-arm-v1.0.239', 'app-apk-arm-latest', 'app-arm-v1.0.239'],
]) {
  test(`consumer installer ${tag} keeps exact channel identities with concise mobile controls`, async t => {
    const base = 'https://github.com/yanniedog/AR-app/releases/download/';
    const downloadUrl = `${base}${versionTag}/app-preview.apk`;
    const { html, assets, qr } = await renderInstaller(t, { tag, manifestTag, downloadUrl });
    assert.equal(bodyCopy(html), 'Australian Rates Download Scan Manifest');
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
    assert.match(html, /<main>[\s\S]*<h1>Australian Rates<\/h1>/);
    assert.ok(html.includes(`<a class="download" href="${downloadUrl}">Download</a>`));
    assert.ok(html.includes(`<a class="manifest" href="${base}${manifestTag}/app-apk-latest.json">Manifest</a>`));
    assert.ok(html.includes(`<img src="${base}${tag}/app-preview-qr.png"`));
    assert.match(html, /alt="Australian Rates download QR"/);
    const targetCss = html.match(/\.download\s*\{([^}]+)\}/)[1];
    assert.match(targetCss, /min-height:\s*48px/);
    assert.match(targetCss, /display:\s*flex/);
    assert.match(targetCss, /background:\s*#2563eb/);
    assert.match(targetCss, /color:\s*#ffffff/);
    assert.match(html, /background:\s*#ffffff; color:\s*#172b4d/);
    assert.match(html, /font-family:\s*Roboto, system-ui, sans-serif/);
    assert.match(html, /a:focus-visible\s*\{[^}]*outline:/);
    assert.match(html, /width:\s*min\(16rem, 100%\); height:\s*auto/);
    assert.equal(assets.installUrl, `${base}${tag}/install.html`);
    assert.equal(assets.qrUrl, `${base}${tag}/app-preview-qr.png`);
    assert.equal(assets.qrPath.split(/[\\/]/).at(-1), 'app-preview-qr.png');
    assert.equal(assets.installPath.split(/[\\/]/).at(-1), 'install.html');
    assert.deepEqual(qr.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  });
}

test('a nonrolling manifest argument keeps its original no-manifest behavior', async t => {
  const { html } = await renderInstaller(t, {
    tag: 'app-v1.0.239', downloadUrl: 'https://github.com/yanniedog/AR-app/releases/download/app-v1.0.239/app-preview.apk',
  });
  assert.equal(bodyCopy(html), 'Australian Rates Download Scan');
  assert.doesNotMatch(html, /class="manifest"/);
});

test('URL attributes are escaped without changing their decoded download, QR or manifest identities', async t => {
  const repo = 'example/release" data-extra="unsafe';
  const downloadUrl = 'https://example.test/app-preview.apk?label="quoted"&value=<tag>\'s';
  const { html, assets } = await renderInstaller(t, { repo, tag: 'app-apk-latest', downloadUrl });
  const decode = value => value.replace(/&(amp|lt|gt|quot|#39);/g,
    (_match, entity) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[entity]);
  const attributes = [...html.matchAll(/\b(?:href|src)="([^"]*)"/g)].map(match => decode(match[1]));
  assert.deepEqual(attributes, [downloadUrl, assets.qrUrl,
    `https://github.com/${repo}/releases/download/app-apk-latest/app-apk-latest.json`]);
  assert.doesNotMatch(html, /\bdata-extra="/);
  assert.ok(html.includes('&quot;quoted&quot;&amp;value=&lt;tag&gt;&#39;s'));
  assert.equal(bodyCopy(html), 'Australian Rates Download Scan Manifest');
});
test('the static README QR always resolves to the current ARM download URL', async () => {
  const { readFile } = await import('node:fs/promises');
  const { default: QRCode } = await import('qrcode');
  const { PNG } = await import('pngjs');
  const actual = PNG.sync.read(await readFile(new URL('../../docs/android-install-qr.png', import.meta.url)));
  const expected = PNG.sync.read(await QRCode.toBuffer(
    'https://github.com/yanniedog/AR-app/releases/download/app-apk-arm-latest/app-preview.apk',
    { width: 256, margin: 2, errorCorrectionLevel: 'M' }));
  assert.equal(actual.width, expected.width);
  assert.equal(actual.height, expected.height);
  assert.ok(actual.data.equals(expected.data));
  const readme = await readFile(new URL('../../README.md', import.meta.url), 'utf8');
  assert.match(readme, /docs\/android-install-qr\.png/);
});

test('immutable publication reuses verified assets and uploads only missing files without clobber', () => {
  const paths = ['stage/app-preview.apk', 'stage/app-preview-qr.png', 'stage/install.html', 'stage/changelog-summary.json'];
  const identity = { sha256: 'a'.repeat(64), bytes: 123 };
  const assets = [{ name: 'app-preview.apk', digest: `sha256:${identity.sha256}`, size: 123 },
    { name: 'app-preview-qr.png' }];
  assert.deepEqual(missingImmutableUploadPaths(paths, assets, identity), paths.slice(2));
  assert.deepEqual(missingImmutableUploadPaths(paths, paths.map(file =>
    file.endsWith('app-preview.apk') ? assets[0] : { name: file.split('/').at(-1) }), identity), []);
  assert.throws(() => missingImmutableUploadPaths(paths, [{ ...assets[0], digest: 'sha256:wrong' }], identity), /does not match/);
  const publisher = readFileSync(new URL('./publish-apk-manifest.mjs', import.meta.url), 'utf8');
  const versioned = publisher.slice(publisher.indexOf('async function publishVersionedRelease'), publisher.indexOf('async function publishQrOnly'));
  assert.doesNotMatch(versioned, /--clobber/);
  assert.match(versioned, /if \(missing.length\) gh\(ghToken, repo, \['release', 'upload', tag, ...missing\]\)/);
});

const history = versions => ({ schema_version: 1, repo: 'owner/repo', versions: versions.map(version => ({
  version, summaryBullets: [`Changes in ${version}`], releaseUrl: `https://github.com/owner/repo/releases/tag/app-arm-v${version}`,
})) });

test('successive build-local allocations preserve intermediate published changelogs', () => {
  const first = mergePublishedChangelogs(history(['1.0.248', '1.0.249']), [history(['1.0.248'])]);
  const next = mergePublishedChangelogs(history(['1.0.248', '1.0.250']), [first]);
  assert.deepEqual(next.versions.map(row => row.version), ['1.0.248', '1.0.249', '1.0.250']);
  assert.equal(next.versions[1].releaseUrl, first.versions[1].releaseUrl);
  const published = history(['1.0.248']);
  published.versions[0].summaryBullets = ['Original published notes'];
  const preserved = mergePublishedChangelogs(history(['1.0.248', '1.0.249']), [published]);
  assert.deepEqual(preserved.versions[0], published.versions[0]);
  assert.throws(() => mergePublishedChangelogs(history([]), [{ ...first, repo: 'other/repo' }]), /Invalid published/);
  assert.throws(() => mergePublishedChangelogs(history([]), [{ ...first,
    versions: [{ ...first.versions[0], releaseUrl: 'https://evil.test/release' }] }]), /Invalid published/);
});

function historyFetch(rows) {
  return async url => {
    const path = new URL(url).pathname.split('/download/')[1];
    const value = rows[path];
    return value === undefined ? { status: 404 } : { status: 200, ok: true, text: async () => JSON.stringify(value) };
  };
}

test('a failed rolling summary upload recovers the complete immutable history', async () => {
  const prior = history(['1.0.248', '1.0.249']);
  const candidate = history(['1.0.248', '1.0.249', '1.0.250']);
  assert.deepEqual(await readPublishedChangelogs('owner/repo', 'app-apk-arm-latest', '1.0.250', historyFetch({
    'app-arm-v1.0.250/changelog-summary.json': candidate,
  })), [candidate]);
  assert.deepEqual(await readPublishedChangelogs('owner/repo', 'app-apk-arm-latest', '1.0.250', historyFetch({
    'app-apk-arm-latest/app-apk-latest.json': { version: '1.0.249' },
    'app-arm-v1.0.249/changelog-summary.json': prior,
  })), [prior]);
  await assert.rejects(readPublishedChangelogs('owner/repo', 'app-apk-arm-latest', '1.0.250', historyFetch({
    'app-apk-arm-latest/app-apk-latest.json': { version: '1.0.249' },
  })), /history is missing/);
  await assert.rejects(readPublishedChangelogs('owner/repo', 'app-apk-arm-latest', '1.0.250',
    async () => ({ status: 503 })), /HTTP 503/);
});

test('asset discovery distinguishes an absent release from API failure', async () => {
  assert.equal(await fetchReleaseAssets('owner/repo', 'tag', undefined, async () => ({ status: 404 })), null);
  await assert.rejects(fetchReleaseAssets('owner/repo', 'tag', undefined,
    async () => ({ status: 403 })), /HTTP 403/);
});
