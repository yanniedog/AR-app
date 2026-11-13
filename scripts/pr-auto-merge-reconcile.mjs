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
import { decidePullRequest, decideReleaseCatchUp, isBaseSyncCommit, isReleasePath, needsBranchUpdate } from './lib/pr-auto-merge-policy.mjs';

const REPO = process.env.GITHUB_REPOSITORY || 'yanniedog/AR-app';
const OWNER = process.env.GITHUB_REPOSITORY_OWNER || REPO.split('/')[0];
// Agent commits are attributed to these accounts; anything else needs a human.
const WORKFLOW_ACTOR = 'github-actions[bot]';
// clean: all checks green. unstable: required gates green, an advisory check failed.
// Branch protection still enforces the required gates on the merge call itself.
const MERGEABLE_STATES = new Set(['clean', 'unstable']);
const TRUSTED_AUTHORS = [OWNER, 'claude', ...(process.env.AUTO_MERGE_TRUSTED_AUTHORS || '').split(',').filter(Boolean)];

function gh(args, { json = true, allowFail = false } = {}) {
  const r = spawnSync('gh', args, { encoding: 'utf8', timeout: 120_000, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) {
    if (allowFail) return null;
    throw new Error(`gh ${args.join(' ')} failed: ${(r.stderr || r.error?.message || '').trim()}`);
  }
  return json ? JSON.parse(r.stdout || 'null') : r.stdout.trim();
}
const api = (path, extra = []) => gh(['api', ...extra, path]);
const paginate = path => gh(['api', '--paginate', '--slurp', path]).flat();

/** True when sha is an ancestor of (or equal to) main. */
function onMain(sha) {
  const status = gh(['api', `repos/${REPO}/compare/${sha}...main`, '--jq', '.status'], { json: false, allowFail: true });
  return status === 'ahead' || status === 'identical';
}

function reconcilePull(number) {
  const pr = api(`repos/${REPO}/pulls/${number}`);
  const listed = paginate(`repos/${REPO}/pulls/${number}/commits?per_page=100`);
  // The endpoint stops at 250 commits; an incomplete list cannot establish trust.
  const commits = listed.length === pr.commits ? listed : [];
  const authored = commits.filter(commit => !isBaseSyncCommit({ parentCount: commit.parents?.length ?? 0,
    message: commit.commit?.message, authorLogin: commit.author?.login ?? null, owner: OWNER,
    parentOnMain: (commit.parents?.length ?? 0) === 2 && commit.parents.some(parent => onMain(parent.sha)) }));
  const decision = decidePullRequest(pr, { owner: OWNER, repo: REPO, trustedAuthors: TRUSTED_AUTHORS,
    commitAuthors: authored.map(commit => commit.author?.login ?? null) });
  const enabled = pr.state === 'open' && pr.auto_merge != null;
  const enabledBy = pr.auto_merge?.enabled_by?.login ?? null;
  console.log(`#${number}: ${decision.action} (${decision.reason}); auto-merge ${enabled ? 'on' : 'off'}; state ${pr.mergeable_state}`);
  if (decision.action === 'disable' && enabled) {
    gh(['pr', 'merge', String(number), '--repo', REPO, '--disable-auto'], { json: false });
    console.log(`#${number}: auto-merge disabled`);
    return;
  }
  if (decision.action !== 'enable') return;
  if (needsBranchUpdate(pr)) {
    if (process.env.OWNER_TOKEN_CONFIGURED === 'true') {
      // An owner-token push fires the normal pull_request workflows, so every
      // required check (including dependency review) reruns on the new head.
      const updated = gh(['api', '-X', 'PUT', `repos/${REPO}/pulls/${number}/update-branch`,
        '-f', `expected_head_sha=${pr.head.sha}`], { allowFail: true });
      console.log(`#${number}: ${updated ? 'branch updated from main' : 'branch update not possible (conflict or race); left for the author'}`);
    } else {
      // A workflow-token push fires no pull_request workflows; never substitute
      // reduced dispatched checks for the real ones. Leave the update to the agent.
      console.log(`#${number}: behind main; branch update needs BOT_GATE_TOKEN, left for the author`);
    }
  }
  if (process.env.OWNER_TOKEN_CONFIGURED === 'true') {
    if (!enabled) {
      gh(['pr', 'merge', String(number), '--repo', REPO, '--auto', '--squash', '--delete-branch'], { json: false });
      console.log(`#${number}: auto-merge enabled`);
    }
    return;
  }
  // Workflow token only: a merge made with it fires no push workflows, so
  // auto-merge would land without a release. Merge directly once GitHub reports
  // every required gate satisfied, then dispatch the release ourselves.
  if (enabled && enabledBy !== WORKFLOW_ACTOR) { console.log(`#${number}: auto-merge enabled by ${enabledBy}; GitHub merges it`); return; }
  if (enabled) {
    // Left by an earlier workflow-token run; it would merge without a release.
    gh(['pr', 'merge', String(number), '--repo', REPO, '--disable-auto'], { json: false });
    console.log(`#${number}: workflow-token auto-merge replaced by direct merge`);
  }
  if (!MERGEABLE_STATES.has(pr.mergeable_state)) { console.log(`#${number}: waiting for required gates (${pr.mergeable_state})`); return; }
  // Re-read just before merging so a hold, draft or new push since the decision wins.
  const fresh = api(`repos/${REPO}/pulls/${number}`);
  if (fresh.head.sha !== pr.head.sha || decidePullRequest(fresh, { owner: OWNER, repo: REPO, trustedAuthors: TRUSTED_AUTHORS,
    commitAuthors: authored.map(commit => commit.author?.login ?? null) }).action !== 'enable' || !MERGEABLE_STATES.has(fresh.mergeable_state)) {
    console.log(`#${number}: changed since evaluation; retrying on the next run`);
    return;
  }
  const merged = gh(['api', '-X', 'PUT', `repos/${REPO}/pulls/${number}/merge`, '-f', 'merge_method=squash',
    '-f', `sha=${pr.head.sha}`], { allowFail: true });
  if (!merged?.merged) { console.log(`#${number}: merge refused (head moved or gates changed); retrying on the next run`); return; }
  // The repository deletes merged head branches itself (delete_branch_on_merge).
  console.log(`#${number}: merged as ${merged.sha.slice(0, 7)}`);
  const files = paginate(`repos/${REPO}/pulls/${number}/files?per_page=100`).map(file => file.filename);
  const runs = api(`repos/${REPO}/actions/workflows/mobile-android-apk.yml/runs?head_sha=${merged.sha}&per_page=1`).total_count;
  if (files.some(isReleasePath) && runs === 0) {
    gh(['workflow', 'run', 'mobile-android-apk.yml', '--repo', REPO, '--ref', 'main'], { json: false });
    console.log(`#${number}: APK release dispatched`);
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
  // Project only the fields used, so history size cannot exhaust the buffer.
  const release = gh(['api', '--paginate', `repos/${REPO}/releases?per_page=100`, '--jq',
    '.[] | {tag_name, draft, published_at, created_at}'], { json: false })
    .split('\n').filter(Boolean).map(line => JSON.parse(line))
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
