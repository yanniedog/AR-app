#!/usr/bin/env node
/**
 * Unique version iteration and monotonic android.versionCode for APK builds.
 * Reads version/build_number from the selected rolling manifest (if present),
 * advances the visible patch version, and increments expo.android.versionCode.
 * A fallback repo keeps the first AR-app build monotonic with the legacy AR-local
 * update channel.
 *
 * Usage: node scripts/bump-android-version-code.mjs [--repo owner/name] [--fallback-repo owner/name] [--rolling-tag app-apk-latest|app-apk-arm-latest]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  ARM_ROLLING_TAG,
  ROLLING_TAG,
  resolveApkRollingTag,
} from './app-release-meta.mjs';

const require = createRequire(import.meta.url);
const {
  mergeReleaseFloors,
  nextReleaseVersion,
  nextVersionCode,
} = require('./android-release-version-pure.cjs');

const mobileDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_ASSET = 'app-apk-latest.json';

const repoArgIdx = process.argv.indexOf('--repo');
const repo =
  (repoArgIdx >= 0 ? process.argv[repoArgIdx + 1] : process.env.GITHUB_REPOSITORY)?.trim() ||
  'yanniedog/AR-app';

const rollingTagArgIdx = process.argv.indexOf('--rolling-tag');
const rollingTagValue = rollingTagArgIdx >= 0 ? process.argv[rollingTagArgIdx + 1] : ROLLING_TAG;
if (rollingTagArgIdx >= 0 && (!rollingTagValue || rollingTagValue.startsWith('--'))) {
  throw new Error('Missing value for --rolling-tag');
}
const rollingTag = resolveApkRollingTag(rollingTagValue);

const fallbackRepoArgIdx = process.argv.indexOf('--fallback-repo');
const fallbackRepo =
  (fallbackRepoArgIdx >= 0
    ? process.argv[fallbackRepoArgIdx + 1]
    : process.env.APK_VERSION_FALLBACK_REPO
  )?.trim() || '';

const appJsonPath = join(mobileDir, 'app.json');
const appJson = JSON.parse(readFileSync(appJsonPath, 'utf8'));
const currentVersion = String(appJson.expo?.version ?? '1.0.0');
const currentCode = Number(appJson.expo?.android?.versionCode ?? 1) || 1;

export async function fetchRemoteManifest(
  targetRepo = repo,
  tag = rollingTag,
  timeoutMs = 10_000,
  fetchImpl = fetch,
) {
  if (!targetRepo) return null;
  const url = `https://github.com/${targetRepo}/releases/download/${tag}/${MANIFEST_ASSET}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();
  try {
    const res = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (res.status === 404) {
      console.log(`bump-android-version-code: no manifest at ${url}; starting from current`);
      return null;
    }
    if (!res.ok) {
      throw new Error(`Could not read release manifest at ${url} (HTTP ${res.status})`);
    }
    const manifest = await res.json();
    const buildNumber = parseInt(String(manifest.build_number ?? ''), 10);
    const version = String(manifest.version ?? '').trim();
    if (!Number.isFinite(buildNumber) || !version) {
      throw new Error(`Release manifest at ${url} is missing version or build_number`);
    }
    return { buildNumber, version };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(
        `bump-android-version-code: manifest request timed out after ${timeoutMs} ms: ${url}`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function releaseFloorTags(selectedTag) {
  const tag = resolveApkRollingTag(selectedTag);
  return tag === ARM_ROLLING_TAG
    ? [ARM_ROLLING_TAG, ROLLING_TAG]
    : [ROLLING_TAG, ARM_ROLLING_TAG];
}

async function main() {
  const [primaryTag, otherTag] = releaseFloorTags(rollingTag);
  const primaryRemote = await fetchRemoteManifest(repo, primaryTag);
  const otherChannelFloor = await fetchRemoteManifest(repo, otherTag);
  const fallbackRemote =
    primaryRemote == null && otherChannelFloor == null && fallbackRepo
      ? await fetchRemoteManifest(fallbackRepo, ROLLING_TAG)
      : null;
  const remote = mergeReleaseFloors([primaryRemote, otherChannelFloor, fallbackRemote]);
  const runFloor = Number(process.env.GITHUB_RUN_NUMBER ?? 0) || 0;
  const nextVersion = nextReleaseVersion(currentVersion, remote?.version);
  const nextCode = nextVersionCode(currentCode, remote?.buildNumber, runFloor);

  if (nextVersion === currentVersion && nextCode === currentCode) {
    console.log(
      `bump-android-version-code: version stays ${currentVersion} (${currentCode}); no prior release`,
    );
    return;
  }

  appJson.expo.version = nextVersion;
  appJson.expo.android = { ...appJson.expo.android, versionCode: nextCode };
  writeFileSync(appJsonPath, `${JSON.stringify(appJson, null, 2)}\n`, 'utf8');
  console.log(
    `bump-android-version-code: release ${currentVersion} (${currentCode}) → ${nextVersion} (${nextCode})`,
  );
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
