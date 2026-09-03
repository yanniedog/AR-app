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

async function main() {
  const repo = process.env.GITHUB_REPOSITORY?.trim();
  const requestedSha = process.env.GITHUB_SHA?.trim();
  if (!repo || !requestedSha) throw new Error('GITHUB_REPOSITORY and GITHUB_SHA are required');

  const pulls = await githubJson(repo, `/commits/${requestedSha}/pulls`);
  let lastMissing = REQUIRED_PR_CHECKS;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    // Re-read main on every attempt so a queued publisher cannot proceed after
    // a newer pull request lands while it waits for the selected head's gates.
    const ref = await githubJson(repo, '/git/ref/heads/main');
    const preliminary = validateReleaseSourceSnapshot({
      mainSha: ref?.object?.sha,
      requestedSha,
      pulls,
      checkRuns: [],
    });
    const result = await githubJson(
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
      return;
    }
    if (attempt < 59) await delay(20_000);
  }
  throw new Error(`Required pull-request checks did not pass: ${lastMissing.join(', ')}`);
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('verify-github-release-source.mjs')) {
  main().catch((error) => {
    console.error(`verify-github-release-source: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
