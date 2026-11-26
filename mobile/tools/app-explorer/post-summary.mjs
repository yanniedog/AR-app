// Builds the markdown posted to GitHub when an explorer run ends.
// Usage: node post-summary.mjs <explorer-out dir> <run id>
import fs from 'node:fs';
import path from 'node:path';
import { auditCompletion, auditCoverageLine, auditOutcomeLine, decodeAuditExport } from './audit-export.mjs';
import { renderOutcome, renderSessionCoverage } from './session-verdict.mjs';
import { groupAuditFailures, renderAuditFailureGroups } from './audit-findings.mjs';

const [dir, runId] = process.argv.slice(2);
const read = f => { try { return fs.readFileSync(path.join(dir, f), 'utf8'); } catch { return ''; } };
const json = f => { try { return JSON.parse(read(f)); } catch { return {}; } };

const run = json('run.json');
const audit = json('audit.json');
const report = read('report.md');
const out = [];
const reportData = json('report.json');
const sessionVerdict = reportData.session;
const auditLine = (report.match(/^\*\*Audit.*$/m) || report.match(/^Mode .*$/m) || ['no run summary'])[0];
out.push(`explorer run ${runId} on ${run.tag || '?'} (${run.mode || '?'})`, '');
if (sessionVerdict) out.push(...renderOutcome(sessionVerdict));
out.push(...renderSessionCoverage(reportData));
let decoded;
if (fs.existsSync(path.join(dir, 'audit-log.txt'))) {
  try {
    decoded = decodeAuditExport(read('audit-log.txt'));
  } catch (error) {
    out.push(`Audit log could not be verified: ${error.message}`, '');
  }
}
const completion = auditCompletion(decoded);
out.push(audit.kind ? `**${auditOutcomeLine({ ...audit, completion })}**` : auditLine, '');
if (completion) out.push(auditCoverageLine(completion), '');
const network = decoded?.appHealth?.checks?.find(check => check.code === 'network-policy')?.metrics;
if (network?.policyViolations > 0) {
  const counts = [network.unattributedTransportViolations, network.untrustedExternalLinkResponses, network.untrustedNonLinkResponses];
  if (counts.every(Number.isSafeInteger)) {
    out.push(`Network policy: ${counts[0]} unattributed transports, ${counts[1]} untrusted external-link responses, ${counts[2]} untrusted non-link responses`, '');
  }
}
if (audit.debugLog?.url) {
  out.push(`Debug log: ${audit.debugLog.url}${audit.debugLog.error ? ` (fetch failed: ${audit.debugLog.error})` : ''}`, '');
} else if (audit.debugLog?.error) {
  out.push(`Debug log: ${audit.debugLog.error}`, '');
}
if (audit.url) out.push(`Audit log: ${audit.url}`, '');
if (audit.logContentUrl && audit.logContentUrl !== audit.url) out.push(`Audit log (full file): ${audit.logContentUrl}`, '');
if ((audit.kind || /audit|full/.test(run.mode || '')) && !audit.url) out.push(`Audit log: no URL${audit.outcome ? ` (outcome: ${audit.outcome})` : ''}`, '');
{
  const repo = process.env.GITHUB_REPOSITORY || 'yanniedog/AR-app';
  const raw = f => `https://github.com/${repo}/blob/explorer/run-${runId}/${f}?raw=true`;
  const files = ['logcat.txt', 'report.md', 'audit.json', 'audit-log.txt', 'ux-review.md'].filter(f => fs.existsSync(path.join(dir, f)));
  if (files.length) out.push(`Run files: ${files.map(f => `[${f}](${raw(f)})`).join(' | ')}`, '');
}

const shots = json('shots/shots-result.json');
if (read('shots/shots-failed')) out.push('Screenshot pass failed', '');
if (shots.results) {
  const repo = process.env.GITHUB_REPOSITORY || 'yanniedog/AR-app';
  const base = `https://github.com/${repo}/blob/explorer/run-${runId}/shots`;
  out.push(`Screens: ${shots.count} captured | ${shots.flagged} flagged`, '');
  for (const r of shots.results.filter(x => x.flags.length)) out.push(`- ${r.name}: ${r.flags.join('; ')}${r.flags.includes('contact sheet failed') ? ` ([thumb](${base}/thumbs/${r.name}.jpg?raw=true))` : ''}`);
  const sheets = (shots.sheets || []).map(n => `[${n}](${base}/contact-${n}.jpg?raw=true)`);
  out.push('', sheets.length ? `Contact sheets: ${sheets.join(' | ')}` : 'No screenshots captured', '');
}

