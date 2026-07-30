#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import {
  eventSatisfiesRequiredKey,
  missingRequiredKeysFromEvents,
  reviewedCommitFromBody,
} from './lib/bot-wait-config.mjs';
import { isBotNoise } from './lib/bot-noise.mjs';
import {
  loginMatchesBotKey,
  loginToBotKey,
  SPREADSHEET_BOT_KEYS,
} from './lib/pr-bot-roster.mjs';
import { changedLinesFromDiff, isReviewablePath } from './qwen-pr-review.mjs';

const sha = '0123456789abcdef0123456789abcdef01234567';
const qwenSuccess = [
  '<!-- qwen-code-review -->',
  '## Qwen Code Review',
  `Reviewed commit: \`${sha}\``,
  'Review outcome: findings',
  'A substantive review finding that is long enough to be meaningful.',
].join('\n');
const qwenFailure = qwenSuccess.replace('Review outcome: findings', 'Review outcome: failed')
  + '\nQwen Code Review did not complete successfully.';

assert.equal(reviewedCommitFromBody(qwenSuccess), sha);
assert.equal(
  eventSatisfiesRequiredKey('github-actions[bot]', qwenSuccess, 'qwen', {
    expectedHeadSha: sha,
  }),
  true,
);
assert.equal(
  eventSatisfiesRequiredKey('github-actions[bot]', qwenSuccess, 'qwen', {
    expectedHeadSha: 'f'.repeat(40),
  }),
  false,
);
assert.equal(eventSatisfiesRequiredKey('github-actions[bot]', qwenFailure, 'qwen'), false);
assert.equal(
  eventSatisfiesRequiredKey(
    'github-actions[bot]',
    `${qwenSuccess}\nThe finding discusses HTTP 429 handling.`,
    'qwen',
    { expectedHeadSha: sha },
  ),
  true,
);
assert.deepEqual(
  missingRequiredKeysFromEvents(
    ['qwen'],
    [{ login: 'github-actions[bot]', body: qwenSuccess }],
    { expectedHeadSha: sha },
  ),
  [],
);

assert.equal(isBotNoise('ERROR: Gemini API returned HTTP 503'), true);
assert.equal(isBotNoise('The consumer version has been sunset; review activity has ceased.'), true);
assert.equal(eventSatisfiesRequiredKey('github-actions[bot]', 'ERROR: Gemini 429', 'gemini'), false);

assert.equal(loginToBotKey('github-actions[bot]', qwenSuccess), 'qwen');
assert.equal(loginToBotKey('coderabbitai', 'A real review comment with actionable detail.'), 'coderabbit');
assert.equal(loginToBotKey('coderabbitai[bot]', 'A real review comment with actionable detail.'), 'coderabbit');
assert.equal(
  loginMatchesBotKey('cursor[bot]', 'cursor', '## Feedback plan\n- implement every thread'),
  false,
);
assert.equal(
  loginMatchesBotKey(
    'cursor[bot]',
    'cursor',
    '<!-- CURSOR_AUTOMATION_ID: review -->\n## Cursor Code Review\nVerdict: PASS',
  ),
  true,
);
assert.equal(loginMatchesBotKey('cursor[bot]', 'codex', 'Cursor review housekeeping'), false);
assert(SPREADSHEET_BOT_KEYS.includes('qwen'));
assert(SPREADSHEET_BOT_KEYS.includes('cursor'));
assert.equal(isReviewablePath('.github/workflows/app-ci.yml'), true);
assert.equal(isReviewablePath('scripts/wait-for-bots.mjs'), true);
assert.equal(isReviewablePath('mobile/package-lock.json'), false);
assert.equal(isReviewablePath('README.md'), false);
const changedLines = changedLinesFromDiff(
  '@@ -10,2 +10,2 @@\n-old\n+new\n context',
);
assert.deepEqual([...changedLines.left], [10]);
assert.deepEqual([...changedLines.right], [10]);
const workflow = readFileSync('.github/workflows/cursor-auto-pr-review.yml', 'utf8');
const prompt = readFileSync('.cursor/PR_REVIEW_PROMPT.md', 'utf8');
assert.match(workflow, /\bpull_request_target:/);
assert.match(workflow, /ref:\s*main/);
assert.match(workflow, /persist-credentials:\s*false/g);
assert.match(workflow, /_trusted-reviewer\\scripts\\qwen-pr-review\.mjs/);
assert.doesNotMatch(workflow, /node scripts\/qwen-pr-review\.mjs/);
assert.match(workflow, /```suggestion/);
assert.match(workflow, /cancel-in-progress:\s*false/);
assert.match(workflow, /queue:\s*max/);
assert.match(workflow, /DIFF_MAX_CHARS:\s*"120000"/);
assert.doesNotMatch(workflow, /DIFF_CHUNK_CHARS/);
assert.match(workflow, /\$exists\.ToString\(\)\.ToLowerInvariant\(\)/);
assert.match(workflow, /\$finding\.side -eq 'RIGHT'/);
assert.doesNotMatch(prompt, /## Summary/);
assert.match(prompt, /"suggested_fix"/);
assert.match(prompt, /"side"/);

const waitScript = readFileSync('wait_for_bots.mjs', 'utf8');
assert.doesNotMatch(waitScript, /\bupdatedAt\b/);
assert.match(waitScript, /state\.anchor = anchorFromPr/);

console.log('PASS verify-pr-review-bots');
