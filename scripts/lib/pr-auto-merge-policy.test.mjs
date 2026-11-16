import test from 'node:test';
import assert from 'node:assert/strict';
import { decidePullRequest, isBaseSyncCommit, decideReleaseCatchUp, isReleasePath, needsBranchUpdate, RELEASE_SETTLE_MS } from './pr-auto-merge-policy.mjs';

const ctx = (commitAuthors = ['yanniedog', 'claude']) => ({ owner: 'yanniedog', repo: 'yanniedog/AR-app',
  trustedAuthors: ['yanniedog', 'claude'], commitAuthors });
const pr = (over = {}) => ({ state: 'open', draft: false, labels: [], user: { login: 'yanniedog' },
  head: { repo: { full_name: 'yanniedog/AR-app' } }, base: { ref: 'main' }, ...over });

test('owner PRs to main with trusted commits enable auto-merge', () => {
  assert.equal(decidePullRequest(pr(), ctx()).action, 'enable');
});

test('drafts and held PRs disable auto-merge', () => {
  assert.equal(decidePullRequest(pr({ draft: true }), ctx()).action, 'disable');
  assert.equal(decidePullRequest(pr({ labels: [{ name: 'hold' }] }), ctx()).action, 'disable');
});

test('forks, other authors, other bases and foreign commits are skipped', () => {
  assert.equal(decidePullRequest(pr({ head: { repo: { full_name: 'x/AR-app' } } }), ctx()).action, 'skip');
  assert.equal(decidePullRequest(pr({ user: { login: 'dependabot[bot]' } }), ctx()).action, 'skip');
  assert.equal(decidePullRequest(pr({ base: { ref: 'release' } }), ctx()).action, 'skip');
  // Owner PRs that gain foreign or unattributed commits lose auto-merge.
  assert.equal(decidePullRequest(pr(), ctx(['yanniedog', 'someone-else'])).action, 'disable');
  assert.equal(decidePullRequest(pr(), ctx(['yanniedog', null])).action, 'disable');
  assert.equal(decidePullRequest(pr(), ctx([])).action, 'disable');
  // A held non-owner PR is never touched.
  assert.equal(decidePullRequest(pr({ draft: true, user: { login: 'other' } }), ctx()).action, 'skip');
});

test('only behind branches are updated', () => {
  assert.equal(needsBranchUpdate({ mergeable_state: 'behind' }), true);
  assert.equal(needsBranchUpdate({ mergeable_state: 'blocked' }), false);
});

test('release catch-up dispatches once, after push-triggered runs had time to start', () => {
  const now = Date.parse('2026-11-07T12:00:00Z');
  const base = { head: 'b', headCommittedAt: new Date(now - RELEASE_SETTLE_MS - 1).toISOString(), releasedSha: 'a',
    mobileChanged: true, runsForHead: 0, now };
  assert.equal(decideReleaseCatchUp(base).dispatch, true);
  assert.equal(decideReleaseCatchUp({ ...base, runsForHead: 1 }).dispatch, false);
  assert.equal(decideReleaseCatchUp({ ...base, releasedSha: 'b' }).dispatch, false);
  assert.equal(decideReleaseCatchUp({ ...base, releasedSha: null }).dispatch, false);
  assert.equal(decideReleaseCatchUp({ ...base, mobileChanged: false }).dispatch, false);
  assert.equal(decideReleaseCatchUp({ ...base, headCommittedAt: new Date(now - 60_000).toISOString() }).dispatch, false);
});

test('release paths cover the app and its release workflow only', () => {
  assert.equal(isReleasePath('mobile/src/x.ts'), true);
  assert.equal(isReleasePath('.github/workflows/mobile-android-apk.yml'), true);
  assert.equal(isReleasePath('scripts/pr-merge.mjs'), false);
});

test('only genuine update-branch merges from main are recognised as sync commits', () => {
  const sync = { parentCount: 2, message: "Merge branch 'main' into ci/x", authorLogin: 'github-actions[bot]', owner: 'yanniedog', parentOnMain: true };
  assert.equal(isBaseSyncCommit(sync), true);
  assert.equal(isBaseSyncCommit({ ...sync, authorLogin: 'yanniedog' }), true);
  assert.equal(isBaseSyncCommit({ ...sync, parentOnMain: false }), false);
  assert.equal(isBaseSyncCommit({ ...sync, parentCount: 1 }), false);
  assert.equal(isBaseSyncCommit({ ...sync, message: 'Add feature' }), false);
  assert.equal(isBaseSyncCommit({ ...sync, authorLogin: 'someone-else' }), false);
});
