#!/usr/bin/env node
/* global AbortController, clearTimeout, setTimeout */
import { setTimeout as delay } from 'node:timers/promises';

const REQUIRED_PR_CHECKS = ['mobile-ci', 'bot-feedback-gate'];

export function validateReleaseSourceSnapshot({ mainSha, requestedSha, pulls, checkRuns }) {
  if (!/^[a-f0-9]{40}$/i.test(requestedSha ?? '') || mainSha !== requestedSha) {
    throw new Error('Release checkout is not the current main commit');
  }
  const pull = pulls.find((candidate) =>
    candidate?.merged_at &&
    candidate?.base?.ref === 'main' &&
    candidate?.merge_commit_sha === requestedSha,
  );
  if (!pull?.head?.sha) {
    throw new Error('Current main commit is not backed by a merged pull request');
  }
  const missingChecks = REQUIRED_PR_CHECKS.filter((name) =>
    !checkRuns.some((run) => run?.name === name && run?.conclusion === 'success'),
  );
  return { pull, missingChecks };
}

async function githubJson(repo, path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`https://api.github.com/repos/${repo}${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(process.env.GH_TOKEN ? { Authorization: `Bearer ${process.env.GH_TOKEN}` } : {}),
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`GitHub ${path} returned HTTP ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function verifyGithubReleaseSource({
  repo,
  requestedSha,
  readJson = githubJson,
  sleep = delay,
  attempts = 60,
} = {}) {
  if (!repo || !requestedSha) throw new Error('GITHUB_REPOSITORY and GITHUB_SHA are required');

  let lastMissing = REQUIRED_PR_CHECKS;
  let lastAssociationError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    // Re-read main on every attempt so a queued publisher cannot proceed after
    // a newer pull request lands while it waits for the selected head's gates.
    const ref = await readJson(repo, '/git/ref/heads/main');
    if (ref?.object?.sha !== requestedSha) {
      throw new Error('Release checkout is not the current main commit');
    }
    // GitHub's commit-to-PR association can lag immediately after a squash
    // merge. Fetch and validate it inside the same retry window as check runs.
    const pulls = await readJson(repo, `/commits/${requestedSha}/pulls`);
    let preliminary;
    try {
      preliminary = validateReleaseSourceSnapshot({
        mainSha: ref?.object?.sha,
        requestedSha,
        pulls,
        checkRuns: [],
      });
      lastAssociationError = null;
    } catch (error) {
      lastAssociationError = error instanceof Error ? error : new Error(String(error));
      if (attempt < attempts - 1) {
        await sleep(20_000);
        continue;
      }
      break;
    }
    const result = await readJson(
      repo,
      `/commits/${preliminary.pull.head.sha}/check-runs?per_page=100`,
    );
    const validated = validateReleaseSourceSnapshot({
      mainSha: ref?.object?.sha,
      requestedSha,
      pulls,
      checkRuns: result?.check_runs ?? [],
    });
    lastMissing = validated.missingChecks;
    if (!lastMissing.length) {
      console.log(
        `verify-github-release-source: main ${requestedSha.slice(0, 12)} from merged PR #${validated.pull.number}; required PR checks passed`,
      );
      return validated;
    }
    if (attempt < attempts - 1) await sleep(20_000);
  }
  if (lastAssociationError) throw lastAssociationError;
  throw new Error(`Required pull-request checks did not pass: ${lastMissing.join(', ')}`);
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY?.trim();
  const requestedSha = process.env.GITHUB_SHA?.trim();
  await verifyGithubReleaseSource({ repo, requestedSha });
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('verify-github-release-source.mjs')) {
  main().catch((error) => {
    console.error(`verify-github-release-source: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
