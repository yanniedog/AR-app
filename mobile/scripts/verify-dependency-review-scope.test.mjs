#!/usr/bin/env node

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EAS_TOOLCHAIN_ALLOWED_GHSAS,
  EAS_TOOLCHAIN_MANIFEST,
  fetchDependencyChanges,
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

test('fetches large dependency comparisons through bounded API pages', async () => {
  const firstPage = Array.from({ length: 100 }, () => change(EAS_TOOLCHAIN_MANIFEST));
  const secondPage = [change(EAS_TOOLCHAIN_MANIFEST)];
  const requested = [];
  const changes = await fetchDependencyChanges({
    repository: 'owner/repo',
    baseSha: 'a'.repeat(40),
    headSha: 'b'.repeat(40),
    token: 'token',
    fetchImpl: async (url, options) => {
      requested.push({ url: String(url), options });
      const page = new URL(url).searchParams.get('page');
      return {
        ok: true,
        status: 200,
        json: async () => page === '1' ? firstPage : secondPage,
        text: async () => '',
      };
    },
  });
  assert.equal(changes.length, 101);
  assert.equal(requested.length, 2);
  assert.match(requested[0].url, /per_page=100&page=1/);
  assert.equal(requested[0].options.headers.Authorization, 'Bearer token');
});

test('fails closed on malformed API identity and responses', async () => {
  await assert.rejects(
    fetchDependencyChanges({
      repository: 'not-a-repository',
      baseSha: 'a'.repeat(40),
      headSha: 'b'.repeat(40),
      token: 'token',
    }),
    /owner\/name/,
  );
  await assert.rejects(
    fetchDependencyChanges({
      repository: 'owner/repo',
      baseSha: 'a'.repeat(40),
      headSha: 'b'.repeat(40),
      token: 'token',
      fetchImpl: async () => ({
        ok: false,
        status: 403,
        text: async () => 'denied',
      }),
    }),
    /HTTP 403: denied/,
  );
});
