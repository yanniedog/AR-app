#!/usr/bin/env node
/**
 * Poll Firebase Crashlytics topIssues and open GitHub issues for new Crashlytics issue IDs.
 *
 * Usage:
 *   node scripts/crashlytics-to-github-issues.mjs [--dry-run] [--mock-report PATH]
 *
 * Env:
 *   GOOGLE_SERVICES_JSON          — Android Firebase client config (project + app id)
 *   FIREBASE_USER_OAUTH_JSON      — authorized_user JSON (preferred; Crashlytics reports support)
 *   FIREBASE_SERVICE_ACCOUNT_JSON — GCP service account key JSON (fallback; some projects return 404)
 *   GH_TOKEN / GITHUB_TOKEN       — GitHub API (issues:write in the private destination)
 *   DIAGNOSTICS_GITHUB_REPOSITORY — private owner/repo destination (required for live writes)
 *   GITHUB_REPOSITORY             — source repository; dry-run fallback only
 *   CRASHLYTICS_LOOKBACK_DAYS     — default 7
 *   CRASHLYTICS_MIN_EVENTS        — default 1
 *   FIREBASE_ANDROID_APP_ID       — optional override for mobilesdk_app_id
 *   FIREBASE_PROJECT_ID           — optional override for project_id
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  buildRecentIntervalFilter,
  fetchAllReportGroups,
  fetchIssueEvents,
  parseIssueGroup,
} from './lib/crashlytics-client.mjs';
import {
  getServiceAccountAccessToken,
  parseServiceAccountJson,
} from './lib/google-service-account-auth.mjs';
import {
  getAuthorizedUserAccessToken,
  parseAuthorizedUserJson,
} from './lib/google-user-oauth-auth.mjs';
import {
  DIAGNOSTICS_PRIVACY_NOTICE_VERSION,
  extractDeidentifiedEventLogs,
  hasCurrentDiagnosticsConsentAttestation,
  redactDiagnosticText,
} from './lib/diagnostics-privacy.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MOBILE_UTILS = pathToFileURL(join(ROOT, 'mobile/scripts/firebase-json-utils.mjs')).href;
const DEFAULT_REPO = 'yanniedog/AR-app';
const MARKER_PREFIX = 'crashlytics-issue-id:';

const LABEL_DEFS = [
  { name: 'crashlytics', color: 'FC2847', description: 'Synced from Firebase Crashlytics' },
  { name: 'mobile', color: '1D76DB', description: 'AR-app mobile app' },
  { name: 'crashlytics-fatal', color: 'B60205', description: 'Crashlytics fatal crash' },
  { name: 'crashlytics-anr', color: 'D87600', description: 'Crashlytics ANR' },
  { name: 'crashlytics-non-fatal', color: 'FBCA04', description: 'Crashlytics non-fatal' },
];

/** @typedef {{ dryRun: boolean, mockReport?: string, lookbackDays: number, minEvents: number, repo: string }} CliOptions */

