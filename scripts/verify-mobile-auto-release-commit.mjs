#!/usr/bin/env node
import {
  AUTO_RELEASE_BUMP_PREFIX,
  isAutoReleaseCommitOnly,
  isAutoReleaseCommitPath,
} from './lib/pr-mobile-auto-release-commit.mjs';
import { isGateExemptFileList } from './lib/pr-gate-exempt.mjs';

const failures = [];

for (const [path, want] of [
  ['mobile/app.json', true],
  ['mobile/changelog/versions/1.0.8.json', true],
  ['mobile/package.json', false],
]) {
  if (isAutoReleaseCommitPath(path) !== want) failures.push(`isAutoReleaseCommitPath(${path})`);
}

if (!isAutoReleaseCommitOnly(['mobile/app.json', 'mobile/changelog/manifest.json'])) {
  failures.push('isAutoReleaseCommitOnly');
}
if (isGateExemptFileList(['reports/pr-bot-matrix.html']) !== true) failures.push('gate exempt reports');
if (!AUTO_RELEASE_BUMP_PREFIX.includes('auto-release')) failures.push('AUTO_RELEASE_BUMP_PREFIX');

if (failures.length) {
  console.error('FAIL verify-mobile-auto-release-commit:', failures.join(', '));
  process.exit(1);
}
console.log('PASS verify-mobile-auto-release-commit');
