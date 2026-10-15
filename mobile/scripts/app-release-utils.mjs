/**
 * GitHub release + QR install asset helpers (uses qrcode).
 * Naming/changelog: ./app-release-meta.mjs
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import QRCode from 'qrcode';
import {
  ARM_ROLLING_TAG,
  INSTALL_HTML,
  QR_ASSET,
  ROLLING_TAG,
  installReleaseUrl,
  manifestReleaseUrl,
  qrReleaseUrl,
} from './app-release-meta.mjs';

export * from './app-release-meta.mjs';

function htmlAttribute(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

/**
 * @param {string} outDir
 * @param {string} downloadUrl
 * @param {string} repo
 * @param {string} tag
 * @param {string} [manifestTag] tag for manifest link in install.html (rolling only)
 */
export async function generateInstallAssets(outDir, downloadUrl, repo, tag, manifestTag = tag) {
  mkdirSync(outDir, { recursive: true });
  const qrPath = join(outDir, QR_ASSET);
  await QRCode.toFile(qrPath, downloadUrl, {
    type: 'png',
    width: 512,
    margin: 2,
    errorCorrectionLevel: 'M',
  });

  const qrUrl = qrReleaseUrl(repo, tag);
  const manifestUrl =
    manifestTag === ROLLING_TAG || manifestTag === ARM_ROLLING_TAG
      ? manifestReleaseUrl(repo, manifestTag)
      : null;
  const manifestLine = manifestUrl
    ? `  <a class="manifest" href="${htmlAttribute(manifestUrl)}">Manifest</a>\n`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Install Australian Rates APK</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #ffffff; color: #172b4d; font-family: Roboto, system-ui, sans-serif; line-height: 1.5; }
    main { max-width: 28rem; margin: 0 auto; padding: 24px 16px; }
    h1 { margin: 0 0 24px; font-size: 1.5rem; }
    a { color: #2563eb; overflow-wrap: anywhere; }
    a:focus-visible { outline: 3px solid #172b4d; outline-offset: 4px; }
    .download { display: flex; align-items: center; justify-content: center; min-height: 48px; padding: 12px 16px; border-radius: 12px; background: #2563eb; color: #ffffff; font-weight: 600; text-decoration: none; }
    figure { margin: 24px 0 0; }
    figcaption { margin-bottom: 12px; font-weight: 600; }
    img { display: block; width: min(16rem, 100%); height: auto; }
    .manifest { display: inline-flex; align-items: center; min-height: 48px; max-width: 100%; margin-top: 12px; }
  </style>
</head>
<body>
  <main>
  <h1>Australian Rates</h1>
  <a class="download" href="${htmlAttribute(downloadUrl)}">Download</a>
  <figure>
    <figcaption>Scan</figcaption>
    <img src="${htmlAttribute(qrUrl)}" width="512" height="512" alt="Australian Rates download QR">
  </figure>
${manifestLine}  </main>
</body>
</html>
`;
  const installPath = join(outDir, INSTALL_HTML);
  writeFileSync(installPath, html);
  return { qrPath, installPath, qrUrl, installUrl: installReleaseUrl(repo, tag) };
}

/**
 * @param {string} ghToken
 * @param {string} repo
 * @param {string[]} args gh subcommand args (after "gh")
 */
export function gh(ghToken, repo, args, opts = {}) {
  const full = args.includes('--repo') ? args : [...args, '--repo', repo];
  return execFileSync('gh', full, {
    encoding: 'utf8',
    env: { ...process.env, GH_TOKEN: ghToken },
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60_000,
    ...opts,
  });
}

/**
 * @param {string} ghToken
 * @param {string} repo
 * @param {string} tag
 * @param {string} title
 * @param {string} notes
 * @param {string} [targetRef] commit SHA or branch for new tags
 */
export function ensureGitHubRelease(ghToken, repo, tag, title, notes, targetRef) {
  const view = spawnSync('gh', ['release', 'view', tag, '--repo', repo], {
    encoding: 'utf8',
    env: { ...process.env, GH_TOKEN: ghToken },
    timeout: 30_000,
  });
  if (view.status !== 0) {
    const createArgs = [
      'release',
      'create',
      tag,
      '--title',
      title,
      '--notes',
      notes,
      '--latest=false',
    ];
    if (targetRef?.trim()) {
      createArgs.push('--target', targetRef.trim());
    }
    gh(ghToken, repo, createArgs);
    return 'created';
  }
  gh(ghToken, repo, ['release', 'edit', tag, '--title', title, '--notes', notes]);
  return 'updated';
}

/**
 * A commit SHA only names a valid release target inside its source repository.
 * Cross-repository bridges must let GitHub use the destination's default branch.
 */
export function releaseTargetRefForRepository(targetRepo, environment = process.env) {
  const sourceRepo = String(environment.GITHUB_REPOSITORY ?? '').trim();
  if (!sourceRepo || sourceRepo.toLowerCase() !== String(targetRepo ?? '').trim().toLowerCase()) {
    return '';
  }
  return String(environment.RELEASE_SOURCE_SHA ?? environment.GITHUB_SHA ?? '').trim();
}
