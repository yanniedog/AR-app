// Rubric review of one explorer run. Reads the run output directory, runs the deterministic UX
// checks over every captured screen and writes ux-review.json and ux-review.md next to it.
// Usage: node ux-review.mjs <explorer-out dir>
import fs from 'node:fs';
import path from 'node:path';
import { checkScreen, contrastFindings, decodePng, FIXES } from './ux-checks.mjs';

export const PKG = 'com.eyex.australianrates';
const LEGAL = /^\/?(about|terms|privacy|third-party-notices|licen[cs]es?)$/i;
/** Anything that may frustrate, confuse or intimidate a user, or make them less likely to return. */
export const FRUSTRATION = new Set(['dead-end', 'dead-end-state', 'spinner-no-result', 'slow', 'slow-first-value', 'slow-relaunch', 'no-first-value', 'jargon', 'clutter',
  'no-primary-action', 'tap-target', 'crowded-targets', 'nav-inconsistent', 'first-run-gate', 'intimidating-first-run',
  'no-return-reason', 'no-engagement-hook', 'truncated-text']);
const RUBRIC = [
  ['designConsistency', 'Design consistency', ['text-size', 'contrast', 'truncated-text']],
  ['layout', 'Layout', ['overlap', 'off-screen', 'safe-area', 'keyboard-collision', 'clutter']],
  ['easeOfUse', 'Ease of use', ['tap-target', 'dead-end']],
  ['comfort', 'Comfort', ['tap-target', 'spinner-no-result', 'slow']],
  ['helpfulness', 'Helpfulness', ['dead-end-state', 'spinner-no-result', 'dead-end']],
  ['appropriateness', 'Appropriateness', ['prose', 'accuracy']],
  ['onboarding', 'Onboarding ease', ['slow-first-value', 'no-first-value', 'first-run-gate']],
  ['barriers', 'Barriers to entry and use', ['slow-first-value', 'slow-relaunch', 'no-first-value', 'first-run-gate', 'dead-end-state']],
  ['engagement', 'Engagement hooks', ['no-engagement-hook', 'no-return-reason']],
  ['frustration', 'Frustration and abandonment risk', [...FRUSTRATION]],
];
const INTIMIDATING = /setup key|password|sign in|log in|register|create an account|permission|required/i;
const RETURN_REASON = /\b(updated|changed|since|new today|today|yesterday|ago)\b/i;
const WEIGHT = { major: 1, minor: 0.25 };
const FIRST_RUN_GATE = /^(allow|accept|continue|get started|skip|next|agree|i agree|sign in|log in|enter (the )?(setup )?key)$/i;
export const FIRST_VALUE_MAJOR_MS = 10000;
export const FIRST_VALUE_MINOR_MS = 4000;

const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };

const METRIC = {
  'Comparison rate': 'comparison', 'Advertised rate': 'advertised', 'Ongoing rate': 'ongoing', Rate: 'rate',
  'Public payable rate': 'payable', 'Calculated payable rate': 'payable', 'Last verified pricing': 'payable',
};
const RATE_KEYS = ['comparison', 'advertised', 'ongoing', 'rate', 'payable'];
const RATE_LABELS = Object.keys(METRIC).sort((x, y) => y.length - x.length).join('|');
const ROW_HEAD = new RegExp(`^(.+?), (.+?), (?=(?:${RATE_LABELS}|Pricing unresolved|Your entered rates|Local reference estimate) )`);
const ROW_RATE = new RegExp(`(?:^|, )(${RATE_LABELS}) (-?\\d+(?:\\.\\d+)?)%`, 'g');

