#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import {
  DEFAULT_REQUIRED_KEYS,
  eventSatisfiesRequiredKey,
  missingRequiredKeysFromEvents,
  parseRequiredKeys,
  reviewedCommitFromBody,
  resolveRequiredKeys,
} from "./lib/bot-wait-config.mjs";
import { isBotNoise } from "./lib/bot-noise.mjs";
import {
  loginMatchesBotKey,
  loginToBotKey,
  SPREADSHEET_BOT_KEYS,
} from "./lib/pr-bot-roster.mjs";
import { changedLinesFromDiff, isReviewablePath } from "./qwen-pr-review.mjs";
import {
  combineRequiredCheckState,
  renderDashboard,
  requiredChecksFromProtection,
  requiredChecksFromRules,
  workflowNeedsStateChange,
} from "./review-bot-control.mjs";
import { evaluateRequiredCheckState } from "./lib/required-ci-checks.mjs";

function indentedBlock(source, heading) {
  const lines = source.split(/\r?\n/);
  const start = lines.indexOf(heading);
  assert.notEqual(start, -1, `missing block heading: ${heading}`);
  const indentation = heading.match(/^\s*/)[0].length;
  const block = [lines[start]];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() && line.match(/^\s*/)[0].length <= indentation) {
      break;
    }
    block.push(line);
  }
  return block.join("\n");
}

function markedBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing start marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing end marker: ${endMarker}`);
  return source.slice(start, end + endMarker.length);
}

const sha = "0123456789abcdef0123456789abcdef01234567";
const qwenSuccess = [
  "<!-- qwen-code-review -->",
  "## Qwen Code Review",
  `Reviewed commit: \`${sha}\``,
  "Review outcome: findings",
  "A substantive review finding that is long enough to be meaningful.",
].join("\n");
const qwenFailure =
  qwenSuccess.replace("Review outcome: findings", "Review outcome: failed") +
  "\nQwen Code Review did not complete successfully.";

