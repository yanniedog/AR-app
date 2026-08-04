#!/usr/bin/env node
/**
 * When the last open PR to main is squash-merged, bump expo.version through a
 * bot-authored pull request. Protected main is never pushed directly.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import androidReleaseVersion from './android-release-version-pure.cjs';
import { ARM_ROLLING_TAG, versionTagForApkChannel } from './app-release-meta.mjs';
import {
  approveActionRequiredRuns,
  createHeadScopedRunTracker,
  waitForPullRequestMerge,
  workflowRunsForHead,
} from '../../scripts/lib/generated-pr-automation.mjs';
import { AUTO_RELEASE_BUMP_PREFIX } from '../../scripts/lib/pr-mobile-auto-release-commit.mjs';
import { requiredPrCheckDispatches } from '../../scripts/lib/required-pr-check-dispatch.mjs';

const { nextReleaseVersion } = androidReleaseVersion;
const mobileDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(mobileDir, '..');
const dryRun = process.argv.includes('--dry-run');

const repoArgIdx = process.argv.indexOf('--repo');
const repo =
  (repoArgIdx >= 0 ? process.argv[repoArgIdx + 1] : process.env.GITHUB_REPOSITORY)?.trim() ||
  'yanniedog/AR-app';

const ghToken = process.env.GH_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim();
const mergeSha = process.env.MERGE_SHA?.trim() || '';

export const AUTO_BUMP_PREFIX = AUTO_RELEASE_BUMP_PREFIX;
const POLL_ATTEMPTS = 6;
const POLL_SECONDS = 20;
const SPAWN_TIMEOUT_MS = 60_000;

export function checkedGhOutput(result, args = []) {
  if (result.error) {
    throw new Error(`gh ${args.join(' ')} failed to execute: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`gh ${args.join(' ')} failed: ${(result.stderr || result.stdout || '').trim()}`);
  }
  return (result.stdout || '').trim();
}

function gh(args) {
  const env = ghToken ? { ...process.env, GH_TOKEN: ghToken } : process.env;
  const res = spawnSync('gh', args, {
    encoding: 'utf8',
    cwd: repoRoot,
    env,
    timeout: SPAWN_TIMEOUT_MS,
  });
  return checkedGhOutput(res, args);
}

function ghTry(args) {
  const env = ghToken ? { ...process.env, GH_TOKEN: ghToken } : process.env;
  const res = spawnSync('gh', args, { encoding: 'utf8', cwd: repoRoot, env, timeout: SPAWN_TIMEOUT_MS });
  // A spawn failure (gh missing, timeout) is NOT "command returned non-zero" — it
  // means we couldn't determine anything, so surface it rather than mis-read it as
  // a clean negative (Gemini).
  if (res.error) {
    throw new Error(`gh ${args.join(' ')} failed to execute: ${res.error.message}`);
  }
  return { ok: res.status === 0, stdout: (res.stdout || '').trim(), stderr: (res.stderr || '').trim() };
}

function apkReleaseExists(version) {
  return ghTry([
    'release',
    'view',
    versionTagForApkChannel(version, ARM_ROLLING_TAG),
    '--repo',
    repo,
  ]).ok;
}

export function hasApkBuildInFlight(rows, expectedHeadSha) {
  return (
    Array.isArray(rows)
    && rows.some(
      (run) =>
        run?.headSha === expectedHeadSha
        && (run.status === 'queued' || run.status === 'in_progress'),
    )
  );
}

// A mobile-android-apk run is already queued/in-progress for the exact main head
// we need to ship. An older build must not suppress the new version's build.
function apkBuildInFlight(expectedHeadSha) {
  const out = ghTry([
    'run', 'list', '--workflow', 'mobile-android-apk.yml',
    '--json', 'status,headSha', '-L', '20', '--repo', repo,
  ]).stdout;
  let rows = [];
  try {
    rows = JSON.parse(out || '[]');
  } catch {
    return false;
  }
  return hasApkBuildInFlight(rows, expectedHeadSha);
}

// mobile-android-apk is intentionally dispatch-only: building the pre-bump main
// push would publish stale version metadata and duplicate the final release.
// Dispatch after the generated version PR merges. Requires actions:write.
// Failure propagates: a silent dispatch failure would leave the new version on
// main with no APK and no failing check (Codex / Sourcery).
function dispatchApkBuild(version) {
  if (dryRun) {
    console.log(`mobile-auto-release-on-drain: dry-run — would dispatch mobile-android-apk for v${version}`);
    return;
  }
  gh(['workflow', 'run', 'mobile-android-apk.yml', '--ref', 'main', '--repo', repo]);
  console.log(`mobile-auto-release-on-drain: dispatched mobile-android-apk for v${version} on main`);
}

// Build an APK for main's CURRENT version when one isn't published yet. Callers
// must only invoke this once main HEAD already carries the version to ship; the
// app-arm-v<version> + in-flight guards keep it idempotent across the many runs this
// workflow makes (once per merged PR).
export function ensureApkForMainHead({
  readVersion = readCurrentVersion,
  readHeadSha = readHeadCommitSha,
  releaseExists = apkReleaseExists,
  buildInFlight = apkBuildInFlight,
  dispatch = dispatchApkBuild,
} = {}) {
  const version = readVersion();
  const headSha = readHeadSha();
  if (releaseExists(version)) {
    console.log(
      `mobile-auto-release-on-drain: ${versionTagForApkChannel(version, ARM_ROLLING_TAG)} already published — no APK dispatch`,
    );
    return false;
  }
  if (buildInFlight(headSha)) {
    console.log(
      `mobile-auto-release-on-drain: mobile-android-apk already queued/in-progress for ${headSha.slice(0, 7)} — no APK dispatch`,
    );
    return false;
  }
  dispatch(version);
  return true;
}

function git(args, { allowFail = false } = {}) {
  const res = spawnSync('git', args, {
    encoding: 'utf8',
    cwd: repoRoot,
    timeout: SPAWN_TIMEOUT_MS,
  });
  if (res.status !== 0 && !allowFail) {
    throw new Error(`git ${args.join(' ')} failed: ${(res.stderr || res.stdout || '').trim()}`);
  }
  return (res.stdout || '').trim();
}

export function pushBranchWithGhAuth(branchName, { authenticate = gh, runGit = git } = {}) {
  authenticate(['auth', 'setup-git']);
  runGit(['push', '-u', 'origin', branchName, '--force-with-lease']);
}

function syncMain() {
  git(['fetch', 'origin', 'main', '--quiet']);
  git(['checkout', '-B', 'main', 'origin/main']);
}

function countOpenPrsToMain() {
  const raw = gh(['pr', 'list', '--state', 'open', '--base', 'main', '--json', 'number', '--repo', repo]);
  const rows = JSON.parse(raw || '[]');
  return Array.isArray(rows) ? rows.length : 0;
}

export async function waitForQueueDrain({
  countOpen = countOpenPrsToMain,
  sleep = delay,
  syncAfterDrain = syncMain,
} = {}) {
  for (let attempt = 1; attempt <= POLL_ATTEMPTS; attempt++) {
    const open = countOpen();
    if (open === 0) {
      syncAfterDrain();
      return 0;
    }
    if (open > 1) {
      console.log(
        `mobile-auto-release-on-drain: ${open} open PR(s) to main — skip release (not queue drain)`,
      );
      return open;
    }
    console.log(
      `mobile-auto-release-on-drain: ${open} open PR(s) — poll ${attempt}/${POLL_ATTEMPTS} (possible simultaneous merge)`,
    );
    if (attempt === POLL_ATTEMPTS) {
      console.log('mobile-auto-release-on-drain: queue not drained after polling — skip release');
      return open;
    }
    await sleep(POLL_SECONDS * 1000);
  }
  return countOpen();
}

function readHeadCommitMessage() {
  return git(['log', '-1', '--format=%s', 'origin/main']);
}

function readHeadCommitSha() {
  return git(['rev-parse', 'origin/main']);
}

function alreadyAutoBumpedOnHead() {
  return readHeadCommitMessage().startsWith(AUTO_BUMP_PREFIX);
}

function listOpenAutoBumpPrs(nextVersion) {
  const raw = gh([
    'pr', 'list', '--state', 'open', '--base', 'main', '--json', 'number,title,url', '--repo', repo,
  ]);
  const rows = JSON.parse(raw || '[]');
  if (!Array.isArray(rows)) return [];
  const titlePrefix = `${AUTO_BUMP_PREFIX}${nextVersion}`;
  return rows.filter((row) => row.title?.startsWith(titlePrefix));
}

function readCurrentVersion() {
  const appJson = JSON.parse(readFileSync(join(mobileDir, 'app.json'), 'utf8'));
  return String(appJson.expo?.version ?? '1.0.0').trim();
}

export function nextAutoReleaseVersion(currentVersion, publishedVersion) {
  return nextReleaseVersion(currentVersion, publishedVersion);
}

export async function readPublishedVersion(
  fetchImpl = fetch,
  { timeoutMs = 10_000, warn = console.warn } = {},
) {
  const url =
    `https://github.com/${repo}/releases/download/${ARM_ROLLING_TAG}/app-apk-latest.json` +
    `?_=${Date.now()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const manifest = await response.json();
    const version = String(manifest?.version ?? '').trim();
    if (!version) throw new Error('manifest is missing version');
    // Validate before returning; nextReleaseVersion also validates, but a
    // malformed rolling asset should take the same safe fallback as a 404.
    nextReleaseVersion('0.0.0', version);
    return version;
  } catch (error) {
    warn(
      `mobile-auto-release-on-drain: rolling APK manifest unavailable — use checked-in release floor (${String(
        error instanceof Error ? error.message : error,
      )})`,
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function bumpBranchName(nextVersion) {
  return `chore/mobile-auto-release-v${nextVersion}`;
}

function enableAutoMerge(prNumber) {
  gh(['pr', 'merge', String(prNumber), '--squash', '--auto', '--delete-branch', '--repo', repo]);
}

async function settleGeneratedPr(prNumber, branchName) {
  const runTracker = createHeadScopedRunTracker();
  const approveBlockedRuns = async () => {
    const headState = runTracker.observe(
      gh([
        'pr', 'view', String(prNumber), '--json', 'headRefOid',
        '--jq', '.headRefOid', '--repo', repo,
      ]),
    );
    let runs = [];
    const approved = await approveActionRequiredRuns({
      listRuns: () => {
        const raw = gh([
          'run', 'list', '--branch', branchName, '--event', 'pull_request',
          '--limit', '20', '--json',
          'databaseId,status,conclusion,workflowName,headSha', '--repo', repo,
        ]);
        runs = workflowRunsForHead(JSON.parse(raw || '[]'), headState.headSha);
        return runs;
      },
      approveRun: (runId) =>
        gh(['api', '--method', 'POST', `repos/${repo}/actions/runs/${runId}/approve`]),
      seenRunIds: headState.seenRunIds,
    });
    if (approved.length > 0) {
      console.log(`mobile-auto-release-on-drain: approved ${approved.length} generated-PR workflow run(s)`);
    }
    if (headState.shouldCheckFallback) {
      runTracker.markFallbackChecked();
      dispatchMissingRequiredPrChecks(
        prNumber,
        branchName,
        runs.map((run) => run?.workflowName),
      );
    }
    return { resetWait: headState.headChanged };
  };
  enableAutoMerge(prNumber);
  await waitForPullRequestMerge({
    beforeRead: approveBlockedRuns,
    readState: () =>
      gh(['pr', 'view', String(prNumber), '--json', 'state', '--jq', '.state', '--repo', repo]),
  });
  console.log(`mobile-auto-release-on-drain: generated PR #${prNumber} merged`);
}

function dispatchMissingRequiredPrChecks(prNumber, branchName, observedWorkflowNames) {
  const dispatches = requiredPrCheckDispatches(prNumber, branchName, observedWorkflowNames);
  for (const dispatch of dispatches) {
    gh([
      'workflow',
      'run',
      dispatch.workflow,
      '--ref',
      dispatch.ref,
      ...dispatch.inputs,
      '--repo',
      repo,
    ]);
  }
  if (dispatches.length > 0) {
    console.log(
      `mobile-auto-release-on-drain: dispatched ${dispatches.length} missing required check(s) for PR #${prNumber}`,
    );
  }
  return dispatches.length;
}

async function publishViaPullRequest(next, message) {
  const branchName = bumpBranchName(next);
  const existing = listOpenAutoBumpPrs(next);
  if (existing.length > 0) {
    const pr = existing[0];
    console.log(`mobile-auto-release-on-drain: open bump PR #${pr.number} (${pr.url}) — ensure auto-merge`);
    await settleGeneratedPr(pr.number, branchName);
    return pr.number;
  }

  git(
    [
      'fetch',
      'origin',
      `+refs/heads/${branchName}:refs/remotes/origin/${branchName}`,
    ],
    { allowFail: true },
  );
  git(['checkout', '-B', branchName]);
  pushBranchWithGhAuth(branchName);

  const prHint = mergeSha ? `\n- Trigger merge: \`${mergeSha.slice(0, 7)}\`` : '';
  const body = [
    'Automated patch version bump after the PR queue to `main` drained.',
    '',
    `- Version: **${next}**${prHint}`,
    '',
    'Bot-authored auto-release PR. Auto-merge is enabled; **mobile-android-apk** builds when this lands on `main`.',
  ].join('\n');

  const prUrl = gh([
    'pr', 'create', '--base', 'main', '--head', branchName, '--title', message, '--body', body, '--repo', repo,
  ]);
  const prNumber = prUrl.match(/\/pull\/(\d+)/)?.[1];
  if (!prNumber) throw new Error(`mobile-auto-release-on-drain: could not parse PR number from ${prUrl}`);

  await settleGeneratedPr(prNumber, branchName);
  console.log(`mobile-auto-release-on-drain: opened fallback PR #${prNumber} with auto-merge (${prUrl})`);
  return Number(prNumber);
}

async function main() {
  if (!ghToken && !dryRun) {
    console.error('mobile-auto-release-on-drain: GH_TOKEN is not set');
    process.exit(1);
  }

  syncMain();

  const remaining = dryRun ? 0 : await waitForQueueDrain();
  if (dryRun) console.log('mobile-auto-release-on-drain: dry-run — skipping open PR count (assume drained)');
  if (remaining !== 0) process.exit(0);

  if (alreadyAutoBumpedOnHead()) {
    console.log(`mobile-auto-release-on-drain: origin/main already at auto-release bump (${readHeadCommitSha()}) — skip`);
    // main carries a bumped version; ensure its APK exists (covers the fallback
    // bump-PR path, whose GITHUB_TOKEN merge can't trigger the build on push).
    ensureApkForMainHead();
    process.exit(0);
  }

  const current = readCurrentVersion();
  const published = await readPublishedVersion();
  const next = nextAutoReleaseVersion(current, published);
  console.log(
    `mobile-auto-release-on-drain: queue drained — source ${current}, published ${published}, next ${next}`,
  );

  if (next === current) {
    console.log(
      `mobile-auto-release-on-drain: source v${current} is already the next iteration — ensure APK`,
    );
    ensureApkForMainHead();
    process.exit(0);
  }

  const pending = listOpenAutoBumpPrs(next);
  if (pending.length > 0) {
    console.log(`mobile-auto-release-on-drain: bump PR already open for v${next} (#${pending[0].number}) — skip`);
    const branchName = bumpBranchName(next);
    await settleGeneratedPr(pending[0].number, branchName);
    syncMain();
    ensureApkForMainHead();
    process.exit(0);
  }

  if (dryRun) {
    console.log(`mobile-auto-release-on-drain: dry-run — would open an auto-release PR for v${next}`);
    process.exit(0);
  }

  const bump = spawnSync(
    'node',
    ['scripts/bump-app-patch-version.mjs', '--to', next],
    { encoding: 'utf8', cwd: mobileDir },
  );
  if (bump.status !== 0) throw new Error((bump.stderr || bump.stdout || 'bump-app-patch-version failed').trim());

  const ensureEntry = spawnSync(
    'node',
    ['scripts/ensure-changelog-entry.mjs', '--version', next, '--repo', repo],
    { encoding: 'utf8', cwd: mobileDir },
  );
  if (ensureEntry.status !== 0) {
    throw new Error((ensureEntry.stderr || ensureEntry.stdout || 'ensure-changelog-entry failed').trim());
  }

  const buildManifest = spawnSync('node', ['scripts/build-changelog-manifest.mjs', '--repo', repo], {
    encoding: 'utf8',
    cwd: mobileDir,
  });
  if (buildManifest.status !== 0) {
    throw new Error((buildManifest.stderr || buildManifest.stdout || 'build-changelog-manifest failed').trim());
  }

  git(['config', 'user.name', 'github-actions[bot]']);
  git(['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
  git(['add', 'mobile/app.json', 'mobile/changelog/']);

  const prHint = mergeSha ? ` (after ${mergeSha.slice(0, 7)})` : '';
  const message = `${AUTO_BUMP_PREFIX}${next}${prHint}`;
  git(['commit', '-m', message]);

  await publishViaPullRequest(next, message);
  syncMain();
  ensureApkForMainHead();
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
