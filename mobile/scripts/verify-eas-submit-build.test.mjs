#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';

import { validateEasSubmitBuild } from './verify-eas-submit-build.mjs';

const expected = {
  expectedBuildId: '12345678-1234-4abc-8def-1234567890ab',
  expectedPlatform: 'android',
  expectedProfile: 'production',
  expectedSourceSha: '0123456789abcdef0123456789abcdef01234567',
  expectedProjectId: '69c08d63-b618-43f1-86b9-2556eef82104',
  expectedOwner: 'yannieyannies-team',
  expectedSlug: 'ar-local-rates',
};

const validBuild = {
  id: expected.expectedBuildId,
  status: 'FINISHED',
  platform: 'ANDROID',
  buildProfile: 'production',
  gitCommitHash: expected.expectedSourceSha,
  isGitWorkingTreeDirty: false,
  app: {
    id: expected.expectedProjectId,
    slug: expected.expectedSlug,
    ownerAccount: { name: expected.expectedOwner },
  },
};

test('accepts only the exact finished protected-source production build', () => {
  assert.deepEqual(validateEasSubmitBuild({ build: validBuild, ...expected }), {
    buildId: expected.expectedBuildId,
    platform: 'android',
    profile: 'production',
    sourceSha: expected.expectedSourceSha,
  });
});

for (const [label, mutation, expectedError] of [
  ['unfinished status', { status: 'IN_QUEUE' }, /not finished/i],
  ['wrong platform', { platform: 'IOS' }, /platform does not match/i],
  ['wrong profile', { buildProfile: 'preview' }, /profile does not match/i],
  ['missing source provenance', { gitCommitHash: null }, /not attested/i],
  ['wrong source provenance', { gitCommitHash: 'f'.repeat(40) }, /not attested/i],
  ['dirty source tree', { isGitWorkingTreeDirty: true }, /source tree is dirty/i],
  ['missing clean-tree provenance', { isGitWorkingTreeDirty: undefined }, /clean-tree provenance/i],
  ['wrong project', { app: { ...validBuild.app, id: 'other-project' } }, /different Expo project/i],
]) {
  test(`rejects ${label}`, () => {
    assert.throws(
      () => validateEasSubmitBuild({ build: { ...validBuild, ...mutation }, ...expected }),
      expectedError,
    );
  });
}

test('rejects any non-production submission request', () => {
  assert.throws(
    () => validateEasSubmitBuild({
      build: validBuild,
      ...expected,
      expectedProfile: 'preview',
    }),
    /only the production/i,
  );
});