assert.deepEqual(DEFAULT_REQUIRED_KEYS, []);
assert.equal(workflowNeedsStateChange("disabled_manually", false), false);
assert.equal(workflowNeedsStateChange("active", true), false);
assert.equal(workflowNeedsStateChange("active", false), true);
assert.equal(workflowNeedsStateChange("disabled_manually", true), true);
assert.deepEqual(parseRequiredKeys("off"), []);
assert.deepEqual(parseRequiredKeys("none"), []);
assert.deepEqual(parseRequiredKeys("disabled"), []);
assert.deepEqual(parseRequiredKeys("qwen,coderabbit"), ["qwen", "coderabbit"]);
assert.deepEqual(resolveRequiredKeys([], "qwen"), []);
assert.deepEqual(
  requiredChecksFromProtection({
    required_status_checks: {
      checks: [{ context: "mobile-ci" }],
      contexts: ["bot-feedback-gate"],
    },
  }),
  ["mobile-ci", "bot-feedback-gate"],
);
assert.deepEqual(
  requiredChecksFromRules([
    {
      type: "required_status_checks",
      parameters: {
        required_status_checks: [
          { context: "mobile-ci" },
          { context: "bot-feedback-gate" },
        ],
      },
    },
  ]),
  ["mobile-ci", "bot-feedback-gate"],
);
assert.deepEqual(
  combineRequiredCheckState({
    protectionOk: true,
    protection: {
      required_status_checks: { checks: [{ context: "mobile-ci" }] },
    },
    rulesOk: true,
    rules: [
      {
        type: "required_status_checks",
        parameters: {
          required_status_checks: [{ context: "bot-feedback-gate" }],
        },
      },
    ],
  }),
  {
    values: ["mobile-ci", "bot-feedback-gate"],
    source: "live branch protection + rules",
  },
);
assert.deepEqual(
  evaluateRequiredCheckState({
    requiredNames: ["mobile-ci", "bot-feedback-gate"],
    ignoredNames: ["bot-feedback-gate"],
    prChecks: [],
    headCheckRuns: [
      {
        id: 10,
        name: "mobile-ci",
        status: "queued",
        started_at: "2026-01-01T00:00:00Z",
      },
    ],
  }),
  {
    pending: true,
    failed: false,
    failedNames: [],
    pendingNames: ["mobile-ci"],
    missingNames: [],
    checks: [{ name: "mobile-ci", state: "pending" }],
  },
);
assert.deepEqual(
  evaluateRequiredCheckState({
    requiredNames: ["mobile-ci"],
    prChecks: [],
    headCheckRuns: [],
  }).missingNames,
  ["mobile-ci"],
);
assert.equal(
  evaluateRequiredCheckState({
    requiredNames: ["mobile-ci"],
    prChecks: [
      {
        name: "mobile-ci",
        bucket: "pass",
        startedAt: "2026-01-01T00:00:00Z",
      },
    ],
    headCheckRuns: [
      {
        id: 11,
        name: "mobile-ci",
        status: "in_progress",
        started_at: "2026-01-01T00:01:00Z",
      },
    ],
  }).pending,
  true,
);
assert.deepEqual(
  combineRequiredCheckState({
    protectionOk: false,
    protection: null,
    rulesOk: true,
    rules: [],
  }),
  { values: [], source: "live rules" },
);
assert.deepEqual(
  combineRequiredCheckState({
    protectionOk: false,
    protection: null,
    rulesOk: false,
    rules: null,
  }),
  {
    values: ["mobile-ci", "bot-feedback-gate"],
    source: "configured policy fallback; live policy APIs unavailable",
  },
);
const dashboardFixture = renderDashboard({
  repo: "owner/repo",
  qwenState: "disabled_manually",
  presenceState: "disabled_manually",
  feedbackState: "active",
  coderabbitRetryState: "active",
  checks: ["mobile-ci", "bot-feedback-gate"],
  checkSource: "live branch rules",
  updatedAt: "2026-01-01T00:00:00.000Z",
});
assert.match(
  dashboardFixture,
  /Required checks on `main` \(live branch rules\)/,
);
assert.match(
  renderDashboard({
    repo: "owner/repo",
    qwenState: "disabled_manually",
    presenceState: "disabled_manually",
    feedbackState: "active",
    coderabbitRetryState: "active",
    checks: [],
    checkSource: "live rules",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }),
  /Required checks on `main` \(live rules\): \*\*None\*\*/,
);
assert.equal(reviewedCommitFromBody(qwenSuccess), sha);
assert.equal(
  eventSatisfiesRequiredKey("github-actions[bot]", qwenSuccess, "qwen", {
    expectedHeadSha: sha,
  }),
  true,
);
assert.equal(
  eventSatisfiesRequiredKey("github-actions[bot]", qwenSuccess, "qwen", {
    expectedHeadSha: "f".repeat(40),
  }),
  false,
);
assert.equal(
  eventSatisfiesRequiredKey("github-actions[bot]", qwenFailure, "qwen"),
  false,
);
assert.equal(
  eventSatisfiesRequiredKey(
    "github-actions[bot]",
    `${qwenSuccess}\nThe finding discusses HTTP 429 handling.`,
    "qwen",
    { expectedHeadSha: sha },
  ),
  true,
);
assert.deepEqual(
  missingRequiredKeysFromEvents(
    ["qwen"],
    [{ login: "github-actions[bot]", body: qwenSuccess }],
    { expectedHeadSha: sha },
  ),
  [],
);

assert.equal(isBotNoise("ERROR: Gemini API returned HTTP 503"), true);
assert.equal(
  isBotNoise(
    "The consumer version has been sunset; review activity has ceased.",
  ),
  true,
);
assert.equal(
  eventSatisfiesRequiredKey(
    "github-actions[bot]",
    "ERROR: Gemini 429",
    "gemini",
  ),
  false,
);
assert.equal(
  eventSatisfiesRequiredKey(
    "coderabbitai[bot]",
    "This reachable branch loses the release artifact and should retain it.",
    "coderabbit",
  ),
  true,
);

