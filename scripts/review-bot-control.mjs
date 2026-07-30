#!/usr/bin/env node
import { appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const QWEN_WORKFLOW = "cursor-auto-pr-review.yml";
const PRESENCE_WORKFLOW = "pr-bot-presence-gate.yml";
const FEEDBACK_WORKFLOW = "pr-bot-feedback-check.yml";
const CODERABBIT_RETRY_WORKFLOW = "pr-coderabbit-rate-limit-retry.yml";
const DASHBOARD_LABEL = "review-bot-control";
const DASHBOARD_TITLE = "Review bot control dashboard";
const ACTIVE_RUN_STATES = new Set([
  "queued",
  "pending",
  "in_progress",
  "waiting",
  "requested",
]);

const EXTERNAL_BOTS = [
  ["CodeRabbit", ".coderabbit.yaml"],
  ["Codex", null],
  ["Cursor", null],
  ["Sourcery", null],
  ["Gemini", null],
  ["Copilot", null],
  ["Greptile", null],
];

function runGh(args, { input, allowFailure = false } = {}) {
  const result = spawnSync("gh", args, {
    encoding: "utf8",
    input,
    env: process.env,
    timeout: 120_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    throw new Error(
      (result.stderr || result.stdout || `gh exit ${result.status}`).trim(),
    );
  }
  return {
    ok: result.status === 0,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
  };
}

function ghJson(args, { allowFailure = false } = {}) {
  const result = runGh(args, { allowFailure });
  if (!result.ok || !result.stdout) return null;
  return JSON.parse(result.stdout);
}

export function parseArgs(argv) {
  const out = {
    qwen: "unchanged",
    coderabbitRetry: "unchanged",
    refreshOnly: false,
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--qwen" && argv[index + 1]) out.qwen = argv[++index];
    else if (arg.startsWith("--qwen=")) out.qwen = arg.slice("--qwen=".length);
    else if (arg === "--coderabbit-retry" && argv[index + 1])
      out.coderabbitRetry = argv[++index];
    else if (arg.startsWith("--coderabbit-retry=")) {
      out.coderabbitRetry = arg.slice("--coderabbit-retry=".length);
    } else if (arg === "--refresh-only") out.refreshOnly = true;
    else if (arg === "--help" || arg === "-h") out.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!["unchanged", "disabled", "advisory"].includes(out.qwen)) {
    throw new Error("--qwen must be unchanged, disabled, or advisory");
  }
  if (!["unchanged", "disabled", "enabled"].includes(out.coderabbitRetry)) {
    throw new Error(
      "--coderabbit-retry must be unchanged, disabled, or enabled",
    );
  }
  return out;
}

function resolveRepo() {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  const payload = ghJson(["repo", "view", "--json", "nameWithOwner"]);
  if (!payload?.nameWithOwner) throw new Error("Could not resolve repository");
  return payload.nameWithOwner;
}

function workflowState(repo, workflow) {
  const payload = ghJson(
    ["api", `repos/${repo}/actions/workflows/${workflow}`],
    { allowFailure: true },
  );
  return payload?.state || "unavailable";
}

function setWorkflowState(repo, workflow, enabled) {
  runGh([
    "api",
    "--method",
    "PUT",
    `repos/${repo}/actions/workflows/${workflow}/${enabled ? "enable" : "disable"}`,
  ]);
}

function cancelActiveRuns(repo, workflow) {
  const rows =
    ghJson(
      [
        "run",
        "list",
        "--repo",
        repo,
        "--workflow",
        workflow,
        "--limit",
        "100",
        "--json",
        "databaseId,status",
      ],
      { allowFailure: true },
    ) || [];
  let cancelled = 0;
  for (const row of rows) {
    if (!ACTIVE_RUN_STATES.has(row.status)) continue;
    const result = runGh(
      ["run", "cancel", String(row.databaseId), "--repo", repo],
      { allowFailure: true },
    );
    if (result.ok) cancelled += 1;
  }
  return cancelled;
}

function setVariable(repo, name, value) {
  runGh(["variable", "set", name, "--repo", repo, "--body", value]);
}

export function mergeVariablePages(pages, fallback = {}) {
  const merged = Object.fromEntries(
    Object.entries(fallback).filter(
      ([, value]) => value !== undefined && value !== "",
    ),
  );
  const rows = Array.isArray(pages)
    ? pages.flatMap((page) => page?.variables || [])
    : [];
  for (const row of rows) merged[row.name] = row.value;
  return merged;
}

function variables(repo) {
  const pages = ghJson(
    [
      "api",
      `repos/${repo}/actions/variables?per_page=100`,
      "--paginate",
      "--slurp",
    ],
    { allowFailure: true },
  );
  return mergeVariablePages(pages, {
    QWEN_ENABLED: process.env.CONTROL_QWEN_ENABLED,
    AR_BOT_WAIT_REQUIRED: process.env.CONTROL_BOT_WAIT_REQUIRED,
  });
}

export function requiredChecksFromRules(rules) {
  return (rules || [])
    .filter((rule) => rule?.type === "required_status_checks")
    .flatMap((rule) => rule?.parameters?.required_status_checks || [])
    .map((row) => row.context)
    .filter(Boolean);
}

function requiredChecks(repo) {
  const protection = ghJson(["api", `repos/${repo}/branches/main/protection`], {
    allowFailure: true,
  });
  const protectionChecks = (protection?.required_status_checks?.checks || [])
    .map((row) => row.context)
    .filter(Boolean);
  if (protectionChecks.length) {
    return { values: protectionChecks, source: "live branch protection" };
  }

  const rules = ghJson(["api", `repos/${repo}/rules/branches/main`], {
    allowFailure: true,
  });
  const ruleChecks = requiredChecksFromRules(rules);
  if (ruleChecks.length) {
    return { values: ruleChecks, source: "live branch rules" };
  }
  return {
    values: ["mobile-ci", "bot-feedback-gate"],
    source: "configured policy fallback; live rules API unavailable",
  };
}

function stateLabel(state) {
  if (state === "active") return "Enabled";
  if (state.startsWith("disabled")) return "Disabled";
  return `Unavailable (${state})`;
}

export function renderDashboard({
  repo,
  qwenState,
  presenceState,
  feedbackState,
  coderabbitRetryState,
  repoVariables,
  checks,
  checkSource,
  updatedAt,
}) {
  const repoUrl = `https://github.com/${repo}`;
  const workflowUrl = `${repoUrl}/actions/workflows/review-bot-control.yml`;
  const appSettingsUrl = "https://github.com/settings/installations";
  const qwenMode =
    qwenState === "active" && repoVariables.QWEN_ENABLED === "true"
      ? "Advisory"
      : "Disabled";
  const externalRows = EXTERNAL_BOTS.map(([name, config]) => {
    const configLink = config
      ? ` · [repo config](${repoUrl}/blob/main/${config})`
      : "";
    return `| ${name} | Vendor-managed | Advisory | [Manage installed apps](${appSettingsUrl})${configLink} |`;
  }).join("\n");
  const checkText = checks.map((name) => `\`${name}\``).join(", ");

  return `<!-- review-bot-control-dashboard -->
# Review bot control dashboard

Last refreshed: ${updatedAt}

[Open one-click controls](${workflowUrl}) · [Actions workflows](${repoUrl}/actions) · [Installed GitHub Apps](${appSettingsUrl}) · [Branch rules](${repoUrl}/rules)

## Repository-owned controls

| Component | Live state | Merge policy | Control |
| --- | --- | --- | --- |
| Qwen reviewer | ${stateLabel(qwenState)} | ${qwenMode}; never required | [Enable advisory / disable](${workflowUrl}) |
| Qwen presence gate | ${stateLabel(presenceState)} | Disabled and not required | Kept off with Qwen |
| Feedback-thread gate | ${stateLabel(feedbackState)} | Required; vendor-neutral | [View workflow](${repoUrl}/actions/workflows/${FEEDBACK_WORKFLOW}) |
| CodeRabbit retry helper | ${stateLabel(coderabbitRetryState)} | Advisory helper only | [Enable / disable](${workflowUrl}) |

Required checks on \`main\` (${checkSource}): ${checkText}

Repository variables: \`QWEN_ENABLED=${repoVariables.QWEN_ENABLED || "unset"}\`, \`AR_BOT_WAIT_REQUIRED=${repoVariables.AR_BOT_WAIT_REQUIRED || "unset"}\`.

> Qwen's Windows runner is intentionally offline while Qwen is disabled. GitHub cannot start an offline self-hosted runner; re-enabling Qwen in this dashboard arms the advisory workflow, but the local scheduled runner task must also be enabled on that PC.

## External review apps

GitHub does not provide a repository workflow with a safe universal switch for other vendors' installed apps. Their actual repository access is controlled from GitHub's Installed Apps settings; this dashboard links to that authoritative control instead of presenting switches that do not disable the service.

| Bot | Execution control | AR-app policy | Manage |
| --- | --- | --- | --- |
${externalRows}

All external reviewers are advisory. Substantive findings still require an explicit \`Implemented\`, \`Deferred\`, or \`Declined\` reply and thread resolution; vendor availability and quota never block merge by themselves.
`;
}

function publishDashboard(repo, body) {
  runGh([
    "label",
    "create",
    DASHBOARD_LABEL,
    "--repo",
    repo,
    "--color",
    "5319E7",
    "--description",
    "Persistent review-bot control dashboard",
    "--force",
  ]);
  const rows =
    ghJson([
      "issue",
      "list",
      "--repo",
      repo,
      "--state",
      "open",
      "--label",
      DASHBOARD_LABEL,
      "--limit",
      "1",
      "--json",
      "number",
    ]) || [];
  let issueNumber = rows[0]?.number;
  if (issueNumber) {
    runGh(
      [
        "issue",
        "edit",
        String(issueNumber),
        "--repo",
        repo,
        "--title",
        DASHBOARD_TITLE,
        "--body-file",
        "-",
      ],
      { input: body },
    );
  } else {
    const created = runGh(
      [
        "issue",
        "create",
        "--repo",
        repo,
        "--title",
        DASHBOARD_TITLE,
        "--label",
        DASHBOARD_LABEL,
        "--body-file",
        "-",
      ],
      { input: body },
    );
    issueNumber = Number(created.stdout.match(/\/issues\/(\d+)\s*$/)?.[1]);
  }
  if (issueNumber) {
    runGh(["issue", "pin", String(issueNumber), "--repo", repo], {
      allowFailure: true,
    });
  }
  return issueNumber;
}

function printHelp() {
  console.log(`Usage: npm run review-bots:control -- [options]

Options:
  --qwen unchanged|disabled|advisory
  --coderabbit-retry unchanged|disabled|enabled
  --refresh-only

The command applies repository-owned workflow controls and refreshes the pinned
GitHub issue dashboard. External GitHub Apps are managed through installation
settings linked from that dashboard.`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }
  const repo = resolveRepo();
  const changes = [];

  if (!args.refreshOnly && args.qwen === "disabled") {
    const cancelled = cancelActiveRuns(repo, QWEN_WORKFLOW);
    setWorkflowState(repo, QWEN_WORKFLOW, false);
    setWorkflowState(repo, PRESENCE_WORKFLOW, false);
    setVariable(repo, "QWEN_ENABLED", "false");
    setVariable(repo, "AR_BOT_WAIT_REQUIRED", "off");
    changes.push(`Qwen disabled; ${cancelled} active run(s) cancelled`);
  } else if (!args.refreshOnly && args.qwen === "advisory") {
    setVariable(repo, "QWEN_ENABLED", "true");
    setVariable(repo, "AR_BOT_WAIT_REQUIRED", "off");
    setWorkflowState(repo, PRESENCE_WORKFLOW, false);
    setWorkflowState(repo, QWEN_WORKFLOW, true);
    changes.push("Qwen enabled as advisory; presence gate remains disabled");
  }

  if (!args.refreshOnly && args.coderabbitRetry !== "unchanged") {
    setWorkflowState(
      repo,
      CODERABBIT_RETRY_WORKFLOW,
      args.coderabbitRetry === "enabled",
    );
    changes.push(`CodeRabbit retry helper ${args.coderabbitRetry}`);
  }

  const checkState = requiredChecks(repo);
  const body = renderDashboard({
    repo,
    qwenState: workflowState(repo, QWEN_WORKFLOW),
    presenceState: workflowState(repo, PRESENCE_WORKFLOW),
    feedbackState: workflowState(repo, FEEDBACK_WORKFLOW),
    coderabbitRetryState: workflowState(repo, CODERABBIT_RETRY_WORKFLOW),
    repoVariables: variables(repo),
    checks: checkState.values,
    checkSource: checkState.source,
    updatedAt: new Date().toISOString(),
  });
  const issueNumber = publishDashboard(repo, body);
  const summary = [
    "# Review bot control",
    "",
    ...(changes.length
      ? changes.map((change) => `- ${change}`)
      : ["- Status refresh only"]),
    `- Dashboard: https://github.com/${repo}/issues/${issueNumber}`,
    "",
    body,
  ].join("\n");
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  }
  console.log(summary);
}

const isDirectRun =
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isDirectRun) {
  main().catch((error) => {
    console.error(`review-bot-control: ${error.message}`);
    process.exit(1);
  });
}
