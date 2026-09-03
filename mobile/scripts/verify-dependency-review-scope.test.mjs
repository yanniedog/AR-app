#!/usr/bin/env node

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EAS_TOOLCHAIN_ALLOWED_GHSAS,
  EAS_TOOLCHAIN_MANIFEST,
  outOfScopeEasAdvisories,
  verifyDependencyReviewScope,
} from './verify-dependency-review-scope.mjs';

function change(manifest, ghsa = EAS_TOOLCHAIN_ALLOWED_GHSAS[0]) {
  return {
    change_type: 'added',
    manifest,
    package_url: 'pkg:npm/example@1.0.0',
    vulnerabilities: [{ advisory_ghsa_id: ghsa, severity: 'high' }],
  };
}

test('allows pinned advisories only in the isolated EAS CLI lockfile', () => {
  assert.equal(verifyDependencyReviewScope([change(EAS_TOOLCHAIN_MANIFEST)]), true);
  assert.deepEqual(outOfScopeEasAdvisories([change('./mobile/tools/eas-cli/package-lock.json')]), []);
});

test('rejects an EAS exception in the installable app dependency graph', () => {
  assert.throws(
    () => verifyDependencyReviewScope([change('mobile/package-lock.json')]),
    /escaped its isolated lockfile/,
  );
});

test('ignores removed dependencies and advisories that are not excepted', () => {
  assert.equal(verifyDependencyReviewScope([
    { ...change('mobile/package-lock.json'), change_type: 'removed' },
    change('mobile/package-lock.json', 'GHSA-safe-not-allowed'),
  ]), true);
});

test('fails closed when dependency review output is malformed', () => {
  assert.throws(() => verifyDependencyReviewScope(null), /must be an array/);
});