assert.equal(loginToBotKey("github-actions[bot]", qwenSuccess), "qwen");
assert.equal(
  loginToBotKey(
    "coderabbitai",
    "A real review comment with actionable detail.",
  ),
  "coderabbit",
);
assert.equal(
  loginToBotKey(
    "coderabbitai[bot]",
    "A real review comment with actionable detail.",
  ),
  "coderabbit",
);
assert.equal(
  loginMatchesBotKey(
    "cursor[bot]",
    "cursor",
    "## Feedback plan\n- implement every thread",
  ),
  false,
);
assert.equal(
  loginMatchesBotKey(
    "cursor[bot]",
    "cursor",
    "<!-- CURSOR_AUTOMATION_ID: review -->\n## Cursor Code Review\nVerdict: PASS",
  ),
  true,
);
assert.equal(
  loginMatchesBotKey("cursor[bot]", "codex", "Cursor review housekeeping"),
  false,
);
assert(SPREADSHEET_BOT_KEYS.includes("qwen"));
assert(SPREADSHEET_BOT_KEYS.includes("cursor"));
assert.equal(isReviewablePath(".github/workflows/app-ci.yml"), true);
assert.equal(isReviewablePath("scripts/wait-for-bots.mjs"), true);
assert.equal(isReviewablePath("mobile/package-lock.json"), false);
assert.equal(isReviewablePath("README.md"), false);
const changedLines = changedLinesFromDiff(
  "@@ -10,2 +10,2 @@\n-old\n+new\n context",
);
assert.deepEqual([...changedLines.left], [10]);
assert.deepEqual([...changedLines.right], [10]);
const workflow = readFileSync(
  ".github/workflows/cursor-auto-pr-review.yml",
  "utf8",
);
const controlWorkflow = readFileSync(
  ".github/workflows/review-bot-control.yml",
  "utf8",
);
const coderabbitRetryWorkflow = readFileSync(
  ".github/workflows/pr-coderabbit-rate-limit-retry.yml",
  "utf8",
);
const feedbackWorkflow = readFileSync(
  ".github/workflows/pr-bot-feedback-check.yml",
  "utf8",
);
const controlScript = readFileSync("scripts/review-bot-control.mjs", "utf8");
const branchProtection = readFileSync(
  "scripts/apply-branch-protection.mjs",
  "utf8",
);
const prompt = readFileSync(".cursor/PR_REVIEW_PROMPT.md", "utf8");
const reviewer = readFileSync("scripts/qwen-pr-review.mjs", "utf8");
assert.match(workflow, /\bpull_request_target:/);
assert.match(workflow, /ref:\s*main/);
assert.match(workflow, /persist-credentials:\s*false/g);
assert.match(workflow, /_trusted-reviewer\\scripts\\qwen-pr-review\.mjs/);
assert.doesNotMatch(workflow, /node scripts\/qwen-pr-review\.mjs/);
assert.match(workflow, /```suggestion/);
assert.match(workflow, /cancel-in-progress:\s*true/);
assert.doesNotMatch(workflow, /queue:\s*max/);
assert.match(workflow, /DIFF_MAX_CHARS:\s*"60000"/);
assert.doesNotMatch(workflow, /DIFF_CHUNK_CHARS/);
assert.match(workflow, /Fork PRs cannot run/);
assert.doesNotMatch(workflow, /Reviewed files:/);
assert.doesNotMatch(workflow, /Omitted (?:reviewable )?files:/);
assert.match(workflow, /\$exists\.ToString\(\)\.ToLowerInvariant\(\)/);
assert.match(workflow, /\$finding\.side -eq 'RIGHT'/);
assert.doesNotMatch(prompt, /## Summary/);
assert.match(prompt, /"suggested_fix"/);
assert.match(prompt, /"side"/);
assert.match(prompt, /Maximum six distinct findings/);
assert.match(reviewer, /MAX_FILES = 10/);
assert.match(reviewer, /MAX_FINDINGS = 6/);
assert.match(reviewer, /DEFAULT_MODEL = 'qwen3-coder:30b'/);
assert.match(reviewer, /DEFAULT_DIFF_MAX = 60_000/);
assert.match(reviewer, /--unified=8/);
assert.doesNotMatch(reviewer, /Qwen review budget omitted reviewable file/);
assert.doesNotMatch(reviewer, /excluded_files:/);
assert.match(reviewer, /max_tokens:\s*1200/);
assert.match(reviewer, /AbortSignal\.timeout/);
assert.match(reviewer, /UNTRUSTED_PR_DIFF_\$\{randomUUID\(\)\}/);
assert.doesNotMatch(reviewer, /'```diff'/);
assert.match(controlWorkflow, /workflow_dispatch:/);
assert.match(controlWorkflow, /ref:\s*main/);
assert.match(controlWorkflow, /actions:\s*write/);
assert.match(
  controlScript,
  /Qwen enabled as advisory; presence gate remains disabled/,
);
assert.doesNotMatch(controlScript, /variable", "set|actions\/variables/);
assert.match(
  coderabbitRetryWorkflow,
  /gh pr view "\$PR" --repo "\$GITHUB_REPOSITORY"/,
);
assert.match(
  coderabbitRetryWorkflow,
  /gh pr comment "\$PR" --repo "\$GITHUB_REPOSITORY"/,
);
assert.doesNotMatch(coderabbitRetryWorkflow, /gh api[\s\S]{0,200}--jq --arg/);
assert.match(
  coderabbitRetryWorkflow,
  /--paginate --slurp \|\s*\n\s*jq --arg after/,
);
assert.doesNotMatch(coderabbitRetryWorkflow, /^concurrency:/m);
const coderabbitRetryJob = indentedBlock(
  coderabbitRetryWorkflow,
  "  retry-after-rate-limit:",
);
assert.match(coderabbitRetryJob, /^    concurrency:/m);
assert.doesNotMatch(coderabbitRetryWorkflow, /queue:\s*max/);
assert.match(feedbackWorkflow, /cancel-in-progress:\s*false/);
assert.match(feedbackWorkflow, /timeout-minutes:\s*5/);
assert.match(feedbackWorkflow, /PR_STATE=\$\(gh api/);
assert.doesNotMatch(feedbackWorkflow, /queue:\s*max/);
assert.doesNotMatch(feedbackWorkflow, /pull_request\.head\.sha/);
assert.doesNotMatch(feedbackWorkflow, /seq 1 40|sleep 60|40 minutes/);
assert.match(
  coderabbitRetryJob,
  /read_pr_state\(\)[\s\S]*for attempt in 1 2 3[\s\S]*gh pr view "\$PR" --repo "\$GITHUB_REPOSITORY"/,
);
const transientStatePoll = markedBlock(
  coderabbitRetryJob,
  "# transient-safe-pr-state-poll:start",
  "# transient-safe-pr-state-poll:end",
);
assert.match(transientStatePoll, /if STATE="\$\(read_pr_state\)"/);
assert.match(transientStatePoll, /preserve the active waiter/);
assert.doesNotMatch(transientStatePoll, /exit 1/);
assert.doesNotMatch(
  branchProtection.match(/const REQUIRED_CHECKS = \[[\s\S]*?\];/)?.[0] || "",
  /qwen-code-review|bot-presence-gate/,
);

const waitScript = readFileSync("wait_for_bots.mjs", "utf8");
assert.doesNotMatch(waitScript, /const fields = '[^']*\bupdatedAt\b/);
assert.match(waitScript, /state\.anchor = anchorFromPr/);
assert.match(
  waitScript,
  /state = \{ anchor: anchorIso, readyAt: null, headSha, requiredKeys \}/,
);
assert.match(
  waitScript,
  /requiredKeys\.length === 0[\s\S]*MAX_WAIT_MIN[\s\S]*status: 'timeout'/,
);

const workflowSources = readdirSync(".github/workflows")
  .filter((name) => /\.ya?ml$/i.test(name))
  .map((name) => readFileSync(`.github/workflows/${name}`, "utf8"))
  .join("\n");
assert.doesNotMatch(
  workflowSources,
  /\buses:\s*[^\r\n#]+@v\d+(?:\s|$)/,
  "third-party actions must use immutable commit SHAs",
);

console.log("PASS verify-pr-review-bots");
