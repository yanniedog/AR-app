#!/usr/bin/env node
/**
 * Bump expo.version patch segment in mobile/app.json (semver x.y.z → x.y.(z+1)).
 *
 * Usage: node scripts/bump-app-patch-version.mjs [--dry-run]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import androidReleaseVersion from './android-release-version-pure.cjs';
import { bumpPatchVersion } from './bump-app-patch-version-pure.cjs';

const { compareVersions } = androidReleaseVersion;
const mobileDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const appJsonPath = join(mobileDir, 'app.json');
const dryRun = process.argv.includes('--dry-run');
const targetArgIndex = process.argv.indexOf('--to');
const requestedTarget =
  targetArgIndex >= 0 ? String(process.argv[targetArgIndex + 1] ?? '').trim() : '';

const appJson = JSON.parse(readFileSync(appJsonPath, 'utf8'));
const current = String(appJson.expo?.version ?? '1.0.0').trim();
let next = bumpPatchVersion(current);
if (targetArgIndex >= 0) {
  try {
    if (!requestedTarget || compareVersions(requestedTarget, current) <= 0) {
      throw new Error('target must be newer than the checked-in version');
    }
    next = requestedTarget;
  } catch (err) {
    console.error(
      `bump-app-patch-version: invalid --to "${requestedTarget}": ${String(
        err instanceof Error ? err.message : err,
      )}`,
    );
    process.exit(1);
  }
}

if (next === current) {
  console.error(`bump-app-patch-version: cannot bump invalid version "${current}"`);
  process.exit(1);
}

if (dryRun) {
  console.log(`bump-app-patch-version: dry-run ${current} → ${next}`);
  process.exit(0);
}

if (!appJson.expo || typeof appJson.expo !== 'object') {
  appJson.expo = {};
}
appJson.expo.version = next;
writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n', 'utf8');
console.log(`bump-app-patch-version: ${current} → ${next}`);