function parseArgs(argv) {
  /** @type {CliOptions} */
  const opts = {
    dryRun: false,
    mockReport: undefined,
    lookbackDays: Number(process.env.CRASHLYTICS_LOOKBACK_DAYS || 7),
    minEvents: Number(process.env.CRASHLYTICS_MIN_EVENTS || 1),
    repo:
      process.env.DIAGNOSTICS_GITHUB_REPOSITORY?.trim() ||
      process.env.GITHUB_REPOSITORY?.trim() ||
      DEFAULT_REPO,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--mock-report') {
      opts.mockReport = argv[++i];
      if (!opts.mockReport) throw new Error('--mock-report requires a path');
    } else if (arg === '--lookback-days') {
      opts.lookbackDays = Number(argv[++i]);
    } else if (arg === '--min-events') {
      opts.minEvents = Number(argv[++i]);
    } else if (arg === '--repo') {
      opts.repo = argv[++i];
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/crashlytics-to-github-issues.mjs [--dry-run] [--mock-report PATH]`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function gh(args, { allowFail = false } = {}) {
  const token = process.env.GH_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim();
  const env = token ? { ...process.env, GH_TOKEN: token, GITHUB_TOKEN: token } : process.env;
  const result = spawnSync('gh', args, { encoding: 'utf8', env });
  if (result.status !== 0 && !allowFail) {
    throw new Error((result.stderr || result.stdout || 'gh failed').trim());
  }
  if (result.status !== 0) return null;
  return (result.stdout || '').trim();
}

function ensureGh() {
  if (spawnSync('gh', ['--version'], { encoding: 'utf8' }).status !== 0) {
    throw new Error('gh CLI is required');
  }
}

function assertPrivateDestination(repo) {
  const visibility = gh(['repo', 'view', repo, '--json', 'visibility', '--jq', '.visibility']);
  if (visibility !== 'PRIVATE') {
    throw new Error(
      `Refusing to write diagnostics to ${repo}: destination visibility is ${visibility || 'unknown'}, not PRIVATE`,
    );
  }
}

async function loadFirebaseConfig(opts) {
  const { parseGoogleServicesJson, isPlaceholderGoogleServices } = await import(MOBILE_UTILS);

  let raw =
    process.env.GOOGLE_SERVICES_JSON?.trim() ||
    (process.env.GOOGLE_SERVICES_JSON_FILE
      ? readFileSync(process.env.GOOGLE_SERVICES_JSON_FILE, 'utf8')
      : '');
  if (!raw && opts.mockReport) {
    raw = readFileSync(join(ROOT, 'mobile/google-services.json.example'), 'utf8');
  }

  if (!raw) {
    throw new Error('GOOGLE_SERVICES_JSON is not set');
  }

  const parsed = parseGoogleServicesJson(raw, 'GOOGLE_SERVICES_JSON');
  if (!opts.mockReport && isPlaceholderGoogleServices(parsed)) {
    throw new Error('GOOGLE_SERVICES_JSON is the placeholder project — set real Firebase config');
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID?.trim() || String(parsed.project_info?.project_id || '').trim();
  const expectedPackage = 'com.eyex.australianrates';
  const client = (parsed.client || []).find(
    (c) => c?.client_info?.android_client_info?.package_name === expectedPackage,
  );
  const appId =
    process.env.FIREBASE_ANDROID_APP_ID?.trim() ||
    String(client?.client_info?.mobilesdk_app_id || '').trim();

  if (!projectId) throw new Error('Could not resolve Firebase project_id');
  if (!appId) {
    throw new Error(`Could not resolve mobilesdk_app_id for ${expectedPackage}`);
  }

  return { projectId, appId, projectNumber: String(parsed.project_info?.project_number || '') };
}

function markerFor(issueId) {
  return `<!-- ${MARKER_PREFIX} ${issueId} -->`;
}

function extractTrackedIds(body) {
  const match = body.match(/<!--\s*crashlytics-issue-id:\s*([^\s>]+)\s*-->/i);
  return match?.[1] || null;
}

function loadExistingCrashlyticsIds(repo) {
  const out = gh([
    'issue',
    'list',
    '--repo',
    repo,
    '--label',
    'crashlytics',
    '--state',
    'all',
    '--limit',
    '500',
    '--json',
    'body',
  ]);
  if (!out) return new Set();
  const rows = JSON.parse(out);
  const ids = new Set();
  for (const row of rows) {
    const id = extractTrackedIds(String(row.body || ''));
    if (id) ids.add(id);
  }
  return ids;
}

function ensureLabels(repo) {
  for (const label of LABEL_DEFS) {
    gh(
      [
        'label',
        'create',
        label.name,
        '--repo',
        repo,
        '--color',
        label.color,
        '--description',
        label.description,
        '--force',
      ],
      { allowFail: true },
    );
  }
}

function labelsForErrorType(errorType) {
  const labels = ['crashlytics', 'mobile'];
  if (errorType === 'FATAL') labels.push('crashlytics-fatal');
  else if (errorType === 'ANR') labels.push('crashlytics-anr');
  else if (errorType === 'NON_FATAL') labels.push('crashlytics-non-fatal');
  return labels;
}

function formatStackFromEvent(event) {
  if (!event || typeof event !== 'object') return null;
  const threads = event.threads || event.stacktrace?.threads || event.exceptions;
  if (Array.isArray(threads)) {
    return '```\n' + redactDiagnosticText(JSON.stringify(threads, null, 2)) + '\n```';
  }
  if (event.stackTrace || event.stacktrace) {
    const trace = event.stackTrace || event.stacktrace;
    return '```\n' + redactDiagnosticText(trace) + '\n```';
  }
  return null;
}

async function resolveAttestedEventDetails(accessToken, issue, projectId, appId, lookbackDays) {
  try {
    const events = await fetchIssueEvents(accessToken, projectId, appId, issue.id, {
      lookbackDays,
    });
    const event = events.find((candidate) => hasCurrentDiagnosticsConsentAttestation(candidate));
    if (!event) return { attested: false, stackTrace: null, diagnosticLogs: null };
    return {
      attested: true,
      stackTrace: formatStackFromEvent(event),
      diagnosticLogs: extractDeidentifiedEventLogs(event),
    };
  } catch (error) {
    console.warn(
      `Skipping Crashlytics issue ${issue.id}: current-consent event verification failed (${error instanceof Error ? error.message : String(error)})`,
    );
    return { attested: false, stackTrace: null, diagnosticLogs: null };
  }
}

function buildIssueTitle(issue) {
  const version = issue.lastSeenVersion || issue.firstSeenVersion || 'unknown';
  const title = issue.title || issue.subtitle || issue.id;
  return redactDiagnosticText(`[Crashlytics] ${title} — v${version}`).slice(0, 240);
}

function buildIssueBody(issue, metrics, stackTrace, diagnosticLogs) {
  const lines = [
    markerFor(issue.id),
    '',
    'Automatic issue from Firebase Crashlytics (`crashlytics-github-issues` workflow).',
    '',
    '## Summary',
    '',
    `| Field | Value |`,
    `| --- | --- |`,
    `| Crashlytics issue ID | \`${issue.id}\` |`,
    `| Type | ${issue.errorType || 'UNKNOWN'} |`,
    `| State | ${issue.state || 'UNKNOWN'} |`,
    `| Title | ${redactDiagnosticText(issue.title || '—')} |`,
    `| Subtitle | ${redactDiagnosticText(issue.subtitle || '—')} |`,
    `| Events (interval) | ${metrics.eventsCount ?? '—'} |`,
    `| First seen version | ${issue.firstSeenVersion || '—'} |`,
    `| Last seen version | ${issue.lastSeenVersion || '—'} |`,
    `| First seen | ${issue.firstSeenTime || '—'} |`,
    `| Last seen | ${issue.lastSeenTime || '—'} |`,
    '',
  ];

  if (issue.uri) {
    lines.push(`[Open in Firebase console](${issue.uri})`, '');
  }

  if (issue.signals?.length) {
    lines.push('## Signals', '');
    for (const sig of issue.signals) {
      lines.push(`- **${sig.signal}**: ${sig.description || ''}`);
    }
    lines.push('');
  }

  if (stackTrace) {
    lines.push('## Stack trace (sample event)', '', stackTrace, '');
  } else if (issue.subtitle) {
    lines.push('## Exception message', '', '```', redactDiagnosticText(issue.subtitle), '```', '');
  }

  if (diagnosticLogs) {
    lines.push(
      '## Automatically redacted diagnostic excerpt',
      '',
      'Only allowlisted automatic diagnostic messages are included. Crashlytics user, installation, key and timestamp fields are discarded.',
      '',
      '```',
      diagnosticLogs,
      '```',
      '',
    );
  }

  lines.push(
    '---',
    '_Re-open in Firebase when fixed; close this GitHub issue manually or via your triage process._',
  );

  return lines.join('\n');
}