const ux = json('ux-review.json');
if (ux.summaryLines) out.push(...ux.summaryLines, '');
else if (read('ux-review-failed')) out.push(`UX review failed (status ${read('ux-review-failed').trim()}), no rubric for this run`, '');

if (decoded) {
  const checks = decoded.checks || [];
  const count = s => checks.filter(c => c.status === s).length;
  out.push(`Checks: ${checks.length} | pass ${count('pass')} | warn ${count('warn')} | fail ${count('fail')}`, '');
  const failed = checks.filter(c => c.status === 'fail');
  const byCode = {};
  for (const c of failed) byCode[c.failureCode || 'none'] = (byCode[c.failureCode || 'none'] || 0) + 1;
  out.push('Failures by code: ' + JSON.stringify(byCode), '');
  const positions = decoded.completion?.failurePositions ?? [];
  if (positions.length) {
    const timing = positions.filter(position => position.category === 'timing').length;
    out.push(`Failure positions: ${positions.length - timing} non-timing | ${timing} timing`, '');
  }
  const timingPositions = new Set(positions.filter(position => position.source === 'performance'
    && position.category === 'timing').map(position => position.position));
  const performanceFailures = checks.flatMap((check, index) => check.status === 'fail'
    ? [{ ...check, timing: timingPositions.has(index + 1) }] : []);
  out.push(...renderAuditFailureGroups(groupAuditFailures(performanceFailures)), '');
  const healthFailures = (decoded.appHealth?.checks ?? []).filter(check => check.status === 'fail')
    .map(check => ({ id: check.code, kind: 'app health', failureCode: check.domain }));
  const ordered = [...healthFailures, ...performanceFailures].sort((a, b) => Number(Boolean(a.timing)) - Number(Boolean(b.timing)));
  out.push('| check | kind | ms | code |', '| --- | --- | --- | ----- |');
  for (const c of ordered.slice(0, 60)) {
    out.push(`| ${c.id ?? '(redacted)'} | ${c.kind} | ${Math.round(c.durationMs || 0)} | ${c.failureCode || ''} |`);
  }
  if (ordered.length > 60) out.push(`| ... ${ordered.length - 60} more in the results branch | | | |`);
}

const logcat = read('logcat.txt');
const crash = logcat.split('\n').filter(l => /AndroidRuntime.*(FATAL EXCEPTION|addViewAt|Caused by|Exception)/.test(l)).slice(0, 12);
if (crash.length) {
  out.push('', 'Crash:', '```', ...crash.map(l => l.slice(0, 220)), '```');
  const journeys = logcat.split('\n').filter(l => /perf-audit.*"id":"journey-/.test(l)).slice(-6)
    .map(l => (l.match(/"id":"(journey-[^"]+)".*?"status":"(\w+)"/) || []).slice(1).join(' '));
  if (journeys.length) out.push('', 'Last journeys before crash: ' + journeys.join(', '));
}
const official = new Map();
for (const line of logcat.split('\n')) {
  const m = line.match(/official-data-summary: stage=(\w+) source=(\S+) reason=(.+?)\s*$/);
  if (m) official.set(`${m[2]} ${m[1]} ${m[3]}`, (official.get(`${m[2]} ${m[1]} ${m[3]}`) || 0) + 1);
}
if (official.size) {
  out.push('', 'Official data fetch failures (app log, each distinct failure once):', '| source | stage | reason | times |', '| --- | --- | --- | --- |');
  for (const [key, count] of [...official].slice(0, 12)) {
    const [source, stage, ...reason] = key.split(' ');
    out.push(`| ${source} | ${stage} | ${reason.join(' ').replace(/\|/g, '/')} | ${count} |`);
  }
}
const reach = read('source-reachability.txt').split('\n').filter(Boolean);
if (reach.length) {
  out.push('', 'Official data reachability from the runner (curl):', '```', ...reach.slice(0, 12).map(l => l.slice(0, 200)), '```');
}
const tls = read('rba-tls.txt').split('\n').filter(Boolean);
if (tls.length) {
  out.push('', 'RBA TLS chain and emulator clock:', '```', ...tls.slice(0, 10).map(l => l.slice(0, 200)), '```');
}
out.push('', `Results branch: explorer/run-${runId}`);
let body = out.join('\n');
if (body.length > 60000) body = body.slice(0, 60000) + '\n...truncated';
process.stdout.write(body);
