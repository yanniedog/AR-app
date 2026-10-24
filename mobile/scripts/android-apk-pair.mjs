import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, mkdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inspectApkIdentity } from './apk-identity.mjs';
import { verifyApkPayloadPrivacy } from './apk-payload-privacy.mjs';
import { verifyApkHeadlessLoader, verifyApkColdBackgroundPatches } from './apk-headless-loader.mjs';
import { expectedAbisForApkChannel } from './app-release-utils.mjs';
import { artifactBudgetForChannel, assertApkSizeBudget } from './report-artifact-sizes.mjs';
import releaseVersion from './android-release-version-pure.cjs';

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const channels = ['universal', 'arm'];
const rollingTag = channel => channel === 'arm' ? 'app-apk-arm-latest' : 'app-apk-latest';
const readJson = file => JSON.parse(readFileSync(file, 'utf8'));

function command(executable, args, options) {
  const result = spawnSync(executable, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${executable} exited with status ${result.status}`);
}

export function verifyBuiltApk(root, channel) {
  const directory = join(root, 'build/apk-pair', channel);
  const apkPath = join(directory, 'app-preview.apk');
  const apk = readFileSync(apkPath);
  const app = readJson(join(root, 'app.json')).expo;
  const identity = readJson(join(root, 'release-identity.json'));
  const budgets = readJson(join(root, 'performance-budgets.json'));
  assertApkSizeBudget(apk.length, artifactBudgetForChannel(budgets, channel));
  inspectApkIdentity(apkPath, {
    packageName: identity.android_package,
    versionName: app.version,
    versionCode: app.android.versionCode,
    certificateSha256: identity.signing_certificate_sha256,
    supportedAbis: expectedAbisForApkChannel(rollingTag(channel), identity.android_release_abis),
  });
  verifyApkHeadlessLoader(apk);
  verifyApkColdBackgroundPatches(apk);
  verifyApkPayloadPrivacy(apk, readFileSync(join(directory, 'index.android.bundle')),
    readJson(join(directory, 'index.android.bundle.map')));
  return { version: app.version, build_number: String(app.android.versionCode), bytes: apk.length,
    sha256: createHash('sha256').update(apk).digest('hex') };
}

export function buildApkPair({ root = mobileRoot, env = process.env, run = command, verify = verifyBuiltApk } = {}) {
  for (const key of ['KEYSTORE_PATH', 'KEYSTORE_PASSWORD', 'KEY_ALIAS', 'KEY_PASSWORD']) {
    if (!env[key]) throw new Error(`Missing signing configuration: ${key}`);
  }
  run(process.execPath, [join(root, 'node_modules/expo/bin/cli'), 'prebuild', '--platform', 'android', '--no-install'], { cwd: root, env });
  for (const channel of channels) {
    // Build all native ABIs first; the smaller ARM APK reuses their outputs.
    // Invoke the wrapper through Java so this also works on Windows.
    run('java', ['-classpath', 'gradle/wrapper/gradle-wrapper.jar', 'org.gradle.wrapper.GradleWrapperMain',
      'assembleRelease', '--no-daemon', '--build-cache',
      `-PreactNativeArchitectures=${channel === 'arm' ? 'armeabi-v7a,arm64-v8a' : 'armeabi-v7a,arm64-v8a,x86,x86_64'}`,
      `-Pandroid.injected.signing.store.file=${env.KEYSTORE_PATH}`,
      `-Pandroid.injected.signing.store.password=${env.KEYSTORE_PASSWORD}`,
      `-Pandroid.injected.signing.key.alias=${env.KEY_ALIAS}`,
      `-Pandroid.injected.signing.key.password=${env.KEY_PASSWORD}`,
    ], { cwd: join(root, 'android'), env });
    const directory = join(root, 'build/apk-pair', channel);
    mkdirSync(directory, { recursive: true });
    for (const [source, destination] of [
      ['outputs/apk/release/app-release.apk', 'app-preview.apk'],
      ['generated/assets/createBundleReleaseJsAndAssets/index.android.bundle', 'index.android.bundle'],
      ['generated/sourcemaps/react/release/index.android.bundle.map', 'index.android.bundle.map'],
    ]) copyFileSync(join(root, 'android/app/build', source), join(directory, destination));
    verify(root, channel);
  }
}

/** Recovery may finish a partial pair, but never replace a newer release. */
export function assertPublicationAdvance(local, remote, sourceSha) {
  if (!remote) return;
  const versionOrder = releaseVersion.compareVersions(local.version, remote.version);
  const localCode = Number(local.build_number);
  const remoteCode = Number(remote.build_number);
  if (!Number.isSafeInteger(remoteCode) || remoteCode <= 0) throw new Error('Invalid published build number');
  if (versionOrder > 0 && localCode > remoteCode) return;
  if (versionOrder === 0 && localCode === remoteCode && local.sha256 === remote.sha256
      && local.bytes === remote.bytes && sourceSha === remote.source_sha) return;
  throw new Error('Refusing to overwrite a newer or different published APK');
}

async function publishedManifest(repo, tag) {
  const response = await fetch(`https://github.com/${repo}/releases/download/${tag}/app-apk-latest.json?_=${Date.now()}`,
    { signal: AbortSignal.timeout(30000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Published manifest HTTP ${response.status}`);
  return response.json();
}

async function githubAncestor(repo, older, newer, token) {
  const response = await fetch(`https://api.github.com/repos/${repo}/compare/${older}...${newer}`, {
    headers: { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Release ancestry HTTP ${response.status}`);
  const comparison = await response.json();
  return comparison.merge_base_commit?.sha === older && ['ahead', 'identical'].includes(comparison.status);
}

export async function publishApkPair({ root = mobileRoot, env = process.env, run = command,
  verify = verifyBuiltApk, readPublished = publishedManifest, isAncestor = githubAncestor } = {}) {
  const repo = env.GITHUB_REPOSITORY;
  const sourceSha = env.RELEASE_SOURCE_SHA || env.GITHUB_SHA;
  if (!repo || !/^[a-f0-9]{40}$/i.test(sourceSha ?? '')) throw new Error('Missing protected release source');
  // Check both artifacts and both rolling floors before the first mutation.
  for (const channel of channels) {
    const remote = await readPublished(repo, rollingTag(channel));
    if (remote && (!/^[a-f0-9]{40}$/i.test(remote.source_sha ?? '')
        || (remote.source_sha !== sourceSha && !await isAncestor(repo, remote.source_sha, sourceSha, env.GH_TOKEN)))) {
      throw new Error('Refusing to publish source older than a published APK');
    }
    assertPublicationAdvance(verify(root, channel), remote, sourceSha);
  }
  run(process.execPath, [join(root, 'scripts/verify-public-delivery.cjs')], { cwd: root, env });
  for (const channel of channels) {
    const directory = join(root, 'build/apk-pair', channel);
    run(process.execPath, [join(root, 'scripts/publish-apk-manifest.mjs'), '--apk', join(directory, 'app-preview.apk'),
      '--repo', repo, '--rolling-tag', rollingTag(channel)], { cwd: root, env: { ...env,
      AR_APP_NATIVE_BUNDLE_PATH: join(directory, 'index.android.bundle'),
      AR_APP_NATIVE_SOURCE_MAP_PATH: join(directory, 'index.android.bundle.map'),
    } });
    cpSync(join(root, 'build/apk-publish'), join(root, 'build/apk-published', channel), {
      recursive: true, filter: file => basename(file) !== 'app-preview.apk',
    });
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    if (process.argv[2] === 'build') buildApkPair();
    else if (process.argv[2] === 'publish') await publishApkPair();
    else throw new Error('Usage: node scripts/android-apk-pair.mjs build|publish');
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
