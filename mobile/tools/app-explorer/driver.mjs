#!/usr/bin/env node
// Drives an installed AR-app build on an adb-connected Android device or emulator.
// Modes: crawl (every public route plus the primary tabs) and script (JSON steps).
// Output: <out>/report.json, <out>/report.md, <out>/screens/*.png, <out>/ui/*.json,
// <out>/logcat.txt. No dependencies beyond Node and adb.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const PKG = 'com.eyex.australianrates';
const SCHEME = 'arrates';

// Routes reachable by deep link without parameters (see app/+native-intent.tsx).
export const CRAWL_ROUTES = [
  '/browse', '/watchlist', '/market', '/tools', '/trends', '/search', '/banks', '/bank-rates',
  '/categories', '/catalogue', '/compare', '/matches', '/calculator', '/projections', '/profile',
  '/research', '/rba', '/rba-response', '/settings', '/about', '/terms', '/privacy', '/third-party-notices',
  '/node', '/passthrough', '/calculation-receipt', '/rate-receipt',
];

function parseArgs(argv) {
  const args = { mode: 'crawl', out: 'explorer-out', settleTimeoutMs: 20000, coldTimeoutMs: 240000 };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const next = () => argv[++i];
    if (key === '--mode') args.mode = next();
    else if (key === '--script') args.script = next();
    else if (key === '--script-json') args.scriptJson = next();
    else if (key === '--out') args.out = next();
    else if (key === '--baseline') args.baseline = next();
    else if (key === '--routes') args.routes = next().split(',').map(s => s.trim()).filter(Boolean);
    else if (key === '--fresh') args.fresh = true;
    else if (key === '--audit') args.audit = next();
    else if (key === '--private-audit') args.privateAudit = true;
    else if (key === '--audit-timeout-min') args.auditTimeoutMin = Number(next());
    else throw new Error(`Unknown argument ${key}`);
  }
  return args;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Fetch an uploaded log, following paste.rs share pointers whose body is only the canonical URL. */
async function fetchUploadedLog(url) {
  let current = url;
  const hops = [];
  for (let i = 0; i < 3; i += 1) {
    const res = await fetch(current, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
    const body = await res.text();
    const pointer = body.trim();
    if (/^https:\/\/\S+$/.test(pointer) && pointer.length < 300) {
      hops.push(current);
      current = pointer;
      continue;
    }
    return { body, status: res.status, contentUrl: current, hops };
  }
  throw new Error('too many share-link hops');
}

function adb(args, { allowFail = false, timeout = 60000, encoding = 'utf8' } = {}) {
  const res = spawnSync('adb', args, { encoding, timeout, maxBuffer: 64 * 1024 * 1024 });
  if (res.status !== 0 && !allowFail) {
    throw new Error(`adb ${args.join(' ')} failed: ${res.stderr || res.stdout || res.error}`);
  }
  return res.stdout;
}
const sh = (cmd, opts) => adb(['shell', cmd], opts);

// ---------- UI hierarchy ----------

const ATTR = /([a-z-]+)="([^"]*)"/g;
function decode(value) {
  return value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&#10;/g, '\n').replace(/&amp;/g, '&');
}

export function parseHierarchy(xml) {
  const nodes = [];
  for (const match of xml.matchAll(/<node\b([^>]*?)\/?>/g)) {
    const attrs = {};
    for (const [, k, v] of match[1].matchAll(ATTR)) attrs[k] = decode(v);
    const b = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(attrs.bounds || '');
    if (!b) continue;
    const [x1, y1, x2, y2] = b.slice(1).map(Number);
    nodes.push({
      text: attrs.text || '',
      desc: attrs['content-desc'] || '',
      id: (attrs['resource-id'] || '').replace(/^.*:id\//, ''),
      cls: (attrs.class || '').split('.').pop(),
      clickable: attrs.clickable === 'true',
      scrollable: attrs.scrollable === 'true',
      checked: attrs.checked === 'true',
      selected: attrs.selected === 'true',
      enabled: attrs.enabled !== 'false',
      pkg: attrs.package || '',
      bounds: [x1, y1, x2, y2],
    });
  }
  return nodes;
}

async function dumpUi() {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const out = sh('uiautomator dump --compressed /sdcard/ui.xml 2>&1', { allowFail: true, timeout: 30000 }) || '';
    if (/dumped to/i.test(out)) {
      const xml = sh('cat /sdcard/ui.xml', { allowFail: true }) || '';
      if (xml.includes('<hierarchy')) return { xml, nodes: parseHierarchy(xml) };
    }
    await sleep(400);
  }
  return { xml: '', nodes: [] };
}

function fingerprint(nodes) {
  return createHash('sha1')
    .update(nodes.map(n => `${n.text}|${n.desc}|${n.bounds.join(',')}`).join('\n'))
    .digest('hex');
}

const LOADING = /^(loading|preparing|downloading|verifying|checking)\b|…$/i;
function looksLoading(nodes) {
  return nodes.some(n => n.cls === 'ProgressBar' || LOADING.test(n.text) || LOADING.test(n.desc));
}

