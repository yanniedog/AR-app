#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

export function withReleaseEnvironment(easConfig, profile, version, versionCode) {
  const cleanProfile = String(profile ?? '').trim();
  const cleanVersion = String(version ?? '').trim();
  const cleanVersionCode = String(versionCode ?? '').trim();
  if (!cleanProfile || !easConfig?.build?.[cleanProfile]) {
    throw new Error(`Unknown EAS build profile: ${cleanProfile || '(empty)'}`);
  }
  if (!/^\d+\.\d+\.\d+$/.test(cleanVersion)) {
    throw new Error('AR_APP_RELEASE_VERSION must be a numeric semantic version');
  }
  if (!/^\d+$/.test(cleanVersionCode) || Number(cleanVersionCode) < 1) {
    throw new Error('AR_APP_ANDROID_VERSION_CODE must be a positive integer');
  }
  return {
    ...easConfig,
    build: {
      ...easConfig.build,
      [cleanProfile]: {
        ...easConfig.build[cleanProfile],
        env: {
          ...(easConfig.build[cleanProfile].env ?? {}),
          AR_APP_RELEASE_VERSION: cleanVersion,
          AR_APP_ANDROID_VERSION_CODE: cleanVersionCode,
        },
      },
    },
  };
}

export function injectEasReleaseEnvironment({
  profile,
  version = process.env.AR_APP_RELEASE_VERSION,
  versionCode = process.env.AR_APP_ANDROID_VERSION_CODE,
  easJsonPath = join(mobileRoot, 'eas.json'),
}) {
  const current = JSON.parse(readFileSync(easJsonPath, 'utf8'));
  const next = withReleaseEnvironment(current, profile, version, versionCode);
  writeFileSync(easJsonPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const profile = argumentValue('--profile');
    const result = injectEasReleaseEnvironment({ profile });
    console.log(
      `inject-eas-release-env: ${profile} -> v${result.build[profile].env.AR_APP_RELEASE_VERSION} (${result.build[profile].env.AR_APP_ANDROID_VERSION_CODE})`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
