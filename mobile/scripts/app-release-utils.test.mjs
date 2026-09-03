#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';

import { releaseTargetRefForRepository } from './app-release-utils.mjs';

test('uses the source SHA only when publishing into the source repository', () => {
  assert.equal(
    releaseTargetRefForRepository('yanniedog/AR-app', {
      GITHUB_REPOSITORY: 'yanniedog/AR-app',
      GITHUB_SHA: '0123456789abcdef0123456789abcdef01234567',
    }),
    '0123456789abcdef0123456789abcdef01234567',
  );
});

test('uses an explicitly pinned release source ahead of the workflow event SHA', () => {
  assert.equal(
    releaseTargetRefForRepository('yanniedog/AR-app', {
      GITHUB_REPOSITORY: 'yanniedog/AR-app',
      GITHUB_SHA: '1'.repeat(40),
      RELEASE_SOURCE_SHA: '2'.repeat(40),
    }),
    '2'.repeat(40),
  );
});

test('does not send a foreign source SHA to a cross-repository release', () => {
  assert.equal(
    releaseTargetRefForRepository('yanniedog/AR-local', {
      GITHUB_REPOSITORY: 'yanniedog/AR-app',
      GITHUB_SHA: '0123456789abcdef0123456789abcdef01234567',
    }),
    '',
  );
});
