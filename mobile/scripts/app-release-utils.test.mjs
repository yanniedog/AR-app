#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { generateInstallAssets, releaseTargetRefForRepository } from './app-release-utils.mjs';

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