/** Wait until two consecutive hierarchies match and no loading indicator remains. */
const systemDialogs = [];
/** Dismiss system "isn't responding" dialogs; an ANR in this app is recorded as a finding. */
function dismissSystemDialog(nodes) {
  const anr = nodes.find(n => /isn.t responding/i.test(n.text));
  if (!anr) return false;
  const ours = /australian ?rates|ar app/i.test(anr.text);
  const button = findNode(nodes, ours ? 'Wait' : 'Close app') || findNode(nodes, 'Wait');
  systemDialogs.push({ at: new Date().toISOString(), text: anr.text, ours });
  if (button) sh(`input tap ${centre(button).join(' ')}`);
  return true;
}

async function settle(timeoutMs, since = Date.now()) {
  const start = since;
  let prev = null;
  let last = { nodes: [] };
  let stableSince = null;
  let firstSeen = start;
  while (Date.now() - start < timeoutMs) {
    const dumpStarted = Date.now();
    last = await dumpUi();
    if (dismissSystemDialog(last.nodes)) {
      prev = null;
      await sleep(800);
      continue;
    }
    const fp = fingerprint(last.nodes);
    const loading = looksLoading(last.nodes);
    if (fp !== prev) firstSeen = dumpStarted;
    if (fp === prev && !loading && last.nodes.length > 0) {
      stableSince ??= Date.now();
      if (Date.now() - stableSince >= 600) {
        return { ...last, settleMs: Math.max(0, firstSeen - start), timedOut: false };
      }
    } else {
      stableSince = null;
    }
    prev = fp;
    await sleep(150);
  }
  return { ...last, settleMs: Date.now() - start, timedOut: true };
}

// ---------- selectors ----------

function matches(node, sel) {
  const norm = s => s.toLowerCase().replace(/\s+/g, ' ').trim();
  if (sel.id && node.id !== sel.id) return false;
  if (sel.text && norm(node.text) !== norm(sel.text)) return false;
  if (sel.desc && norm(node.desc) !== norm(sel.desc)) return false;
  if (sel.contains) {
    const needle = norm(sel.contains);
    if (!norm(node.text).includes(needle) && !norm(node.desc).includes(needle)) return false;
  }
  if (sel.label) {
    const want = norm(sel.label);
    if (norm(node.text) !== want && norm(node.desc) !== want) return false;
  }
  return true;
}

function normalizeSelector(sel) {
  return typeof sel === 'string' ? { label: sel } : sel;
}

function findNode(nodes, rawSel) {
  const sel = normalizeSelector(rawSel);
  const hits = nodes.filter(n => matches(n, sel) && n.bounds[2] > n.bounds[0] && n.bounds[3] > n.bounds[1]);
  if (!hits.length) return null;
  return hits[Math.min(sel.index ?? 0, hits.length - 1)];
}

const centre = n => [Math.round((n.bounds[0] + n.bounds[2]) / 2), Math.round((n.bounds[1] + n.bounds[3]) / 2)];

