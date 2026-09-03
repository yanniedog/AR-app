#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA_PATTERN = /^[0-9a-f]{40}$/i;

function requiredText(value, label, pattern) {
  const normalized = String(value ?? '').trim();
  if (!normalized || (pattern && !pattern.test(normalized))) {
    throw new Error(`${label} is missing or invalid`);
  }
  return normalized;
}

export function validateEasSubmitBuild({
  build,
  expectedBuildId,
  expectedPlatform,
  expectedProfile,
  expectedSourceSha,
  expectedProjectId,
  expectedOwner,
  expectedSlug,
}) {
  if (!build || typeof build !== 'object' || Array.isArray(build)) {
    throw new Error('EAS build metadata must be an object');
  }
  const buildId = requiredText(expectedBuildId, 'Expected EAS build ID', UUID_PATTERN);
  const sourceSha = requiredText(expectedSourceSha, 'Expected source SHA', SHA_PATTERN).toLowerCase();
  const platform = requiredText(expectedPlatform, 'Expected platform').toLowerCase();
  const profile = requiredText(expectedProfile, 'Expected build profile');
  if (profile !== 'production') {
    throw new Error('Only the production EAS build profile may be submitted');
  }
  if (String(build.id ?? '').toLowerCase() !== buildId.toLowerCase()) {
    throw new Error('EAS build ID does not match the requested build');
  }
  if (String(build.status ?? '').toUpperCase() !== 'FINISHED') {
    throw new Error(`EAS build is not finished (status=${String(build.status ?? 'missing')})`);
  }
  if (String(build.platform ?? '').toLowerCase() !== platform) {
    throw new Error(`EAS build platform does not match ${platform}`);
  }
  if (String(build.buildProfile ?? '') !== profile) {
    throw new Error(`EAS build profile does not match ${profile}`);
  }
  if (String(build.gitCommitHash ?? '').toLowerCase() !== sourceSha) {
    throw new Error('EAS build is not attested to the current protected-main commit');
  }
  if (build.isGitWorkingTreeDirty !== false) {
    throw new Error('EAS build source tree is dirty or its clean-tree provenance is missing');
  }
  if (String(build.app?.id ?? '') !== expectedProjectId) {
    throw new Error('EAS build belongs to a different Expo project');
  }
  if (
    String(build.app?.ownerAccount?.name ?? '') !== expectedOwner ||
    String(build.app?.slug ?? '') !== expectedSlug
  ) {
    throw new Error('EAS build belongs to a different Expo app identity');
  }
  return {
    buildId,
    platform,
    profile,
    sourceSha,
  };
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1] || process.argv[index + 1].startsWith('--')) {
    throw new Error(`Missing value for ${name}`);
  }
  return process.argv[index + 1];
}

function main() {
  const metadataPath = resolve(argumentValue('--metadata'));
  const appConfig = JSON.parse(
    readFileSync(new URL('../app.json', import.meta.url), 'utf8'),
  );
  const build = JSON.parse(readFileSync(metadataPath, 'utf8'));
  const validated = validateEasSubmitBuild({
    build,
    expectedBuildId: argumentValue('--id'),
    expectedPlatform: argumentValue('--platform'),
    expectedProfile: argumentValue('--profile'),
    expectedSourceSha: argumentValue('--source-sha'),
    expectedProjectId: String(appConfig.expo?.extra?.eas?.projectId ?? ''),
    expectedOwner: String(appConfig.expo?.owner ?? ''),
    expectedSlug: String(appConfig.expo?.slug ?? ''),
  });
  console.log(
    `verify-eas-submit-build: ${validated.buildId} is a finished ${validated.platform} ` +
      `${validated.profile} build for protected main ${validated.sourceSha.slice(0, 12)}`,
  );
}

const invoked = process.argv[1] &&
  fileURLToPath(import.meta.url).replace(/\\/g, '/') === resolve(process.argv[1]).replace(/\\/g, '/');
if (invoked) {
  try {
    main();
  } catch (error) {
    console.error(`verify-eas-submit-build: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
