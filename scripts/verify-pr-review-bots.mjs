#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
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
assert.equal(
  eventSatisfiesRequiredKey(
    'coderabbitai[bot]',
    'This reachable branch loses the release artifact and should retain it.',
    'coderabbit',
  ),
  true,
);

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
assert.equal(isReviewablePath('scripts/qwen-review.Modelfile'), true);
const changedLines = changedLinesFromDiff(
  '@@ -10,2 +10,2 @@\n-old\n+new\n context',
);
assert.deepEqual([...changedLines.left], [10]);
assert.deepEqual([...changedLines.right], [10]);
const workflow = readFileSync('.github/workflows/cursor-auto-pr-review.yml', 'utf8');
const prompt = readFileSync('.cursor/PR_REVIEW_PROMPT.md', 'utf8');
const reviewer = readFileSync('scripts/qwen-pr-review.mjs', 'utf8');
assert.match(workflow, /\bpull_request_target:/);
assert.match(workflow, /shell:\s*powershell/);
assert.doesNotMatch(workflow, /shell:\s*pwsh/);
assert.match(workflow, /ref:\s*main/);
assert.match(workflow, /persist-credentials:\s*false/g);
assert.match(workflow, /_trusted-reviewer\\scripts\\qwen-pr-review\.mjs/);
assert.doesNotMatch(workflow, /node scripts\/qwen-pr-review\.mjs/);
assert.match(workflow, /```suggestion/);
assert.match(workflow, /cancel-in-progress:\s*true/);
assert.doesNotMatch(workflow, /queue:\s*max/);
assert.match(
  workflow,
  /github\.event\.comment\.user\.type != 'Bot'[\s\S]+contains\(github\.event\.comment\.body, '@qwen-review'\)/,
);
assert.match(workflow, /DIFF_MAX_CHARS:\s*"160000"/);
assert.match(workflow, /DIFF_CHUNK_CHARS:\s*"12000"/);
assert.match(workflow, /QWEN_CONTEXT_TOKENS:\s*"8192"/);
assert.match(workflow, /refs\/pull\/\$\{\{\s*steps\.pr\.outputs\.number\s*\}\}\/head/);
assert.doesNotMatch(workflow, /Fork PRs cannot run/);
assert.match(workflow, /Reviewed files:/);
assert.match(workflow, /Omitted reviewable files:/);
assert.match(workflow, /Intentionally excluded low-signal files:/);
assert.match(workflow, /\$exists\.ToString\(\)\.ToLowerInvariant\(\)/);
assert.match(workflow, /\$finding\.side -eq 'RIGHT'/);
assert.match(workflow, /id:\s*publish/);
assert.match(workflow, /PUBLISH_OUTCOME:\s*\$\{\{\s*steps\.publish\.outcome\s*\}\}/);
assert.match(workflow, /\$env:PUBLISH_OUTCOME -ne 'success'/);
assert.match(workflow, /Format-PathList/);
assert.doesNotMatch(prompt, /## Summary/);
assert.match(prompt, /"suggested_fix"/);
assert.match(prompt, /"side"/);
assert.doesNotMatch(reviewer, /\bMAX_FILES\b/);
assert.match(reviewer, /DEFAULT_MODEL = 'qwen2\.5-coder-review:7b'/);
assert.match(reviewer, /DEFAULT_DIFF_MAX = 160_000/);
assert.match(reviewer, /--unified=5/);
assert.match(reviewer, /Qwen review budget omitted reviewable file/);
assert.match(reviewer, /excluded_files:/);
assert.match(reviewer, /DEFAULT_CHUNK_MAX = 12_000/);
assert.match(reviewer, /\/api\/chat/);
assert.doesNotMatch(reviewer, /\/chat\/completions/);
assert.match(reviewer, /num_predict:\s*500/);
assert.match(reviewer, /num_ctx:\s*contextTokens/);
assert.match(reviewer, /at most three highest-severity findings for this chunk/);
assert.match(reviewer, /chunkSections/);
assert.match(reviewer, /Qwen review chunk budget cannot safely fit file/);
assert.match(reviewer, /AbortSignal\.timeout/);
assert.match(reviewer, /UNTRUSTED_PR_DIFF_\$\{randomUUID\(\)\}/);
assert.doesNotMatch(reviewer, /'```diff'/);

const waitScript = readFileSync('wait_for_bots.mjs', 'utf8');
assert.doesNotMatch(waitScript, /const fields = '[^']*\bupdatedAt\b/);
assert.match(waitScript, /state\.anchor = anchorFromPr/);
assert.match(waitScript, /state = \{ anchor: anchorIso, readyAt: null, headSha, requiredKeys \}/);

const workflowSources = readdirSync('.github/workflows')
  .filter((name) => /\.ya?ml$/i.test(name))
  .map((name) => readFileSync(`.github/workflows/${name}`, 'utf8'))
  .join('\n');
assert.doesNotMatch(
  workflowSources,
  /\buses:\s*[^\r\n#]+@v\d+(?:\s|$)/,
  'third-party actions must use immutable commit SHAs',
);

console.log('PASS verify-pr-review-bots');