function eventCount(metrics) {
  const raw = metrics.eventsCount ?? metrics.events_count ?? '0';
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

async function loadReportGroups(opts, accessToken, projectId, appId) {
  if (opts.mockReport) {
    const text = readFileSync(opts.mockReport, 'utf8');
    const mock = JSON.parse(text);
    return mock.groups || [];
  }

  const filter = buildRecentIntervalFilter(opts.lookbackDays);
  return fetchAllReportGroups(accessToken, projectId, appId, 'topIssues', {
    pageSize: 50,
    filter,
  });
}

async function createGithubIssue(repo, title, body, labels, dryRun) {
  if (dryRun) {
    console.log(`[dry-run] would create: ${title}`);
    console.log(`[dry-run] labels: ${labels.join(', ')}`);
    return { number: 0, url: '(dry-run)' };
  }

  const labelArgs = labels.flatMap((l) => ['--label', l]);
  const url = gh([
    'issue',
    'create',
    '--repo',
    repo,
    '--title',
    title,
    '--body',
    body,
    ...labelArgs,
  ]);
  const number = url?.match(/\/issues\/(\d+)\s*$/)?.[1];
  console.log(`Created GitHub issue #${number || '?'}: ${title}`);
  return { number: Number(number || 0), url: url || '' };
}

async function main() {
  const opts = parseArgs(process.argv);
  const pureMockDryRun = opts.dryRun && Boolean(opts.mockReport);
  const configuredNotice = process.env.DIAGNOSTICS_PRIVACY_NOTICE_VERSION?.trim() || '';
  if (!opts.mockReport && configuredNotice !== DIAGNOSTICS_PRIVACY_NOTICE_VERSION) {
    throw new Error('Live diagnostics triage is not approved for the current privacy notice');
  }
  if (!pureMockDryRun) ensureGh();
  if (!opts.dryRun) assertPrivateDestination(opts.repo);

  console.log(`crashlytics-to-github-issues: repo=${opts.repo} dryRun=${opts.dryRun}`);

  const { projectId, appId } = await loadFirebaseConfig(opts);
  console.log(`Firebase project=${projectId} app=${appId}`);

  let accessToken = '';
  let authMode = 'none';
  if (!opts.mockReport) {
    const userRaw = process.env.FIREBASE_USER_OAUTH_JSON?.trim();
    if (userRaw) {
      accessToken = await getAuthorizedUserAccessToken(
        parseAuthorizedUserJson(userRaw, 'FIREBASE_USER_OAUTH_JSON'),
      );
      authMode = 'user-oauth';
    } else {
      const saRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
      if (!saRaw) {
        throw new Error(
          'FIREBASE_USER_OAUTH_JSON is not set — scheduled Crashlytics reports require authorized_user OAuth JSON',
        );
      }
      const serviceAccount = parseServiceAccountJson(saRaw);
      accessToken = await getServiceAccountAccessToken(serviceAccount);
      authMode = 'service-account';
    }
    console.log(`Crashlytics auth=${authMode}`);
  }

  let groups;
  try {
    groups = await loadReportGroups(opts, accessToken, projectId, appId);
  } catch (err) {
    const status = err && typeof err === 'object' && 'status' in err ? err.status : undefined;
    if (status === 404) {
      console.error(
        'Crashlytics reports API returned 404. Enable "Firebase Crashlytics API" in GCP and confirm Crashlytics has data.',
      );
      if (authMode === 'service-account') {
        console.error(
          'This project rejects service-account report calls with "Method not found"; configure FIREBASE_USER_OAUTH_JSON — see HANDOFF.md.',
        );
      }
    }
    throw err;
  }

  const existing = pureMockDryRun ? new Set() : loadExistingCrashlyticsIds(opts.repo);
  console.log(`Tracked Crashlytics IDs in GitHub: ${existing.size}`);

  if (!opts.dryRun) {
    ensureLabels(opts.repo);
  }

  let created = 0;
  let skipped = 0;

  for (const group of groups) {
    const parsed = parseIssueGroup(group);
    if (!parsed) continue;
    const { issue, metrics } = parsed;

    if (issue.state && issue.state !== 'OPEN') {
      skipped += 1;
      continue;
    }

    if (eventCount(metrics) < opts.minEvents) {
      skipped += 1;
      continue;
    }

    if (existing.has(issue.id)) {
      skipped += 1;
      continue;
    }

    const details = accessToken
      ? await resolveAttestedEventDetails(
          accessToken,
          issue,
          projectId,
          appId,
          opts.lookbackDays,
        )
      : { attested: true, stackTrace: null, diagnosticLogs: null };
    if (!details.attested) {
      console.warn(
        `Skipping Crashlytics issue ${issue.id}: no event attests current diagnostics consent`,
      );
      skipped += 1;
      continue;
    }
    const title = buildIssueTitle(issue);
    const body = buildIssueBody(
      issue,
      metrics,
      details.stackTrace,
      details.diagnosticLogs,
    );
    const labels = labelsForErrorType(issue.errorType);

    await createGithubIssue(opts.repo, title, body, labels, opts.dryRun);
    existing.add(issue.id);
    created += 1;
  }

  console.log(`Done: created=${created} skipped=${skipped} groups=${groups.length}`);
  return created;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
