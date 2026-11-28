// Independent read-only verdict after App Explorer has published its evidence.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function releaseSessionVerdict(run, report, currentTag, runId) {
  if (String(run?.runId) !== String(runId)) return ['incomplete', 'Archived run identity differs'];
  if (run.event === 'pull_request') return ['diagnostic', 'PR self-test against an existing release'];
  if (!['session', 'audit', 'full'].includes(run.mode)) return ['diagnostic', 'Run did not request a real-use session'];
  if (!/^app-v\d+(?:\.\d+){2}$/.test(currentTag || '')) return ['incomplete', 'Current APK release could not be identified'];
  if (run.tag !== currentTag) return ['diagnostic', 'Archived run targets a different release'];
  if (run.tag !== 'app-v' + report?.app?.versionName || report.mode !== run.mode) {
    return ['incomplete', 'APK version or session mode differs from the archived run'];
  }
  if (!report.steps?.some(step => step.session)) return ['incomplete', 'Session steps missing'];
  const outcome = report.session?.outcome;
  if (!['pass', 'attention', 'fail'].includes(outcome)) return ['incomplete', 'Session verdict missing'];
  const failures = (report.session.findings || []).filter(finding => finding.severity === 'fail').length;
  return [outcome === 'fail' || failures ? 'fail' : outcome, run.tag + ' · ' + failures + ' broken session findings'];
}

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw Error('Public evidence returned HTTP ' + response.status);
  const text = await response.text();
  if (text.length > 8_000_000) throw Error('Public report exceeds evidence size limit');
  return JSON.parse(text);
}

async function main() {
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const id = String(event.workflow_run?.id || event.inputs?.explorer_run || '');
  const repo = process.env.GITHUB_REPOSITORY;
  if (repo !== 'yanniedog/AR-app' || !/^\d+$/.test(id)) throw Error('Missing App Explorer run identity');
  const runApi = await fetchJson('https://api.github.com/repos/' + repo + '/actions/runs/' + id);
  if (runApi.name !== 'app-explorer' || String(runApi.id) !== id || runApi.status !== 'completed') {
    throw Error('Expected a completed App Explorer run');
  }
  if (runApi.event === 'pull_request') {
    console.log('Diagnostic · PR self-test against an existing release');
    return;
  }
  const path = 'https://raw.githubusercontent.com/' + repo + '/explorer/run-' + id + '/';
  const [run, report, releases] = await Promise.all([
    fetchJson(path + 'run.json'), fetchJson(path + 'report.json'),
    fetchJson('https://api.github.com/repos/' + repo + '/releases?per_page=30'),
  ]);
  const latest = releases.find(r => !r.draft && /^app-v\d+(?:\.\d+){2}$/.test(r.tag_name) && r.assets?.some(a => a.name === 'app-preview.apk'));
  if (run.event !== runApi.event) throw Error('Archived run event differs from GitHub');
  const [state, detail] = releaseSessionVerdict(run, report, latest?.tag_name, id);
  console.log(state.toUpperCase() + ' · ' + detail);
  if (state === 'incomplete' || state === 'fail') process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