/** Rows rendered on screen: "<product>, <provider>, <rate label> 5.99%, <rate label> 5.94% · ..." in any label order. */
export function parseRows(nodes) {
  const rows = [];
  for (const n of nodes) {
    const d = n.desc || '';
    if (/^(Save|Remove), /.test(d)) continue;
    const head = ROW_HEAD.exec(d);
    if (!head) continue;
    const row = { product: head[1], provider: head[2], comparison: null, advertised: null, ongoing: null, rate: null, payable: null, tier: (/#(\d+)/.exec(d) || [])[1] || '', y: n.bounds[1], at: [Math.round((n.bounds[0] + n.bounds[2]) / 2), Math.round((n.bounds[1] + n.bounds[3]) / 2)] };
    let found = false;
    for (const m of d.slice(head[0].length - 2).matchAll(ROW_RATE)) { row[METRIC[m[1]]] = Number(m[2]); found = true; }
    if (found) rows.push(row);
  }
  return rows;
}

/**
 * Accuracy checks that need no external data, plus a comparison against a published sample
 * ([{product, provider, comparison, advertised}]) when one is supplied.
 */
export function accuracyFindings({ screen, nodes, sample, sortedBy, lowerIsBetter }) {
  const rows = parseRows(nodes);
  const out = [];
  const add = (severity, text, detail, at) => out.push({ check: 'accuracy', severity, screen, text, at: at || [0, 0], detail });
  const same = (a, b) => (a == null) === (b == null) && (a == null || Math.abs(a - b) <= 0.005);
  const groups = new Map();
  for (const r of rows) {
    const name = `${r.product}, ${r.provider}`;
    const group = groups.get(`${r.provider}|${r.product}|${r.tier}`) || [];
    group.push(r);
    groups.set(`${r.provider}|${r.product}|${r.tier}`, group);
    for (const k of RATE_KEYS) {
      // A published 0% is valid on deposits; on loans a rate must be above zero.
      const zeroOk = lowerIsBetter === false || k === 'rate';
      if (r[k] != null && ((zeroOk ? r[k] < 0 : r[k] <= 0) || r[k] > 25)) add('major', name, `${k} rate ${r[k]}% outside ${zeroOk ? '0' : 'above 0'} to 25`, r.at);
    }
    if (r.comparison != null && r.advertised != null && r.comparison + 0.005 < r.advertised) {
      add('minor', name, `comparison ${r.comparison}% is below advertised ${r.advertised}%`, r.at);
    }
    if (sample) {
      const hit = sample.find(x => x.provider === r.provider && x.product === r.product);
      if (hit && (!same(hit.comparison, r.comparison) || !same(hit.advertised, r.advertised))) {
        add('major', name, `shows ${r.comparison ?? 'none'}% / ${r.advertised ?? 'none'}% but published ${hit.comparison ?? 'none'}% / ${hit.advertised ?? 'none'}%`, r.at);
      }
    }
  }
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const r = list[0];
    const differ = list.some(x => !same(x.comparison, r.comparison) || !same(x.advertised, r.advertised) || RATE_KEYS.some(k => !same(x[k], r[k])));
    add(differ ? 'major' : 'minor', `${r.product}, ${r.provider}`, differ ? `shown ${list.length} times with different rates` : `row shown ${list.length} times`, r.at);
  }
  const key = METRIC[sortedBy];
  // Loans list the lowest rate first, deposits the highest. Without a known section the direction is unknown.
  if (key && typeof lowerIsBetter === 'boolean') {
    const list = rows.filter(r => r[key] != null).sort((a, b) => a.y - b.y);
    for (let i = 1; i < list.length; i++) {
      const out = lowerIsBetter ? list[i][key] + 0.005 < list[i - 1][key] : list[i][key] > list[i - 1][key] + 0.005;
      if (out) {
        add('major', `${list[i].product}, ${list[i].provider}`, `listed after ${list[i - 1][key]}% but is ${list[i][key]}% with sort by ${sortedBy.toLowerCase()}`, list[i].at);
        break;
      }
    }
  }
  return { findings: out, rowsChecked: rows.length };
}

const score = (weighted, screens) => Math.max(0, Math.min(5, Math.round(5 * (1 - Math.min(1, weighted / Math.max(1, screens * 0.5))) * 10) / 10));

function loadPng(file) {
  try { return decodePng(fs.readFileSync(file)); } catch { return null; }
}

const errorScreen = nodes => nodes.some(n => n.pkg === PKG && /^Data unavailable/i.test((n.text || n.desc || '').trim()));
const LAUNCH = /open[ -]app|cold[ -]start|launch/i;

/** Time from launch to rates showing: only when the driver measured it and the settled screen holds rate rows. */
function firstRunMetrics(report, screens) {
  const first = screens[0] || { nodes: [], step: {} };
  const rows = parseRows(first.nodes).length;
  const ms = first.step.firstContentMs;
  const gates = first.nodes.filter(n => n.pkg === PKG && n.clickable && FIRST_RUN_GATE.test((n.text || n.desc || '').trim())).map(n => (n.text || n.desc).trim());
  return { firstValueMs: Number.isFinite(ms) && rows > 0 && !errorScreen(first.nodes) ? ms : null, ratesShown: rows > 0, gates };
}

/** Tap counts and times come from named report steps. Anything the driver did not record, or that ended on an error screen, is null (unknown). */
function taskMetrics(report, screens) {
  const bySlug = new Map(screens.map(s => [s.slug, s]));
  const step = re => (report.steps || []).find(s => re.test(s.name || ''));
  const ok = s => s && !s.error && s.alive !== false && !s.anr && !errorScreen((bySlug.get(s.slug) || { nodes: [] }).nodes);
  const ms = s => (ok(s) && Number.isFinite(s.firstContentMs) ? s.firstContentMs : null);
  const tapped = s => (ok(s) && s.tapped ? 1 : null);
  const launch = step(LAUNCH);
  const launchRows = launch && bySlug.has(launch.slug) ? parseRows(bySlug.get(launch.slug).nodes).length : 0;
  const compare = step(/compare/i);
  // The Lenders control opens the filter sheet, so only a step that opens a lender's own page counts.
  const lenders = step(/lender detail|open (a )?lender$/i);
  const product = step(/open product/i);
  return [
    { task: 'Find the best rate', taps: ms(launch) != null && launchRows > 0 ? 0 : null, ms: launchRows > 0 ? ms(launch) : null },
    { task: 'Compare', taps: tapped(compare), ms: ms(compare) },
    { task: 'Open a lender', taps: tapped(lenders), ms: ms(lenders) },
    { task: 'Open a product', taps: tapped(product), ms: ms(product) },
    { task: 'Save a rate', taps: null, ms: null },
  ];
}

export async function reviewRun(dir, { sample } = {}) {
  const report = readJson(path.join(dir, 'report.json'), {});
  const defaultSize = (report.device && report.device.size) || [720, 1600];
  const density = 320;
  const screens = [];
  // Only the screens this run's steps produced; files left by an earlier run are ignored.
  for (const step of report.steps || []) {
    if (!step.slug) continue;
    const saved = readJson(path.join(dir, 'ui', `${step.slug}.nodes.json`), null);
    if (!saved) continue;
    const nodes = Array.isArray(saved) ? saved : saved.nodes || [];
    screens.push({ slug: step.slug, name: step.name || step.slug, nodes, step, size: (!Array.isArray(saved) && saved.size) || defaultSize });
  }
  let contrastMeasured = 0;
  const findings = [];
  const perScreen = [];
  for (const s of screens) {
    if (/^audit (\d|finished|result)/.test(s.name)) continue; // the audit overlay is a diagnostic, not the product
    const legal = LEGAL.test(s.name) || LEGAL.test(s.step.route || '');
    const r = checkScreen({ screen: s.name, nodes: s.nodes, size: s.size, density, pkg: PKG, settleTimedOut: !!s.step.settleTimedOut, allowProse: legal });
    const list = [...r.findings];
    const png = loadPng(path.join(dir, 'screens', `${s.slug}.png`));
    if (png) { list.push(...contrastFindings({ screen: s.name, nodes: s.nodes, png, pkg: PKG, density, size: s.size })); contrastMeasured += 1; }
    const sortedBy = (s.nodes.map(n => /^Sort · (Comparison rate|Advertised rate|Ongoing rate|Rate)\b/.exec(n.text || n.desc || '')).find(Boolean) || [])[1] || null;
    const section = (s.nodes.map(n => n.selected && /^(Home loans|Savings|Term deposits)\b/.exec((n.text || n.desc || '').trim())).find(Boolean) || [])[1];
    const acc = accuracyFindings({ screen: s.name, nodes: s.nodes, sample, sortedBy, lowerIsBetter: section ? section === 'Home loans' : undefined });
    list.push(...acc.findings);
    if (s.step.settleMs >= 5000 && !/cold/.test(s.name)) list.push({ check: 'slow', severity: s.step.settleMs >= 10000 ? 'major' : 'minor', screen: s.name, text: '', at: [0, 0], detail: `${(s.step.settleMs / 1000).toFixed(1)} s to settle` });
    findings.push(...list);
    perScreen.push({ slug: s.slug, name: s.name, elements: r.stats.elements, tappable: r.stats.tappable, rows: acc.rowsChecked, findings: list.length, major: list.filter(x => x.severity === 'major').length });
  }

  const firstRun = firstRunMetrics(report, screens);
  if (screens[0] && LAUNCH.test(screens[0].name) && !firstRun.ratesShown) {
    findings.push({ check: 'no-first-value', severity: 'major', screen: 'cold start', text: '', at: [0, 0], detail: errorScreen(screens[0].nodes) ? 'launch ended on the data unavailable screen' : 'no rate rows on the first screen' });
  }
  if (firstRun.firstValueMs != null && firstRun.firstValueMs >= FIRST_VALUE_MINOR_MS) {
    findings.push({ check: 'slow-first-value', severity: firstRun.firstValueMs >= FIRST_VALUE_MAJOR_MS ? 'major' : 'minor', screen: 'cold start', text: '', at: [0, 0], detail: `${(firstRun.firstValueMs / 1000).toFixed(1)} s from launch to rates showing` });
  }
  // A returning user has cached data, so a relaunch is held to the same limits and reported separately from the first install.
  const relaunch = screens.slice(1).find(s => /cold[ -]start|relaunch/i.test(s.name));
  if (relaunch) {
    const ms = relaunch.step.firstContentMs;
    firstRun.relaunchValueMs = Number.isFinite(ms) && parseRows(relaunch.nodes).length > 0 && !errorScreen(relaunch.nodes) ? ms : null;
    if (firstRun.relaunchValueMs != null && firstRun.relaunchValueMs >= FIRST_VALUE_MINOR_MS) {
      findings.push({ check: 'slow-relaunch', severity: firstRun.relaunchValueMs >= FIRST_VALUE_MAJOR_MS ? 'major' : 'minor', screen: relaunch.name, text: '', at: [0, 0], detail: `${(firstRun.relaunchValueMs / 1000).toFixed(1)} s from relaunch to rates showing` });
    }
  }
  for (const g of firstRun.gates) findings.push({ check: 'first-run-gate', severity: 'major', screen: 'cold start', text: g, at: [0, 0], detail: 'control must be tapped before reaching rates' });
  const firstNodes = (screens[0] && screens[0].nodes) || [];
  // An ordinary field such as Rates search is not a barrier; a setup or permission request is.
  const scary = firstNodes.find(n => n.pkg === PKG && INTIMIDATING.test(n.text || n.desc || '') && (n.text || n.desc || '').length < 80);
  if (scary) findings.push({ check: 'intimidating-first-run', severity: 'major', screen: 'cold start', text: (scary.text || scary.desc).slice(0, 60), at: [0, 0], detail: 'setup or permission request on first launch' });
  // Navigation: the bottom bar should offer the same destinations wherever it appears.
  // Primary tabs are identified by their labels, not by position: a scrolled row near the bottom is not navigation.
  const TABS = ['Rates', 'Saved', 'Market'];
  for (const s of screens.filter(x => !/^audit /.test(x.name))) {
    const tabs = new Set(s.nodes.filter(n => n.pkg === PKG && n.clickable && n.bounds[1] > s.size[1] - 220 && TABS.includes((n.text || n.desc || '').trim())).map(n => (n.text || n.desc).trim()));
    if (tabs.size > 0 && tabs.size < TABS.length) findings.push({ check: 'nav-inconsistent', severity: 'minor', screen: s.name, text: TABS.filter(t => !tabs.has(t)).join(', '), at: [0, 0], detail: 'tab bar is missing destinations' });
  }
  const everyNode = screens.flatMap(s => s.nodes);
  const hooks = { saveRow: everyNode.some(n => /^Save, /.test(n.desc || '')), savedTab: everyNode.some(n => /^Saved$/.test(n.text || n.desc || '')), alerts: everyNode.some(n => /alert|notif/i.test(n.text || n.desc || '')) };
  if (screens.length && !hooks.saveRow && !hooks.savedTab) findings.push({ check: 'no-engagement-hook', severity: 'major', screen: 'all', text: '', at: [0, 0], detail: 'no save control or Saved destination found' });

  if (screens.length && !everyNode.some(n => RETURN_REASON.test(n.text || '')) && !hooks.alerts) {
    findings.push({ check: 'no-return-reason', severity: 'minor', screen: 'all', text: '', at: [0, 0], detail: 'no change or recency signal and no alerts' });
  }
  const reviewed = perScreen.length;
  if (reviewed && !contrastMeasured) findings.push({ check: 'contrast-not-measured', severity: 'minor', screen: 'all', text: '', at: [0, 0], detail: 'no screenshot could be read, so contrast was not checked', fix: FIXES['contrast-not-measured'] });
  for (const f of findings) if (!f.fix) f.fix = FIXES[f.check] || '';
  const rubric = RUBRIC.map(([key, title, checks]) => {
    const mine = findings.filter(f => checks.includes(f.check));
    const weighted = mine.reduce((t, f) => t + WEIGHT[f.severity], 0);
    const top = [...mine].sort((a, b) => WEIGHT[b.severity] - WEIGHT[a.severity]).slice(0, 3).map(f => `${f.severity} ${f.screen}: ${f.check}${f.text ? ` "${f.text}"` : ''} (${f.detail}). Fix: ${f.fix}`);
    return { key, title, score: reviewed ? score(weighted, reviewed) : null, findings: mine.length, top };
  });
  const tasks = taskMetrics(report, screens);
  const counts = {};
  for (const f of findings) counts[f.check] = (counts[f.check] || 0) + 1;
  const result = { schemaVersion: 1, screens: reviewed, findingsTotal: findings.length, major: findings.filter(f => f.severity === 'major').length, counts, rubric, tasks, firstRun, hooks, perScreen, findings, sampleChecked: !!sample, contrastMeasured: contrastMeasured > 0 };
  result.summaryLines = summaryLines(result);
  return result;
}

const sec = ms => (ms == null ? 'unknown' : `${(ms / 1000).toFixed(1)} s`);

/** Outcome first, short enough for the results issue. */
export function summaryLines(r) {
  if (!r.screens) return ['UX review: no raw screen data in this run'];
  const worst = [...r.rubric].filter(x => x.score != null).sort((a, b) => a.score - b.score).slice(0, 3);
  const lines = [`UX review: ${r.major} major, ${r.findingsTotal - r.major} minor across ${r.screens} screens. Weakest: ${worst.map(w => `${w.title} ${w.score}/5`).join(', ')}.`];
  if (!r.contrastMeasured) lines.push('Contrast not measured.');
  lines.push(`First value ${sec(r.firstRun.firstValueMs)}${r.firstRun.relaunchValueMs !== undefined ? `, relaunch ${sec(r.firstRun.relaunchValueMs)}` : ''}, ${r.firstRun.gates.length} gate taps. Taps: ${r.tasks.map(t => `${t.task.toLowerCase()} ${t.taps == null ? 'unknown' : t.taps}`).join(', ')}.`);
  const line = f => `- ${f.severity} | ${f.screen}: ${f.check}${f.text ? ` "${f.text.slice(0, 50)}"` : ''}, ${f.detail} | Fix: ${f.fix}`;
  for (const f of r.findings.filter(f => f.severity === 'major' && !FRUSTRATION.has(f.check)).slice(0, 4)) lines.push(line(f));
  const fr = r.findings.filter(f => FRUSTRATION.has(f.check));
  const frScore = r.rubric.find(x => x.key === 'frustration');
  lines.push('', `Frustration and abandonment risk ${frScore && frScore.score != null ? `${frScore.score}/5` : 'n/a'}: ${fr.filter(f => f.severity === 'major').length} major, ${fr.filter(f => f.severity !== 'major').length} minor.`);
  const seen = new Set();
  for (const f of [...fr].sort((a, b) => WEIGHT[b.severity] - WEIGHT[a.severity])) {
    const k = `${f.check}|${f.screen}`;
    if (seen.has(k) || seen.size >= 6) continue;
    seen.add(k);
    lines.push(line(f));
  }
  return lines;
}

export function renderMarkdown(r) {
  const out = ['# UX review', '', ...r.summaryLines, '', '| dimension | score | findings |', '| --- | --- | --- |'];
  for (const d of r.rubric) out.push(`| ${d.title} | ${d.score == null ? 'n/a' : `${d.score}/5`} | ${d.findings} |`);
  out.push('', '## Task cost', '', '| task | taps from first screen | seconds |', '| --- | --- | --- |');
  for (const t of r.tasks) out.push(`| ${t.task} | ${t.taps == null ? 'unknown' : t.taps} | ${sec(t.ms)} |`);
  out.push('', '## Top findings per dimension', '');
  for (const d of r.rubric.filter(x => x.top.length)) out.push(`**${d.title}**`, ...d.top.map(t => `- ${t}`), '');
  out.push('## Screens', '', '| screen | elements | tappable | findings | major |', '| --- | --- | --- | --- | --- |');
  for (const s of r.perScreen) out.push(`| ${s.name} | ${s.elements} | ${s.tappable} | ${s.findings} | ${s.major} |`);
  return out.join('\n') + '\n';
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2];
  if (!dir) { console.error('usage: node ux-review.mjs <explorer-out dir> [published-sample.json]'); process.exit(2); }
  const sample = process.argv[3] ? readJson(process.argv[3], null) : readJson(path.join(dir, 'published-sample.json'), null);
  const r = await reviewRun(dir, { sample });
  fs.writeFileSync(path.join(dir, 'ux-review.json'), JSON.stringify(r, null, 1));
  fs.writeFileSync(path.join(dir, 'ux-review.md'), renderMarkdown(r));
  console.log(r.summaryLines.join('\n'));
}