/** Visible, de-duplicated screen summary an agent can read without the PNG. */
export function summarize(nodes) {
  const items = [];
  const seen = new Set();
  for (const n of nodes) {
    if (n.pkg && n.pkg !== PKG && !/permissioncontroller|android$/.test(n.pkg)) continue;
    const label = n.text || n.desc;
    if (!label && !n.clickable && !n.scrollable) continue;
    const key = `${label}|${n.bounds.join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const flags = [n.clickable && 'tap', n.scrollable && 'scroll', n.checked && 'on', n.selected && 'sel', !n.enabled && 'off']
      .filter(Boolean).join(',');
    items.push({ label: label.slice(0, 120), id: n.id || undefined, flags: flags || undefined, at: centre(n) });
  }
  return items;
}

// ---------- device state ----------

function screenSize() {
  const out = sh('wm size');
  const m = /Override size: (\d+)x(\d+)/.exec(out) || /Physical size: (\d+)x(\d+)/.exec(out);
  return m ? [Number(m[1]), Number(m[2])] : [720, 1600];
}

function appPid() {
  return (sh(`pidof ${PKG}`, { allowFail: true }) || '').trim();
}

function frameStats() {
  const out = sh(`dumpsys gfxinfo ${PKG}`, { allowFail: true }) || '';
  const num = re => Number((re.exec(out) || [])[1] || 0);
  return {
    frames: num(/Total frames rendered: (\d+)/),
    janky: num(/Janky frames: (\d+)/),
    p50: num(/50th percentile: (\d+)ms/),
    p90: num(/90th percentile: (\d+)ms/),
    p99: num(/99th percentile: (\d+)ms/),
  };
}

function memoryKb() {
  const out = sh(`dumpsys meminfo ${PKG} | grep -E "TOTAL PSS|TOTAL:"`, { allowFail: true }) || '';
  const m = /TOTAL(?: PSS)?:\s+(\d+)/.exec(out);
  return m ? Number(m[1]) : null;
}

function drainLogcat() {
  const pid = appPid().split(/\s+/)[0];
  const tagged = adb(['logcat', '-d', '-v', 'time', 'ReactNativeJS:V', 'ReactNative:W', 'AndroidRuntime:E', '*:S'], { allowFail: true }) || '';
  const own = pid ? adb(['logcat', '-d', '-v', 'time', `--pid=${pid}`, '*:W'], { allowFail: true }) || '' : '';
  adb(['logcat', '-c'], { allowFail: true });
  const lines = new Set();
  for (const line of `${tagged}\n${own}`.split('\n')) {
    if (line && !line.startsWith('---------')) lines.add(line);
  }
  return [...lines].sort().join('\n');
}

function classifyLog(text) {
  const lines = text.split('\n').filter(Boolean);
  return {
    errors: lines.filter(l => /\s(E|F)\/|FATAL EXCEPTION|ReactNativeJS.*(Error|Exception)/.test(l)).slice(0, 80),
    warnings: lines.filter(l => /\bW\//.test(l)).length,
  };
}

// ---------- runner ----------

class Explorer {
  constructor(args) {
    this.args = args;
    this.out = path.resolve(args.out);
    fs.mkdirSync(path.join(this.out, 'screens'), { recursive: true });
    fs.mkdirSync(path.join(this.out, 'ui'), { recursive: true });
    this.steps = [];
    this.logAll = '';
    this.size = screenSize();
    this.current = { nodes: [] };
  }

  async record(name, extra = {}, settleTimeout = this.args.settleTimeoutMs, since = Date.now()) {
    const index = String(this.steps.length + 1).padStart(3, '0');
    const slug = `${index}-${String(name).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 50).toLowerCase()}`;
    const anrBefore = systemDialogs.filter(d => d.ours).length;
    const settled = await settle(settleTimeout, since);
    const appAnr = systemDialogs.filter(d => d.ours).length > anrBefore;
    this.current = settled;
    const png = adb(['exec-out', 'screencap', '-p'], { encoding: 'buffer', allowFail: true });
    if (png && png.length) fs.writeFileSync(path.join(this.out, 'screens', `${slug}.png`), png);
    const screen = summarize(settled.nodes);
    fs.writeFileSync(path.join(this.out, 'ui', `${slug}.json`), JSON.stringify(screen, null, 1));
    const log = drainLogcat();
    this.logAll += `\n===== ${slug} =====\n${log}`;
    const pid = appPid();
    const frames = frameStats();
    sh(`dumpsys gfxinfo ${PKG} reset`, { allowFail: true });
    const step = {
      n: this.steps.length + 1,
      name,
      slug,
      settleMs: settled.settleMs,
      settleTimedOut: settled.timedOut,
      alive: Boolean(pid),
      anr: appAnr || undefined,
      frames,
      memKb: memoryKb(),
      log: classifyLog(log),
      visible: screen.slice(0, 40).map(i => i.label).filter(Boolean),
      ...extra,
    };
    this.steps.push(step);
    const flag = step.alive ? '' : ' CRASHED';
    console.log(`[${slug}] settle ${step.settleMs}ms${settled.timedOut ? ' (timeout)' : ''} jank ${frames.janky}/${frames.frames}${flag}`);
    if (!step.alive) await this.relaunch();
    return step;
  }

  async relaunch() {
    sh(`monkey -p ${PKG} -c android.intent.category.LAUNCHER 1`, { allowFail: true });
    await sleep(3000);
  }

  async launch(name = 'launch', { warm = false } = {}) {
    if (warm) sh('input keyevent 3', { allowFail: true });
    else sh(`am force-stop ${PKG}`, { allowFail: true });
    adb(['logcat', '-c'], { allowFail: true });
    const t0 = Date.now();
    const component = (sh(`cmd package resolve-activity --brief ${PKG} | tail -n 1`, { allowFail: true }) || '').trim();
    const out = sh(`am start -W -n ${component.includes('/') ? component : `${PKG}/.MainActivity`}`, { allowFail: true }) || '';
    const total = Number((/TotalTime: (\d+)/.exec(out) || [])[1] || 0);
    const step = await this.record(name, { activityStartMs: total }, this.args.coldTimeoutMs, t0);
    await this.recoverData();
    return step;
  }

  /** If the app lands on its data-unavailable screen, record it, retry once and wait for data. */
  async recoverData() {
    const retry = findNode(this.current.nodes, 'Try again');
    if (!retry || !findNode(this.current.nodes, { contains: 'Data unavailable' })) return;
    this.dataUnavailable = (this.dataUnavailable || 0) + 1;
    const [x, y] = centre(retry);
    sh(`input tap ${x} ${y}`);
    const t0 = Date.now();
    let recovered = false;
    while (Date.now() - t0 < this.args.coldTimeoutMs) {
      const nodes = (await dumpUi()).nodes;
      if (!findNode(nodes, { contains: 'Data unavailable' }) && !looksLoading(nodes) && nodes.length) { recovered = true; break; }
      await sleep(1000);
    }
    await this.record('retry after data unavailable', { recovered, waitedMs: Date.now() - t0, error: recovered ? undefined : 'data still unavailable after retry' }, this.args.coldTimeoutMs);
  }

  async open(route, name) {
    const uri = `${SCHEME}://${route.replace(/^\//, '')}`;
    const t0 = Date.now();
    sh(`am start -W -a android.intent.action.VIEW -d '${uri}' ${PKG}`, { allowFail: true });
    return this.record(name || `open ${route}`, { route, intentMs: Date.now() - t0 }, undefined, t0);
  }

  async find(sel, timeoutMs = 8000) {
    const start = Date.now();
    let nodes = this.current.nodes;
    while (true) {
      const hit = findNode(nodes, sel);
      if (hit) return hit;
      if (Date.now() - start > timeoutMs) return null;
      await sleep(300);
      nodes = (await dumpUi()).nodes;
    }
  }

  async scrollUntil(sel, maxSwipes = 8) {
    for (let i = 0; i <= maxSwipes; i += 1) {
      const nodes = (await dumpUi()).nodes;
      const hit = findNode(nodes, sel);
      if (hit) return hit;
      this.swipe('down');
      await sleep(500);
    }
    return null;
  }

  swipe(direction, fraction = 0.55) {
    const [w, h] = this.size;
    const x = Math.round(w / 2);
    const span = Math.round(h * fraction / 2);
    const mid = Math.round(h * 0.55);
    const [y1, y2] = direction === 'up' ? [mid - span, mid + span] : [mid + span, mid - span];
    if (direction === 'left' || direction === 'right') {
      const y = Math.round(h / 2);
      const [a, b] = direction === 'left' ? [w * 0.85, w * 0.15] : [w * 0.15, w * 0.85];
      sh(`input swipe ${Math.round(a)} ${y} ${Math.round(b)} ${y} 250`);
      return;
    }
    sh(`input swipe ${x} ${y1} ${x} ${y2} 300`);
  }

  /** One immediate capture with no settle wait, for screens that never stop changing. */
  async snapshot(name, extra = {}) {
    const index = String(this.steps.length + 1).padStart(3, '0');
    const slug = `${index}-${String(name).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 50).toLowerCase()}`;
    const { nodes } = await dumpUi();
    dismissSystemDialog(nodes);
    const png = adb(['exec-out', 'screencap', '-p'], { encoding: 'buffer', allowFail: true });
    if (png && png.length) fs.writeFileSync(path.join(this.out, 'screens', `${slug}.png`), png);
    const screen = summarize(nodes);
    fs.writeFileSync(path.join(this.out, 'ui', `${slug}.json`), JSON.stringify(screen, null, 1));
    const log = drainLogcat();
    this.logAll += `\n===== ${slug} =====\n${log}`;
    const step = { n: this.steps.length + 1, name, slug, settleMs: 0, alive: Boolean(appPid()), frames: frameStats(), memKb: memoryKb(), log: classifyLog(log), visible: screen.slice(0, 40).map(i => i.label).filter(Boolean), ...extra };
    sh(`dumpsys gfxinfo ${PKG} reset`, { allowFail: true });
    this.steps.push(step);
    console.log(`[${slug}] snapshot${step.alive ? '' : ' CRASHED'}`);
    return { step, nodes };
  }

  /** Open the in-app audit exactly as a person would and start it. */
  async openAudit() {
    await this.open('/about', 'about');
    let row = await this.scrollUntil('App health audit', 6);
    if (!row) {
      const diag = await this.scrollUntil('Diagnostics', 6);
      if (diag) { sh(`input tap ${centre(diag).join(' ')}`); await sleep(800); }
      row = await this.scrollUntil('App health audit', 6);
    }
    if (!row) return this.record('audit entry', { error: 'App health audit row not found' });
    const t0 = Date.now();
    sh(`input tap ${centre(row).join(' ')}`);
    return this.record('audit screen', {}, 60000, t0);
  }

  /** Cancel a running audit so its overlay releases the UI; force-stop and relaunch if it will not end. */
  async cancelAudit() {
    const cancel = await this.find('Cancel', 3000);
    if (cancel) sh(`input tap ${centre(cancel).join(' ')}`);
    const t0 = Date.now();
    while (Date.now() - t0 < 60000) {
      await sleep(2000);
      const text = (await dumpUi()).nodes.map(n => n.text).join(' ');
      if (!/[\d,]+ \/ [\d,]+/.test(text)) return;
    }
    sh(`am force-stop ${PKG}`, { allowFail: true });
    await this.relaunch();
    await sleep(10000);
  }

  /** About > Debug log > Upload and copy link, then fetch the uploaded text into debug-log.txt. */
  async uploadDebugLog() {
    if (!appPid()) { await this.relaunch(); await sleep(10000); }
    await this.open('/about', 'about for debug log');
    let row = await this.scrollUntil('Debug log', 6);
    if (!row) {
      const diag = await this.scrollUntil('Diagnostics', 6);
      if (diag) { sh(`input tap ${centre(diag).join(' ')}`); await sleep(800); }
      row = await this.scrollUntil('Debug log', 6);
    }
    if (!row) return { error: 'Debug log row not found' };
    sh(`input tap ${centre(row).join(' ')}`);
    await this.record('debug log screen', {}, 60000);
    const urlsIn = nodes => nodes.map(n => `${n.text} ${n.desc}`).join('\n').match(/https:\/\/paste\.(?:rs|c-net\.org)\/[A-Za-z0-9._~-]+/g) || [];
    const priorUrls = new Set(urlsIn(this.current.nodes));
    const upload = await this.scrollUntil('Upload and copy link', 8);
    if (!upload) return { error: 'Upload and copy link not found' };
    for (const u of urlsIn((await dumpUi()).nodes)) priorUrls.add(u);
    sh(`input tap ${centre(upload).join(' ')}`);
    await sleep(1500);
    const dialog = (await dumpUi()).nodes;
    const confirm = findNode(dialog, { id: 'button1' }) || findNode(dialog, 'Upload') || findNode(dialog, 'Continue') || findNode(dialog, 'OK');
    if (confirm) sh(`input tap ${centre(confirm).join(' ')}`);
    const t0 = Date.now();
    let url = null;
    while (!url && Date.now() - t0 < 5 * 60000) {
      await sleep(3000);
      const nodes = (await dumpUi()).nodes;
      const busy = nodes.some(n => /^(Preparing|Uploading|Verifying)/.test(n.text.trim()));
      const fresh = urlsIn(nodes).find(u => !priorUrls.has(u));
      if (fresh && !busy) url = fresh;
    }
    await this.snapshot('debug log uploaded', { debugLogUrl: url, error: url ? undefined : 'debug log upload URL not shown' });
    const result = { url, uploadMs: Date.now() - t0 };
    if (url) {
      try {
        const { body, status, contentUrl } = await fetchUploadedLog(url);
        result.status = status;
        result.contentUrl = contentUrl;
        fs.writeFileSync(path.join(this.out, 'debug-log.txt'), body);
        result.bytes = Buffer.byteLength(body);
      } catch (error) {
        result.error = String(error.message || error);
      }
    }
    return result;
  }

  /** Run the full audit (live or local), follow it to the end and collect the uploaded log. */
  async runAudit(kind = 'live', timeoutMin = 90) {
    sh('svc power stayon true', { allowFail: true });
    sh('settings put system screen_off_timeout 2147483647', { allowFail: true });
    const entry = await this.openAudit();
    if (entry.error) return;
    const privateAudit = this.args.privateAudit;
    if (privateAudit) {
      // Validate the exact PR build without using either public log destination.
      if (!await this.find('No audit history', 5000)) throw new Error('Private audit requires a fresh install with no audit history');
      const { nodes } = await dumpUi();
      const destination = { id: 'audit-local-destination' };
      if (!findNode(nodes, destination)) {
        const upload = findNode(nodes, 'Public upload');
        if (!upload || !upload.enabled) throw new Error('Cannot disable public upload');
        sh(`input tap ${centre(upload).join(' ')}`);
        const local = await this.find(destination, 5000);
        if (!local) throw new Error('Local audit-log destination not confirmed');
      }
    } else {
      const upload = findNode(this.current.nodes, 'Public upload');
      if (upload && !upload.checked) {
        const sw = this.current.nodes.find(n => /Switch/.test(n.cls) && Math.abs(centre(n)[1] - centre(upload)[1]) < 60);
        if (sw && !sw.checked) { sh(`input tap ${centre(sw).join(' ')}`); await sleep(500); }
      }
    }
    const startSel = kind === 'local' ? [{ id: 'audit-start-local' }, 'Local audit'] : [{ id: 'audit-start-live' }, 'Live audit'];
    let start = null;
    for (const sel of startSel) start = start || await this.find(sel, 3000);
    if (!start) return this.record('audit start', { error: `${kind} audit button not found` });
    const priorUrls = new Set(this.current.nodes.map(n => `${n.text} ${n.desc}`).join('\n').match(/https:\/\/paste\.(?:rs|c-net\.org)\/[A-Za-z0-9._~-]+/g) || []);
    const t0 = Date.now();
    const startPid = appPid();
    if (privateAudit && !startPid) throw new Error('Audit process was not running before start');
    sh(`input tap ${centre(start).join(' ')}`);
    console.log(`Audit (${kind}) started`);
    const deadline = t0 + timeoutMin * 60000;
    let lastShot = 0;
    let url = null;
    let outcome = null;
    let rbaNavigationProven = false;
    let idleAtHome = 0;
    let lastCounter = null;
    let lastProgressAt = Date.now();
    const stallMs = 12 * 60000;
    while (Date.now() < deadline) {
      await sleep(5000);
      const { nodes } = await dumpUi();
      if (dismissSystemDialog(nodes)) continue;
      const pid = appPid();
      if (!pid || (privateAudit && pid !== startPid)) {
        outcome = 'app crashed';
        await this.snapshot('audit crashed', { error: 'app process died during audit', auditElapsedMs: Date.now() - t0 });
        if (!privateAudit) {
          await this.relaunch();
          await this.record('relaunch after audit crash', {}, 60000);
          await this.openAudit();
        }
        break;
      }
      const texts = nodes.map(n => `${n.text} ${n.desc}`);
      const found = !privateAudit && (texts.join('\n').match(/https:\/\/paste\.(?:rs|c-net\.org)\/[A-Za-z0-9._~-]+/g) || []).find(u => !priorUrls.has(u));
      if (found) url = found;
      if (texts.some(t => /Audit runner failed/.test(t))) outcome = 'runner failed';
      if (texts.some(t => /Audit cancelled/.test(t))) outcome = 'cancelled';
      const counter = texts.join(' ').match(/([\d,]+) \/ ([\d,]+)/);
      if (counter && counter[0] !== lastCounter) { lastCounter = counter[0]; lastProgressAt = Date.now(); }
      if (Date.now() - lastProgressAt > stallMs) {
        outcome = `stalled at ${lastCounter ?? 'start'}`;
        await this.snapshot('audit stalled', { error: outcome, auditElapsedMs: Date.now() - t0 });
        await this.cancelAudit();
        break;
      }
      const uploading = texts.some(t => /^(Preparing|Uploading|Verifying) ?$/.test(t.trim()));
      const failedUpload = texts.some(t => /Upload failed|Upload uncertain/.test(t));
      if (Date.now() - lastShot > 60000) {
        lastShot = Date.now();
        await this.snapshot(`audit ${Math.round((Date.now() - t0) / 60000)} min`, { auditElapsedMs: Date.now() - t0 });
      }
      if (url && !uploading) break;
      if (outcome) break;
      // Completed on the audit screen without a visible URL: look for it lower down.
      const onAuditHome = texts.some(t => /App health audit/.test(t)) && texts.some(t => /Last audit/.test(t));
      const runningNow = nodes.some(n => n.id === 'audit-start-live' && !n.enabled) || texts.some(t => /^(Loading|Running)/.test(t.trim()));
      if (privateAudit) {
        const completed = nodes.some(n => /^(Successful|Needs review|Failed|Incomplete)\s*·\s*\S/.test(n.text));
        if (onAuditHome && completed && nodes.some(n => n.id === 'audit-start-live' && n.enabled)) {
          const rbaReady = nodes.some(n => n.id === 'audit-rba-round-trips-complete');
          rbaNavigationProven = rbaReady || nodes.some(n => n.id === 'audit-rba-navigation-only');
          outcome = rbaReady ? 'completed' : rbaNavigationProven
            ? 'RBA navigation completed; readiness failed' : 'missing cold or warm RBA round trip';
          break;
        }
        continue;
      }
      if (onAuditHome && !runningNow && Date.now() - t0 > 30000) {
        idleAtHome += 1;
        const hit = await this.scrollUntil({ contains: 'paste.' }, 10);
        const candidate = hit ? (hit.text.match(/https:\/\/\S+/) || [])[0] : null;
        if (candidate && !priorUrls.has(candidate)) url = candidate;
        if (url) break;
        if (failedUpload || idleAtHome > 6) break;
        this.swipe('up', 0.9); this.swipe('up', 0.9);
      }
    }
    const elapsedMs = Date.now() - t0;
    if (privateAudit && appPid() !== startPid) {
      outcome = 'app crashed';
      rbaNavigationProven = false;
    }
    if (privateAudit && !outcome) outcome = 'timed out';
    const final = await this.snapshot('audit finished', { auditElapsedMs: elapsedMs, auditUrl: url, auditOutcome: outcome, error: privateAudit
      ? (outcome === 'completed' ? undefined : outcome)
      : (url ? undefined : `no uploaded log URL (${outcome || 'timeout or upload failure'})`) });
    // Capture the result screen top to bottom.
    if (!privateAudit) {
      this.swipe('up', 0.9); this.swipe('up', 0.9);
      for (let i = 0; i < 12; i += 1) {
        await this.snapshot(`audit result ${i + 1}`);
        this.swipe('down', 0.7);
        await sleep(400);
      }
    }
    const audit = { kind, url, outcome, elapsedMs, ...(privateAudit ? { rbaNavigationProven } : {}), visibleOutcome: final.step.visible.slice(0, 20) };
    if (url && !privateAudit) {
      try {
        const { body, status, contentUrl } = await fetchUploadedLog(url);
        audit.logStatus = status;
        audit.logContentUrl = contentUrl;
        fs.writeFileSync(path.join(this.out, 'audit-log.txt'), body);
        audit.logBytes = Buffer.byteLength(body);
      } catch (error) {
        audit.logError = String(error.message || error);
      }
    }
    if (!privateAudit) audit.debugLog = await this.uploadDebugLog();
    this.audit = audit;
    fs.writeFileSync(path.join(this.out, 'audit.json'), JSON.stringify(audit, null, 2));
    console.log(`Audit ${kind}: ${url ? `log ${audit.logBytes ?? '?'} bytes from ${url}` : 'no log URL'} after ${Math.round(elapsedMs / 1000)} s`);
  }

  async run(step) {
    if (step.audit) return this.runAudit(step.audit === true ? 'live' : step.audit, step.timeoutMin ?? 90);
    const label = step.name || Object.entries(step).map(([k, v]) => `${k} ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' ');
    if (step.launch !== undefined) return this.launch(label, { warm: step.launch === 'warm' });
    if (step.open) return this.open(step.open, label);
    if (step.tap || step.longPress) {
      const sel = step.tap || step.longPress;
      const node = (step.scroll ? await this.scrollUntil(sel) : null) || await this.find(sel, step.timeout ?? 8000);
      if (!node) return this.record(label, { error: `not found: ${JSON.stringify(sel)}` });
      const [x, y] = centre(node);
      const t0 = Date.now();
      if (step.longPress) sh(`input swipe ${x} ${y} ${x} ${y} 900`);
      else sh(`input tap ${x} ${y}`);
      return this.record(label, { tapped: node.text || node.desc || node.id, at: [x, y] }, undefined, t0);
    }
    if (step.tapXY) {
      sh(`input tap ${step.tapXY[0]} ${step.tapXY[1]}`);
      return this.record(label);
    }
    if (step.type !== undefined) {
      if (step.into) {
        const node = await this.find(step.into);
        if (!node) return this.record(label, { error: `not found: ${JSON.stringify(step.into)}` });
        const [x, y] = centre(node);
        sh(`input tap ${x} ${y}`);
        await sleep(300);
      }
      if (step.clear) sh('input keycombination 113 29 && input keyevent 67', { allowFail: true });
      const quoted = `'${String(step.type).replace(/ /g, '%s').replace(/'/g, `'\\''`)}'`;
      sh(`input text ${quoted}`);
      if (step.submit) sh('input keyevent 66');
      return this.record(label);
    }
    if (step.scroll) {
      for (let i = 0; i < (step.times ?? 1); i += 1) {
        this.swipe(step.scroll);
        await sleep(350);
      }
      return this.record(label);
    }
    if (step.back !== undefined) {
      for (let i = 0; i < (step.times ?? 1); i += 1) sh('input keyevent 4');
      return this.record(label);
    }
    if (step.key) {
      sh(`input keyevent ${step.key}`);
      return this.record(label);
    }
    if (step.wait) {
      await sleep(step.wait);
      return this.record(label);
    }
    if (step.waitFor) {
      const t0 = Date.now();
      const node = await this.find(step.waitFor, step.timeout ?? 60000);
      return this.record(label, { waitedMs: Date.now() - t0, error: node ? undefined : `timeout waiting for ${JSON.stringify(step.waitFor)}` });
    }
    if (step.expect) {
      const node = findNode((await dumpUi()).nodes, step.expect);
      return this.record(label, { error: node ? undefined : `expected ${JSON.stringify(step.expect)}` });
    }
    if (step.rotate) {
      sh('settings put system accelerometer_rotation 0');
      sh(`settings put system user_rotation ${step.rotate === 'landscape' ? 1 : 0}`);
      await sleep(800);
      this.size = screenSize();
      return this.record(label);
    }
    if (step.shot) return this.record(step.shot);
    throw new Error(`Unknown step ${JSON.stringify(step)}`);
  }

  finish(meta) {
    fs.writeFileSync(path.join(this.out, 'logcat.txt'), this.logAll);
    const baseline = loadBaseline(this.args.baseline);
    const report = { schemaVersion: 1, ...meta, audit: this.audit, systemDialogs, finishedAt: new Date().toISOString(), steps: this.steps };
    fs.writeFileSync(path.join(this.out, 'report.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(this.out, 'report.md'), renderMarkdown(report, baseline));
    return report;
  }
}

function loadBaseline(file) {
  if (!file || !fs.existsSync(file)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { version: data.app?.versionName, byName: new Map(data.steps.map(s => [s.name, s])) };
  } catch {
    return null;
  }
}

function renderMarkdown(report, baseline) {
  const crashed = report.steps.filter(s => !s.alive);
  const failed = report.steps.filter(s => s.error);
  const slow = report.steps.filter(s => s.settleTimedOut);
  const withErrors = report.steps.filter(s => s.log.errors.length);
  const unavailable = report.steps.filter(s => s.visible?.some(v => /Data unavailable/.test(v)));
  const lines = [
    `# App explorer: ${report.app?.versionName ?? '?'} (${report.app?.versionCode ?? '?'})`,
    '',
    unavailable.length ? `**Data unavailable on ${unavailable.length} of ${report.steps.length} steps**` : '',
    report.network ? `Runner payload check: manifest HTTP ${report.network.manifestStatus}, ${report.network.manifestBytes} bytes, run_date ${report.network.runDate ?? '?'}` : '',
    '',
    `Mode ${report.mode} | ${report.steps.length} steps | crashes ${crashed.length} | step failures ${failed.length} | settle timeouts ${slow.length} | steps with JS/native errors ${withErrors.length}`,
    baseline ? `Baseline ${baseline.version}` : '',
    report.audit ? `**Audit ${report.audit.kind}: outcome ${report.audit.outcome ?? 'completed'} | ${Math.round(report.audit.elapsedMs / 1000)} s | audit log ${report.audit.url ? (report.audit.logBytes ? `${report.audit.logBytes} bytes (audit-log.txt) ${report.audit.logContentUrl || report.audit.url}` : `fetch failed (${report.audit.logError ?? report.audit.logStatus}) ${report.audit.url}`) : 'not uploaded'} | debug log ${report.audit.debugLog?.url ? (report.audit.debugLog.bytes ? `${report.audit.debugLog.bytes} bytes (debug-log.txt) ${report.audit.debugLog.url}` : `fetch failed (${report.audit.debugLog.error ?? report.audit.debugLog.status}) ${report.audit.debugLog.url}`) : report.audit.debugLog?.error ?? 'none'}**` : '',
    '',
    '| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |',
    '|---|---|---:|---:|---:|---:|---:|---|',
  ];
  for (const s of report.steps) {
    const base = baseline?.byName.get(s.name);
    const delta = base ? s.settleMs - base.settleMs : null;
    const notes = [
      !s.alive && 'CRASH',
      s.anr && 'ANR',
      s.settleTimedOut && 'no settle',
      s.error,
      s.log.errors.length && `${s.log.errors.length} errors`,
      s.activityStartMs && `start ${s.activityStartMs}ms`,
    ].filter(Boolean).join('; ');
    lines.push(`| ${s.n} | ${s.name} | ${s.settleMs} | ${delta == null ? '' : (delta > 0 ? '+' : '') + delta} | ${s.frames.frames ? `${s.frames.janky}/${s.frames.frames}` : ''} | ${s.frames.frames ? s.frames.p90 : ''} | ${s.memKb ? Math.round(s.memKb / 1024) : ''} | ${notes} |`);
  }
  const fatal = report.steps.flatMap(st => st.log.errors.filter(l => /FATAL EXCEPTION|Caused by|IllegalStateException|Error:/.test(l)).map(l => `${st.n} ${l.replace(/^\S+ \S+ /, '')}`));
  if (fatal.length) lines.push('', '## Fatal lines', '```', ...[...new Set(fatal)].slice(0, 15), '```');
  if (withErrors.length) {
    lines.push('', '## Errors');
    for (const s of withErrors) lines.push('', `### ${s.n} ${s.name}`, '```', ...s.log.errors.slice(0, 8), '```');
  }
  return lines.filter((l, i, all) => !(l === '' && all[i - 1] === '')).join('\n') + '\n';
}

function appVersion() {
  const out = sh(`dumpsys package ${PKG} | grep -E "versionName|versionCode"`, { allowFail: true }) || '';
  return {
    versionName: (/versionName=(\S+)/.exec(out) || [])[1],
    versionCode: Number((/versionCode=(\d+)/.exec(out) || [])[1] || 0),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.privateAudit && (!args.fresh || args.mode !== 'audit')) {
    throw new Error('Private validation requires --mode audit and --fresh');
  }
  adb(['wait-for-device'], { timeout: 180000 });
  for (const key of ['window_animation_scale', 'transition_animation_scale', 'animator_duration_scale']) {
    sh(`settings put global ${key} 0`, { allowFail: true });
  }
  sh(`pm grant ${PKG} android.permission.POST_NOTIFICATIONS`, { allowFail: true });
  if (args.fresh) sh(`pm clear ${PKG}`, { allowFail: !args.privateAudit });
  sh('input keyevent 3', { allowFail: true });
  for (let i = 0; i < 10; i += 1) {
    if (!dismissSystemDialog((await dumpUi()).nodes)) break;
    await sleep(1500);
  }
  const ex = new Explorer(args);
  let network;
  try { network = JSON.parse(fs.readFileSync('payload-check.json', 'utf8')); } catch { network = undefined; }
  const meta = { network, mode: args.mode, app: appVersion(), device: { size: ex.size, sdk: sh('getprop ro.build.version.sdk').trim() }, startedAt: new Date().toISOString() };
  let script = [];
  if (args.mode === 'script') {
    const raw = args.scriptJson ?? fs.readFileSync(args.script, 'utf8');
    script = JSON.parse(raw);
    if (!Array.isArray(script)) throw new Error('Script must be a JSON array of steps');
    if (!script.some(s => s.launch !== undefined)) script.unshift({ launch: true, name: 'cold start' });
  } else if (args.mode === 'audit') {
    script = [{ launch: true, name: 'cold start' }, { audit: args.audit || 'live', timeoutMin: args.auditTimeoutMin || 90 }];
  } else if (args.mode === 'full') {
    script = [{ launch: true, name: 'cold start' }, ...(args.routes || CRAWL_ROUTES).map(r => ({ open: r, name: r })),
      { launch: 'warm', name: 'warm resume' }, { launch: true, name: 'cold relaunch' },
      { audit: args.audit || 'live', timeoutMin: args.auditTimeoutMin || 90 }];
  } else {
    script = [{ launch: true, name: 'cold start' }, ...(args.routes || CRAWL_ROUTES).map(r => ({ open: r, name: r }))];
    script.push({ launch: 'warm', name: 'warm resume' }, { launch: true, name: 'cold relaunch' });
  }
  for (const step of script) {
    try {
      await ex.run(step);
    } catch (error) {
      ex.steps.push({ n: ex.steps.length + 1, name: step.name || JSON.stringify(step), error: String(error.message || error), alive: Boolean(appPid()), settleMs: 0, frames: {}, log: { errors: [], warnings: 0 }, visible: [] });
    }
  }
  const report = ex.finish(meta);
  const bad = report.steps.filter(s => !s.alive).length;
  console.log(`Done: ${report.steps.length} steps, ${bad} crashes. Report at ${path.join(ex.out, 'report.md')}`);
  if (args.privateAudit && (bad || report.audit?.outcome !== 'completed')) {
    throw new Error(`Android audit validation did not complete without a crash: ${report.audit?.outcome ?? 'no audit report'}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
