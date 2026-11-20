// Rubric review of one explorer run. Reads the run output directory, runs the deterministic UX
// checks over every captured screen and writes ux-review.json and ux-review.md next to it.
// Usage: node ux-review.mjs <explorer-out dir>
import fs from 'node:fs';
import path from 'node:path';
import { checkScreen, contrastFindings, FIXES } from './ux-checks.mjs';

export const PKG = 'com.eyex.australianrates';
const LEGAL = /^\/?(about|terms|privacy|third-party-notices|licen[cs]es?)$/i;
/** Anything that may frustrate, confuse or intimidate a user, or make them less likely to return. */
export const FRUSTRATION = new Set(['dead-end', 'dead-end-state', 'spinner-no-result', 'slow', 'slow-first-value', 'jargon', 'clutter',
  'no-primary-action', 'tap-target', 'crowded-targets', 'nav-inconsistent', 'first-run-gate', 'intimidating-first-run',
  'no-return-reason', 'no-engagement-hook', 'truncated-text']);
const RUBRIC = [
  ['designConsistency', 'Design consistency', ['text-size', 'contrast', 'truncated-text']],
  ['layout', 'Layout', ['overlap', 'off-screen', 'safe-area', 'keyboard-collision', 'clutter']],
  ['easeOfUse', 'Ease of use', ['tap-target', 'dead-end']],
  ['comfort', 'Comfort', ['tap-target', 'spinner-no-result', 'slow']],
  ['helpfulness', 'Helpfulness', ['dead-end-state', 'spinner-no-result', 'dead-end']],
  ['appropriateness', 'Appropriateness', ['prose', 'accuracy']],
  ['onboarding', 'Onboarding ease', ['slow-first-value', 'first-run-gate']],
  ['barriers', 'Barriers to entry and use', ['slow-first-value', 'first-run-gate', 'dead-end-state']],
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

/** Rows rendered on screen: "<product>, <provider>, Comparison rate 5.99%, Advertised rate 5.94% · ..." */
export function parseRows(nodes) {
  const rows = [];
  for (const n of nodes) {
    const d = n.desc || '';
    const m = /^(.+?), (.+?), Comparison rate (\d+(?:\.\d+)?)%(?:, Advertised rate (\d+(?:\.\d+)?)%)?/.exec(d);
    if (!m || /^Save, /.test(d)) continue;
    rows.push({ product: m[1], provider: m[2], comparison: Number(m[3]), advertised: m[4] == null ? null : Number(m[4]), y: n.bounds[1], at: [Math.round((n.bounds[0] + n.bounds[2]) / 2), Math.round((n.bounds[1] + n.bounds[3]) / 2)] });
  }
  return rows;
}

/**
 * Accuracy checks that need no external data, plus a comparison against a published sample
 * ([{product, provider, comparison, advertised}]) when one is supplied.
 */
export function accuracyFindings({ screen, nodes, sample, sortedBy }) {
  const rows = parseRows(nodes);
  const out = [];
  const add = (severity, text, detail, at) => out.push({ check: 'accuracy', severity, screen, text, at: at || [0, 0], detail });
  const seen = new Map();
  for (const r of rows) {
    const key = `${r.provider}|${r.product}|${r.comparison}|${r.advertised}`;
    seen.set(key, (seen.get(key) || 0) + 1);
    if (r.comparison <= 0 || r.comparison > 25) add('major', `${r.product}, ${r.provider}`, `comparison rate ${r.comparison}% outside 0 to 25`, r.at);
    if (r.advertised != null && r.comparison + 0.005 < r.advertised) {
      add('minor', `${r.product}, ${r.provider}`, `comparison ${r.comparison}% is below advertised ${r.advertised}%`, r.at);
    }
    if (sample) {
      const hit = sample.find(s => s.provider === r.provider && s.product === r.product);
      if (hit && (Math.abs(hit.comparison - r.comparison) > 0.005 || (hit.advertised != null && r.advertised != null && Math.abs(hit.advertised - r.advertised) > 0.005))) {
        add('major', `${r.product}, ${r.provider}`, `shows ${r.comparison}% / ${r.advertised}% but published ${hit.comparison}% / ${hit.advertised}%`, r.at);
      }
    }
  }
  for (const [k, n] of seen) if (n > 1) add('minor', k.split('|').slice(0, 2).reverse().join(', '), `row shown ${n} times`);
  if (sortedBy === 'Comparison rate') {
    const list = [...rows].sort((a, b) => a.y - b.y);
    for (let i = 1; i < list.length; i++) {
      if (list[i].comparison + 0.005 < list[i - 1].comparison) {
        add('major', `${list[i].product}, ${list[i].provider}`, `listed below ${list[i - 1].comparison}% but is ${list[i].comparison}% with sort by comparison rate`, list[i].at);
        break;
      }
    }
  }
  return { findings: out, rowsChecked: rows.length };
}

const score = (weighted, screens) => Math.max(0, Math.min(5, Math.round(5 * (1 - Math.min(1, weighted / Math.max(1, screens * 0.5))) * 10) / 10));

async function loadPng(file) {
  try {
    const { PNG } = await import('pngjs');
    return PNG.sync.read(fs.readFileSync(file));
  } catch { return null; }
}

function firstRunMetrics(report, firstNodes) {
  const first = (report.steps || [])[0] || {};
  const ms = first.firstContentMs != null ? first.firstContentMs : first.settleMs;
  const gates = (firstNodes || []).filter(n => n.clickable && FIRST_RUN_GATE.test((n.text || n.desc || '').trim())).map(n => (n.text || n.desc).trim());
  const dialogs = (report.systemDialogs || []).length;
  return { firstValueMs: Number.isFinite(ms) ? ms : null, gates, systemDialogs: dialogs };
}

/** Taps from the first screen to each key task, measured on the control actually on screen. */
function taskMetrics(report, screens) {
  const first = screens[0];
  const has = re => first && first.nodes.some(n => n.clickable && re.test(n.text || n.desc || ''));
  const rows = first ? parseRows(first.nodes) : [];
  const session = (report.steps || []).filter(s => s.session);
  const ms = re => { const s = session.find(x => re.test(x.name)); return s ? (s.firstContentMs != null ? s.firstContentMs : s.settleMs) : null; };
  return [
    { task: 'Find the best rate', taps: rows.length ? 0 : null, ms: report.steps && report.steps[0] ? report.steps[0].settleMs : null },
    { task: 'Compare', taps: has(/^Compare$/) ? 1 : null, ms: ms(/compare/i) },
    { task: 'Open a lender', taps: has(/^Lenders$/) ? 1 : null, ms: ms(/lenders/i) },
    { task: 'Open a product', taps: rows.length ? 1 : null, ms: ms(/open product/i) },
    { task: 'Save a rate', taps: first && first.nodes.some(n => n.clickable && /^Save, /.test(n.desc || '')) ? 1 : null, ms: null },
  ];
}

export async function reviewRun(dir, { sample } = {}) {
  const report = readJson(path.join(dir, 'report.json'), {});
  const size = (report.device && report.device.size) || [720, 1600];
  const density = 320;
  const files = fs.existsSync(path.join(dir, 'ui')) ? fs.readdirSync(path.join(dir, 'ui')).filter(f => f.endsWith('.nodes.json')).sort() : [];
  const stepBySlug = new Map((report.steps || []).map(s => [s.slug, s]));
  const screens = [];
  for (const f of files) {
    const slug = f.replace(/\.nodes\.json$/, '');
    const nodes = readJson(path.join(dir, 'ui', f), []);
    const step = stepBySlug.get(slug) || {};
    screens.push({ slug, name: step.name || slug, nodes, step });
  }
  const findings = [];
  const perScreen = [];
  for (const s of screens) {
    if (/^audit (\d|finished|result)/.test(s.name)) continue; // the audit overlay is a diagnostic, not the product
    const legal = LEGAL.test(s.name) || LEGAL.test(s.step.route || '');
    const r = checkScreen({ screen: s.name, nodes: s.nodes, size, density, pkg: PKG, settleTimedOut: !!s.step.settleTimedOut, allowProse: legal });
    const list = [...r.findings];
    const png = await loadPng(path.join(dir, 'screens', `${s.slug}.png`));
    if (png) list.push(...contrastFindings({ screen: s.name, nodes: s.nodes, png, pkg: PKG, density }));
    const sortedBy = s.nodes.some(n => /^Sort · Comparison rate/.test(n.text || n.desc || '')) ? 'Comparison rate' : null;
    const acc = accuracyFindings({ screen: s.name, nodes: s.nodes, sample, sortedBy });
    list.push(...acc.findings);
    if (s.step.settleMs >= 5000 && !/cold/.test(s.name)) list.push({ check: 'slow', severity: s.step.settleMs >= 10000 ? 'major' : 'minor', screen: s.name, text: '', at: [0, 0], detail: `${(s.step.settleMs / 1000).toFixed(1)} s to settle` });
    findings.push(...list);
    perScreen.push({ slug: s.slug, name: s.name, elements: r.stats.elements, tappable: r.stats.tappable, rows: acc.rowsChecked, findings: list.length, major: list.filter(x => x.severity === 'major').length });
  }

  const firstRun = firstRunMetrics(report, screens[0] && screens[0].nodes);
  if (firstRun.firstValueMs != null && firstRun.firstValueMs >= FIRST_VALUE_MINOR_MS) {
    findings.push({ check: 'slow-first-value', severity: firstRun.firstValueMs >= FIRST_VALUE_MAJOR_MS ? 'major' : 'minor', screen: 'cold start', text: '', at: [0, 0], detail: `${(firstRun.firstValueMs / 1000).toFixed(1)} s from launch to settled rates` });
  }
  for (const g of firstRun.gates) findings.push({ check: 'first-run-gate', severity: 'major', screen: 'cold start', text: g, at: [0, 0], detail: 'control must be tapped before reaching rates' });
  const firstNodes = (screens[0] && screens[0].nodes) || [];
  const scary = firstNodes.find(n => n.pkg === PKG && n.cls === 'EditText') || firstNodes.find(n => n.pkg === PKG && INTIMIDATING.test(n.text || '') && (n.text || '').length < 80);
  if (scary) findings.push({ check: 'intimidating-first-run', severity: 'major', screen: 'cold start', text: (scary.text || scary.cls).slice(0, 60), at: [0, 0], detail: 'input or permission request on first launch' });
  if (firstRun.systemDialogs) findings.push({ check: 'intimidating-first-run', severity: 'minor', screen: 'cold start', text: '', at: [0, 0], detail: `${firstRun.systemDialogs} system dialog(s) over the app` });
  // Navigation: the bottom bar should offer the same destinations wherever it appears.
  const navSets = screens.filter(s => !/^audit /.test(s.name)).map(s => ({ name: s.name, set: s.nodes.filter(n => n.pkg === PKG && n.clickable && n.bounds[1] > size[1] - 220 && (n.text || n.desc)).map(n => (n.text || n.desc).trim()).sort().join('|') })).filter(x => x.set.split('|').length >= 3);
  const modal = [...navSets.reduce((m, x) => m.set(x.set, (m.get(x.set) || 0) + 1), new Map())].sort((a, b) => b[1] - a[1])[0];
  if (modal) for (const x of navSets) if (x.set !== modal[0]) findings.push({ check: 'nav-inconsistent', severity: 'minor', screen: x.name, text: '', at: [0, 0], detail: 'bottom navigation differs from the usual set' });
  const everyNode = screens.flatMap(s => s.nodes);
  const hooks = { saveRow: everyNode.some(n => /^Save, /.test(n.desc || '')), savedTab: everyNode.some(n => /^Saved$/.test(n.text || n.desc || '')), alerts: everyNode.some(n => /alert|notif/i.test(n.text || n.desc || '')) };
  if (screens.length && !hooks.saveRow && !hooks.savedTab) findings.push({ check: 'no-engagement-hook', severity: 'major', screen: 'all', text: '', at: [0, 0], detail: 'no save control or Saved destination found' });

  if (screens.length && !everyNode.some(n => RETURN_REASON.test(n.text || '')) && !hooks.alerts) {
    findings.push({ check: 'no-return-reason', severity: 'minor', screen: 'all', text: '', at: [0, 0], detail: 'no change or recency signal and no alerts' });
  }
  for (const f of findings) if (!f.fix) f.fix = FIXES[f.check] || '';
  const reviewed = perScreen.length;
  const rubric = RUBRIC.map(([key, title, checks]) => {
    const mine = findings.filter(f => checks.includes(f.check));
    const weighted = mine.reduce((t, f) => t + WEIGHT[f.severity], 0);
    const top = [...mine].sort((a, b) => WEIGHT[b.severity] - WEIGHT[a.severity]).slice(0, 3).map(f => `${f.severity} ${f.screen}: ${f.check}${f.text ? ` "${f.text}"` : ''} (${f.detail}). Fix: ${f.fix}`);
    return { key, title, score: reviewed ? score(weighted, reviewed) : null, findings: mine.length, top };
  });
  const tasks = taskMetrics(report, screens);
  const counts = {};
  for (const f of findings) counts[f.check] = (counts[f.check] || 0) + 1;
  const result = { schemaVersion: 1, screens: reviewed, findingsTotal: findings.length, major: findings.filter(f => f.severity === 'major').length, counts, rubric, tasks, firstRun, hooks, perScreen, findings, sampleChecked: !!sample };
  result.summaryLines = summaryLines(result);
  return result;
}

const sec = ms => (ms == null ? 'n/a' : `${(ms / 1000).toFixed(1)} s`);

/** Outcome first, short enough for the results issue. */
export function summaryLines(r) {
  if (!r.screens) return ['UX review: no raw screen data in this run'];
  const worst = [...r.rubric].filter(x => x.score != null).sort((a, b) => a.score - b.score).slice(0, 3);
  const lines = [`UX review: ${r.major} major, ${r.findingsTotal - r.major} minor across ${r.screens} screens. Weakest: ${worst.map(w => `${w.title} ${w.score}/5`).join(', ')}.`];
  lines.push(`First value ${sec(r.firstRun.firstValueMs)}, ${r.firstRun.gates.length} gate taps. Taps: ${r.tasks.map(t => `${t.task.toLowerCase()} ${t.taps == null ? '?' : t.taps}`).join(', ')}.`);
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
  for (const t of r.tasks) out.push(`| ${t.task} | ${t.taps == null ? 'not found' : t.taps} | ${sec(t.ms)} |`);
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
