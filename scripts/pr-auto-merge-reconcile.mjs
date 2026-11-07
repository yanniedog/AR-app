#!/usr/bin/env node
/**
 * Unattended merge and release reconciler (run by .github/workflows/pr-auto-merge.yml).
 *
 *   node scripts/pr-auto-merge-reconcile.mjs prs [--pr N]   enable/disable auto-merge, update behind branches
 *   node scripts/pr-auto-merge-reconcile.mjs release        dispatch the APK release for unreleased main
 *
 * Never checks out or executes PR code. Required gates stay with branch protection.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { decidePullRequest, decideReleaseCatchUp, isReleasePath, needsBranchUpdate } from './lib/pr-auto-merge-policy.mjs';

const REPO = process.env.GITHUB_REPOSITORY || 'yanniedog/AR-app';
const OWNER = process.env.GITHUB_REPOSITORY_OWNER || REPO.split('/')[0];
// Agent commits are attributed to these accounts; anything else needs a human.
const TRUSTED_AUTHORS = [OWNER, 'claude', ...(process.env.AUTO_MERGE_TRUSTED_AUTHORS || '').split(',').filter(Boolean)];

function gh(args, { json = true, allowFail = false } = {}) {
  const r = spawnSync('gh', args, { encoding: 'utf8', timeout: 120_000 });
  if (r.status !== 0) {
    if (allowFail) return null;
    throw new Error(`gh ${args.join(' ')} failed: ${(r.stderr || r.error?.message || '').trim()}`);
  }
  return json ? JSON.parse(r.stdout || 'null') : r.stdout.trim();
}
const api = (path, extra = []) => gh(['api', ...extra, path]);
const paginate = path => gh(['api', '--paginate', '--slurp', path]).flat();

function autoMergeEnabled(number) {
  return gh(['pr', 'view', String(number), '--repo', REPO, '--json', 'autoMergeRequest']).autoMergeRequest != null;
}

function reconcilePull(number) {
  const pr = api(`repos/${REPO}/pulls/${number}`);
  const commits = paginate(`repos/${REPO}/pulls/${number}/commits?per_page=100`);
  const decision = decidePullRequest(pr, { owner: OWNER, repo: REPO, trustedAuthors: TRUSTED_AUTHORS,
    commitAuthors: commits.map(commit => commit.author?.login ?? null) });
  const enabled = pr.state === 'open' ? autoMergeEnabled(number) : false;
  console.log(`#${number}: ${decision.action} (${decision.reason}); auto-merge ${enabled ? 'on' : 'off'}; state ${pr.mergeable_state}`);
  if (decision.action === 'disable' && enabled) {
    gh(['pr', 'merge', String(number), '--repo', REPO, '--disable-auto'], { json: false });
    console.log(`#${number}: auto-merge disabled`);
    return;
  }
  if (decision.action !== 'enable') return;
  if (needsBranchUpdate(pr)) {
    const updated = gh(['api', '-X', 'PUT', `repos/${REPO}/pulls/${number}/update-branch`,
      '-f', `expected_head_sha=${pr.head.sha}`], { allowFail: true });
    console.log(`#${number}: ${updated ? 'branch updated from main' : 'branch update not possible (conflict or race); left for the author'}`);
  }
  if (!enabled) {
    gh(['pr', 'merge', String(number), '--repo', REPO, '--auto', '--squash', '--delete-branch'], { json: false });
    console.log(`#${number}: auto-merge enabled`);
  }
}

function reconcilePulls(only) {
  const numbers = only ? [only] : paginate(`repos/${REPO}/pulls?state=open&base=main&per_page=100`).map(pr => pr.number);
  let failures = 0;
  for (const number of numbers) {
    try { reconcilePull(number); } catch (error) { failures += 1; console.error(`#${number}: ${error.message}`); }
  }
  if (failures) process.exitCode = 1;
}

function releasedSha() {
  const release = paginate(`repos/${REPO}/releases?per_page=100`)
    .filter(item => !item.draft && item.tag_name.startsWith('app-arm-v'))
    .sort((a, b) => Date.parse(b.published_at ?? b.created_at) - Date.parse(a.published_at ?? a.created_at))[0];
  // The tag, not target_commitish (which can be a branch name), identifies the packaged commit.
  return release ? api(`repos/${REPO}/commits/${encodeURIComponent(release.tag_name)}`).sha : null;
}

function releaseCatchUp() {
  const head = api(`repos/${REPO}/commits/main`);
  const released = releasedSha();
  let mobileChanged = false;
  if (released && released !== head.sha) {
    // Full git diff, not the 300-file compare API window.
    execFileSync('git', ['fetch', '--quiet', '--filter=blob:none', 'origin', 'main', released], { stdio: 'inherit' });
    const files = execFileSync('git', ['diff', '--name-only', released, head.sha], { encoding: 'utf8' }).split('\n').filter(Boolean);
    mobileChanged = files.some(isReleasePath);
  }
  const runs = api(`repos/${REPO}/actions/workflows/mobile-android-apk.yml/runs?head_sha=${head.sha}&per_page=1`).total_count;
  const decision = decideReleaseCatchUp({ head: head.sha, headCommittedAt: head.commit.committer.date, releasedSha: released,
    mobileChanged, runsForHead: runs, now: Date.now() });
  console.log(`main ${head.sha.slice(0, 7)}, released ${released?.slice(0, 7) ?? 'none'}: ${decision.reason}`);
  if (decision.dispatch) {
    gh(['workflow', 'run', 'mobile-android-apk.yml', '--repo', REPO, '--ref', 'main'], { json: false });
    console.log('APK release dispatched');
  }
}

const [mode, flag, value] = process.argv.slice(2);
if (mode === 'prs') reconcilePulls(flag === '--pr' && value ? Number(value) : null);
else if (mode === 'release') releaseCatchUp();
else { console.error('Usage: pr-auto-merge-reconcile.mjs prs [--pr N] | release'); process.exitCode = 2; }
