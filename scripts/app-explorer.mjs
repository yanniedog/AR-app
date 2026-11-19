#!/usr/bin/env node
// Local client for .github/workflows/app-explorer.yml.
//   node scripts/app-explorer.mjs run [--tag latest] [--mode crawl|script] [--script steps.json]
//                                     [--routes /browse,/market] [--keep-data] [--no-wait]
//   node scripts/app-explorer.mjs fetch <runId|latest>
//   node scripts/app-explorer.mjs list
// Results land in .explorer/<runId>/ (report.md, report.json, screens/, ui/, logcat.txt).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const REPO = process.env.APP_EXPLORER_REPO || 'yanniedog/AR-app';
const WORKFLOW = 'app-explorer.yml';
const OUT = path.join(ROOT, '.explorer');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const gh = (args, input) => execFileSync('gh', args, { encoding: 'utf8', input, maxBuffer: 32 * 1024 * 1024 });
const git = args => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

function opts(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) o[key] = true;
      else { o[key] = next; i += 1; }
    } else o._.push(a);
  }
  return o;
}

function runs(limit = 10) {
  return JSON.parse(gh(['api', `repos/${REPO}/actions/workflows/${WORKFLOW}/runs?per_page=${limit}`])).workflow_runs;
}

async function dispatch(o) {
  const inputs = { tag: o.tag || 'latest', mode: o.mode || (o.script ? 'script' : 'crawl'), fresh: o['keep-data'] ? 'false' : 'true' };
  if (o.script) {
    const steps = JSON.parse(fs.readFileSync(o.script, 'utf8'));
    inputs.script = JSON.stringify(steps);
  }
  if (o.routes) inputs.routes = o.routes;
  const before = new Set(runs(20).map(r => r.id));
  const body = JSON.stringify({ ref: o.ref || 'main', inputs });
  gh(['api', '-X', 'POST', `repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, '--input', '-'], body);
  for (let i = 0; i < 30; i += 1) {
    await sleep(3000);
    const fresh = runs(10).find(r => !before.has(r.id) && r.event === 'workflow_dispatch');
    if (fresh) return fresh.id;
  }
  throw new Error('Dispatched, but the run did not appear within 90 s');
}

async function wait(runId) {
  const t0 = Date.now();
  let last = '';
  while (true) {
    const run = JSON.parse(gh(['api', `repos/${REPO}/actions/runs/${runId}`]));
    const state = `${run.status}${run.conclusion ? `/${run.conclusion}` : ''}`;
    if (state !== last) {
      console.error(`[${Math.round((Date.now() - t0) / 1000)}s] run ${runId}: ${state}`);
      last = state;
    }
    if (run.status === 'completed') return run;
    await sleep(20000);
  }
}

function fetchResults(runId) {
  const branch = `explorer/run-${runId}`;
  const dir = path.join(OUT, String(runId));
  git(['fetch', '--depth', '1', 'https://github.com/' + REPO, `refs/heads/${branch}`]);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const tar = execFileSync('git', ['-C', ROOT, 'archive', '--format=tar', 'FETCH_HEAD'], { maxBuffer: 512 * 1024 * 1024 });
  execFileSync('tar', ['-x', '-C', dir], { input: tar });
  return dir;
}

function latestRunId() {
  const heads = git(['ls-remote', '--heads', 'https://github.com/' + REPO, 'explorer/run-*'])
    .split('\n').map(l => Number((/explorer\/run-(\d+)/.exec(l) || [])[1])).filter(Boolean);
  if (!heads.length) throw new Error('No explorer results branches yet');
  return Math.max(...heads);
}

function show(dir) {
  console.log(fs.readFileSync(path.join(dir, 'report.md'), 'utf8'));
  console.log(`Results: ${dir}`);
}

async function main() {
  const o = opts(process.argv.slice(2));
  const cmd = o._[0] || 'run';
  if (cmd === 'list') {
    for (const r of runs(15)) console.log(`${r.id}  ${r.event.padEnd(17)} ${r.status}/${r.conclusion ?? ''}  ${r.created_at}`);
    return;
  }
  if (cmd === 'fetch') {
    const id = !o._[1] || o._[1] === 'latest' ? latestRunId() : Number(o._[1]);
    show(fetchResults(id));
    return;
  }
  if (cmd === 'run') {
    const id = await dispatch(o);
    console.error(`Run ${id}: https://github.com/${REPO}/actions/runs/${id}`);
    if (o['no-wait']) return;
    const run = await wait(id);
    try {
      show(fetchResults(id));
    } catch (error) {
      console.error(`No results branch for run ${id} (${run.conclusion}). ${error.message.split('\n')[0]}`);
      process.exitCode = 1;
    }
    return;
  }
  throw new Error(`Unknown command ${cmd}`);
}

main().catch(error => {
  console.error(error.message || error);
  process.exit(1);
});
