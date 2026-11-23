import zlib from 'node:zlib';

// Deterministic UX checks over one captured screen. Pure functions: nodes in, findings out.
// Input nodes are the raw parseHierarchy() shape saved by the driver as ui/<slug>.nodes.json.
// Every finding: { check, severity: 'major'|'minor', screen, text, at:[x,y], detail }.

/** One-line fix per check, attached to every finding so the report is actionable. */
export const FIXES = {
  'tap-target': 'Pad the control to 48 dp or add hitSlop',
  'crowded-targets': 'Add at least 8 dp between adjacent controls',
  'text-size': 'Raise the text to at least 12 sp',
  'truncated-text': 'Let the label wrap or shorten the value',
  'off-screen': 'Constrain the element to the screen width',
  'overlap': 'Stop the elements sharing space; wrap or stack them',
  'keyboard-collision': 'Scroll the focused input above the keyboard',
  'safe-area': 'Apply the safe-area inset to this container',
  'spinner-no-result': 'Replace the spinner with a result or a retry action',
  'dead-end-state': 'Give the empty or error state a retry or back action',
  'dead-end': 'Add a visible way forward or back',
  'no-primary-action': 'Make the next step an explicit labelled action',
  'clutter': 'Group or collapse secondary facts',
  'prose': 'Replace the sentence with a label or fact',
  'jargon': 'Replace the abbreviation with a plain label',
  'contrast': 'Darken the text or lighten the background',
  'slow': 'Show content first and defer the slow work',
  'slow-first-value': 'Show cached rates on launch before the refresh',
  'slow-relaunch': 'Draw the cached rates first, then refresh in the background',
  'first-run-gate': 'Remove the gate; land on rates',
  'no-first-value': 'Show cached rates on launch instead of an error screen',
  'intimidating-first-run': 'Remove the input or permission request from first launch',
  'nav-inconsistent': 'Use the same top-level destinations on every screen',
  'no-return-reason': 'Show what changed since the last visit',
  'no-engagement-hook': 'Add a save control and a Saved destination',
  'accuracy': 'Fix the displayed figure or its sort',
  'contrast-not-measured': 'Check that screenshots are 8-bit RGB or RGBA PNGs',
};

export const DP = (density = 320) => density / 160;

export const LIMITS = {
  minTapDp: 48,
  hardMinTapDp: 32,
  minTextDp: 12, // text box height under this at 1.0 font scale is almost certainly under 10sp
  textContrast: 4.5,
  largeTextContrast: 3,
  clutterNodes: 70,
  overlapRatio: 0.25,
  keyboardSlackPx: 4,
};

const area = b => Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
const inter = (a, b) => [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])];
const contains = (outer, inner, slack = 2) =>
  outer[0] - slack <= inner[0] && outer[1] - slack <= inner[1] && outer[2] + slack >= inner[2] && outer[3] + slack >= inner[3];
const centre = b => [Math.round((b[0] + b[2]) / 2), Math.round((b[1] + b[3]) / 2)];
const label = n => (n.text || n.desc || n.id || n.cls || '').replace(/\s+/g, ' ').slice(0, 80);

const IME = /inputmethod|latin|keyboard/i;
const SYSTEMUI = /^com\.android\.systemui$/;
// "No listed rate" is the product-availability label and screen title, not an empty state.
const ERROR_TEXT = /^(no (?!listed rate$)|nothing|error|failed|couldn.t|unable|something went wrong|data unavailable|offline)/i;
const ACTION_TEXT = /\b(retry|try again|refresh|reload|clear|reset|back|add|open|browse|start|run|begin|navigate up)\b/i;

export function appNodes(nodes, pkg) {
  return nodes.filter(n => (!pkg || n.pkg === pkg) && area(n.bounds) > 0);
}


/**
 * A node whose edge sits on its scroll container's edge and that is shorter than another node of the same
 * kind in that container is a sliver of a row that is mostly scrolled out of view. Edge alignment alone is not enough.
 */
function clippedByScroller(n, scrollers, app) {
  const h = n.bounds[3] - n.bounds[1];
  return scrollers.some(c => c !== n && contains(c.bounds, n.bounds, 0)
    && (Math.abs(n.bounds[1] - c.bounds[1]) <= 2 || Math.abs(n.bounds[3] - c.bounds[3]) <= 2)
    && app.some(o => o !== n && o.cls === n.cls && o.bounds[3] - o.bounds[1] > h + 2 && contains(c.bounds, o.bounds, 0)));
}

const TAB_LABELS = /^(Rates|Saved|Market)$/;
/** Top edge (px) of the bottom tab bar, or Infinity when the screen has none: rows scrolled under it are covered, not low contrast or small. */
export function bottomBarTop(app, size) {
  const [, H] = size;
  const tops = app.filter(n => n.clickable && n.bounds[1] > H * 0.8 && TAB_LABELS.test((n.text || n.desc || '').trim())).map(n => n.bounds[1]);
  return tops.length ? Math.min(...tops) : Infinity;
}

/** Tap targets under the platform minimum. */
function tapTargets({ screen, app, density, size }) {
  const out = [];
  const seen = new Set();
  const dp = DP(density);
  const barTop = bottomBarTop(app, size);
  const scrollers = app.filter(n => n.scrollable && area(n.bounds) > 0);
  for (const n of app) {
    if (!n.clickable || !n.enabled) continue;
    // A control cut off by the screen edge or the tab bar reports only its visible sliver.
    if (n.bounds[3] >= barTop - 2 && n.bounds[1] > size[1] * 0.5 && !TAB_LABELS.test((n.text || n.desc || '').trim())) continue;
    if (n.bounds[1] <= 2 || n.bounds[3] >= size[1] - 2) continue;
    if (clippedByScroller(n, scrollers, app)) continue;
    const w = (n.bounds[2] - n.bounds[0]) / dp;
    const h = (n.bounds[3] - n.bounds[1]) / dp;
    // Rounding of density-independent sizes must not turn 48 into a failure.
    if (w >= LIMITS.minTapDp - 0.5 && h >= LIMITS.minTapDp - 0.5) continue;
    const key = n.bounds.join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    // Full-width rows and scroll containers are not what a thumb aims at.
    out.push({
      check: 'tap-target',
      severity: Math.min(w, h) < LIMITS.hardMinTapDp ? 'major' : 'minor',
      screen,
      text: label(n),
      at: centre(n.bounds),
      detail: `${Math.round(w)}x${Math.round(h)} dp, minimum ${LIMITS.minTapDp}`,
    });
  }
  return out;
}

function textSize({ screen, app, density, size }) {
  const out = [];
  const dp = DP(density);
  const barTop = bottomBarTop(app, size);
  const scrollers = app.filter(n => n.scrollable && area(n.bounds) > 0);
  for (const n of app) {
    const t = n.text;
    if (!t || /\n/.test(t) || n.cls === 'EditText' || !n.enabled || clippedByScroller(n, scrollers, app)) continue;
    if (n.bounds[3] > barTop && n.bounds[1] > size[1] * 0.5 && !TAB_LABELS.test(t.trim())) continue;
    const h = (n.bounds[3] - n.bounds[1]) / dp;
    if (h < LIMITS.minTextDp) {
      out.push({ check: 'text-size', severity: 'minor', screen, text: label(n), at: centre(n.bounds), detail: `text box ${Math.round(h)} dp tall` });
    }
  }
  return out;
}

function truncation({ screen, app }) {
  const out = [];
  for (const n of app) {
    const t = n.text || '';
    if (t.length > 3 && /(…|\.\.\.)$/.test(t) && !/^(loading|preparing|downloading|verifying|checking|searching)\b/i.test(t)) {
      out.push({ check: 'truncated-text', severity: 'minor', screen, text: label(n), at: centre(n.bounds), detail: 'ends in an ellipsis' });
    }
  }
  return out;
}

function offscreen({ screen, app, size }) {
  const [W, H] = size;
  const out = [];
  const scrollers = app.filter(n => n.scrollable);
  for (const n of app) {
    if (!(n.text || n.desc || n.clickable)) continue;
    const b = n.bounds;
    const left = Math.max(0, -b[0]);
    const right = Math.max(0, b[2] - W);
    const w = b[2] - b[0];
    if ((left + right) / w > 0.1) {
      out.push({ check: 'off-screen', severity: 'major', screen, text: label(n), at: centre(b), detail: `${Math.round(left + right)} px outside the ${W} px width` });
      continue;
    }
    // Content inside a scroll container may run past the fold; fixed content may not.
    // An item that starts or ends inside a scroller belongs to it, even when its own box spills past the scroller.
    if (n.scrollable || scrollers.some(s => s !== n && b[0] >= s.bounds[0] - 2 && b[2] <= s.bounds[2] + 2 && ((b[1] >= s.bounds[1] - 2 && b[1] < s.bounds[3]) || (b[3] > s.bounds[1] && b[3] <= s.bounds[3] + 2)))) continue;
    const top = Math.max(0, -b[1]);
    const bottom = Math.max(0, b[3] - H);
    const h = b[3] - b[1];
    if ((top + bottom) / h > 0.1) {
      out.push({ check: 'off-screen', severity: 'major', screen, text: label(n), at: centre(b), detail: `${Math.round(top + bottom)} px outside the ${H} px height` });
    }
  }
  return out;
}

function overlap({ screen, app }) {
  const out = [];
  const items = app.filter(n => (n.text || (n.clickable && n.desc)) && area(n.bounds) > 0);
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (a.text === b.text && a.desc === b.desc) continue;
      if (contains(a.bounds, b.bounds) || contains(b.bounds, a.bounds)) continue;
      const x = inter(a.bounds, b.bounds);
      const ia = area(x);
      if (!ia) continue;
      const ratio = ia / Math.min(area(a.bounds), area(b.bounds));
      if (ratio >= LIMITS.overlapRatio) {
        out.push({
          check: 'overlap', severity: 'major', screen, text: `${label(a)} / ${label(b)}`, at: centre(x),
          detail: `${Math.round(ratio * 100)}% of the smaller box overlaps`,
        });
      }
    }
  }
  return out.slice(0, 6);
}

/** Keyboard or system bars covering content that matters. */
function collisions({ screen, nodes, app, size }) {
  const out = [];
  const [W, H] = size;
  const ime = nodes.filter(n => IME.test(n.pkg) && area(n.bounds) > W * 100);
  if (ime.length) {
    const top = Math.min(...ime.map(n => n.bounds[1]));
    const focus = app.find(n => n.cls === 'EditText' && n.bounds[3] > top + LIMITS.keyboardSlackPx);
    const hidden = app.filter(n => n !== focus && n.clickable && n.enabled && n.bounds[3] > top + LIMITS.keyboardSlackPx && n.bounds[3] <= H);
    if (focus) {
      out.push({ check: 'keyboard-collision', severity: 'major', screen, text: label(focus), at: centre(focus.bounds), detail: `input sits under the keyboard${hidden.length ? `, ${hidden.length} more controls hidden` : ''}` });
    } else if (hidden.length) {
      out.push({ check: 'keyboard-collision', severity: hidden.length > 2 ? 'major' : 'minor', screen, text: label(hidden[0]), at: centre(hidden[0].bounds), detail: `${hidden.length} control${hidden.length > 1 ? 's' : ''} behind the keyboard` });
    }
  }
  const bars = nodes.filter(n => SYSTEMUI.test(n.pkg) && area(n.bounds) > 0 && (n.bounds[1] === 0 || n.bounds[3] === H));
  for (const bar of bars) {
    for (const n of app) {
      if (!(n.text || n.clickable) || !area(n.bounds)) continue;
      const x = inter(bar.bounds, n.bounds);
      if (area(x) / area(n.bounds) > 0.3) {
        out.push({ check: 'safe-area', severity: 'major', screen, text: label(n), at: centre(n.bounds), detail: 'content under the system bar' });
        break;
      }
    }
  }
  return out.slice(0, 4);
}

/** Empty, error and loading states that leave the user nowhere to go. */
function states({ screen, app, settleTimedOut }) {
  const out = [];
  const texts = app.map(n => n.text || n.desc).filter(Boolean);
  const loading = app.find(n => n.cls === 'ProgressBar');
  if (loading || settleTimedOut) {
    out.push({
      check: 'spinner-no-result', severity: settleTimedOut ? 'major' : 'minor', screen,
      text: loading ? label(loading) : 'screen never settled', at: loading ? centre(loading.bounds) : [0, 0],
      detail: settleTimedOut ? 'screen kept changing until the settle timeout' : 'progress indicator still showing',
    });
  }
  const err = texts.find(t => ERROR_TEXT.test(t.trim()) && t.length < 80);
  if (err) {
    const way = app.some(n => n.clickable && ACTION_TEXT.test(n.text || n.desc || ''));
    if (!way) {
      out.push({ check: 'dead-end-state', severity: 'major', screen, text: err.slice(0, 80), at: [0, 0], detail: 'empty or error state with no action' });
    }
  }
  return out;
}

/** Sentences in the app UI. The copy contract allows headings, labels and facts only. */
function prose({ screen, app, allowProse }) {
  if (allowProse) return [];
  const out = [];
  const seen = new Set();
  for (const n of app) {
    const t = (n.text || n.desc || '').trim();
    const words = t.split(/\s+/).filter(Boolean).length;
    if (seen.has(t)) continue;
    if (words >= 9 && /[.!?]$/.test(t) && !/\d/.test(t.slice(0, 12))) {
      seen.add(t);
      out.push({ check: 'prose', severity: 'minor', screen, text: label(n), at: centre(n.bounds), detail: `${words}-word sentence` });
    }
  }
  return out.slice(0, 4);
}

const JARGON = /(^|[\s·,(])(LVR|P&I|IO|CDR|OFI|ADI|PDS|TMD|SVR|AER|DTI|LMI|HEM|NHC)(?=$|[\s·,)])/;
function jargon({ screen, app, allowProse }) {
  if (allowProse) return [];
  const out = [];
  const seen = new Set();
  for (const n of app) {
    const t = n.text || n.desc || '';
    const m = JARGON.exec(t);
    if (!m || t.length > 160 || seen.has(m[2])) continue;
    seen.add(m[2]);
    out.push({ check: 'jargon', severity: 'minor', screen, text: label(n), at: centre(n.bounds), detail: `unexpanded ${m[2]}` });
  }
  return out;
}

function crowded({ screen, app, density, size }) {
  const dp = DP(density);
  const barTop = bottomBarTop(app, size);
  // A control cut off by the tab bar reports only its visible sliver, which sits flush against the bar.
  const underBar = n => n.bounds[3] >= barTop - 2 && n.bounds[1] > size[1] * 0.5 && !TAB_LABELS.test((n.text || n.desc || '').trim());
  const taps = app.filter(n => n.clickable && n.enabled && !n.scrollable && area(n.bounds) < 400000 && !underBar(n));
  const out = [];
  for (let i = 0; i < taps.length && out.length < 4; i++) {
    for (let j = i + 1; j < taps.length; j++) {
      const a = taps[i].bounds, b = taps[j].bounds;
      if (contains(a, b) || contains(b, a)) continue;
      const gapX = Math.max(b[0] - a[2], a[0] - b[2]);
      const gapY = Math.max(b[1] - a[3], a[1] - b[3]);
      const overlapY = Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > 0;
      const overlapX = Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > 0;
      const gap = overlapY ? gapX : overlapX ? gapY : Infinity;
      if (gap >= 0 && gap / dp < 8 && Math.min(a[2] - a[0], a[3] - a[1], b[2] - b[0], b[3] - b[1]) / dp < LIMITS.minTapDp) {
        out.push({ check: 'crowded-targets', severity: 'minor', screen, text: `${label(taps[i])} / ${label(taps[j])}`, at: centre(a), detail: `${Math.round(gap / dp)} dp apart` });
        break;
      }
    }
  }
  return out;
}

/** Content screens whose only controls are navigation chrome leave the next step unclear. */
function nextStep({ screen, app, size, allowProse }) {
  if (allowProse) return [];
  const [, H] = size;
  const body = app.filter(n => n.clickable && n.enabled && n.bounds[1] > 200 && n.bounds[3] < H - 200);
  const hasContent = app.filter(n => n.text).length >= 6;
  if (hasContent && body.length === 0) {
    return [{ check: 'no-primary-action', severity: 'minor', screen, text: '', at: [0, 0], detail: 'content with no action in the body' }];
  }
  return [];
}

function deadEnd({ screen, app }) {
  const tappable = app.filter(n => n.clickable && n.enabled);
  const scroll = app.some(n => n.scrollable);
  if (tappable.length === 0 && !scroll && app.length) {
    return [{ check: 'dead-end', severity: 'major', screen, text: '', at: [0, 0], detail: 'no tappable control on screen' }];
  }
  return [];
}

function clutter({ screen, app, size }) {
  const visible = app.filter(n => (n.text || n.clickable) && n.bounds[1] < size[1] && n.bounds[3] > 0 && n.bounds[2] > 0 && n.bounds[0] < size[0]);
  const n = new Set(visible.map(v => `${v.text}|${v.bounds.join(',')}`)).size;
  return { count: n, finding: n > LIMITS.clutterNodes ? [{ check: 'clutter', severity: 'minor', screen, text: '', at: [0, 0], detail: `${n} text or tappable elements in view` }] : [] };
}

/**
 * @param ctx { screen, nodes, size:[w,h], density, pkg, settleTimedOut, allowProse }
 */
export function checkScreen(ctx) {
  const c = { density: 320, size: [720, 1600], ...ctx };
  c.app = appNodes(c.nodes, c.pkg);
  const cl = clutter(c);
  const findings = [
    ...tapTargets(c), ...textSize(c), ...truncation(c), ...offscreen(c), ...overlap(c),
    ...collisions(c), ...states(c), ...prose(c), ...jargon(c), ...crowded(c), ...nextStep(c), ...deadEnd(c), ...cl.finding,
  ];
  for (const f of findings) f.fix = FIXES[f.check] || '';
  return { findings, stats: { elements: cl.count, tappable: c.app.filter(n => n.clickable && n.enabled).length } };
}

// ---------- contrast from pixels (node:zlib only; undecodable images are reported as not measured) ----------

/** Decode an 8-bit RGB or RGBA non-interlaced PNG to { width, height, data: RGBA }. Null for anything else. */
export function decodePng(buf) {
  try {
    if (buf.length < 33 || buf.readUInt32BE(0) !== 0x89504e47 || buf.readUInt32BE(4) !== 0x0d0a1a0a) return null;
    let width = 0, height = 0, depth = 0, type = 0, interlace = 0;
    const idat = [];
    for (let p = 8; p + 8 <= buf.length;) {
      const len = buf.readUInt32BE(p);
      const kind = buf.toString('latin1', p + 4, p + 8);
      const body = buf.subarray(p + 8, p + 8 + len);
      if (kind === 'IHDR') { width = body.readUInt32BE(0); height = body.readUInt32BE(4); depth = body[8]; type = body[9]; interlace = body[12]; }
      else if (kind === 'IDAT') idat.push(body);
      else if (kind === 'IEND') break;
      p += 12 + len;
    }
    if (depth !== 8 || interlace !== 0 || (type !== 2 && type !== 6) || !width || !height || width * height > 16e6) return null;
    const bpp = type === 6 ? 4 : 3;
    const stride = width * bpp;
    const raw = zlib.inflateSync(Buffer.concat(idat));
    if (raw.length < (stride + 1) * height) return null;
    const out = Buffer.alloc(width * height * 4, 255);
    let prev = Buffer.alloc(stride);
    for (let y = 0; y < height; y++) {
      const f = raw[y * (stride + 1)];
      const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
      for (let i = 0; i < stride; i++) {
        const a = i >= bpp ? line[i - bpp] : 0;
        const b = prev[i];
        const c = i >= bpp ? prev[i - bpp] : 0;
        let add = 0;
        if (f === 1) add = a;
        else if (f === 2) add = b;
        else if (f === 3) add = (a + b) >> 1;
        else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
        else if (f !== 0) return null;
        line[i] = (line[i] + add) & 255;
      }
      for (let x = 0; x < width; x++) {
        const o = (y * width + x) * 4;
        out[o] = line[x * bpp]; out[o + 1] = line[x * bpp + 1]; out[o + 2] = line[x * bpp + 2];
        if (bpp === 4) out[o + 3] = line[x * bpp + 3];
      }
      prev = line;
    }
    return { width, height, data: out };
  } catch { return null; }
}


const lin = v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/**
 * Contrast between the dominant background and the glyph colour inside a box. Glyph pixels are
 * those that differ visibly from the background; the glyph colour is the strongest quartile of
 * them, so anti-aliased edges do not dilute it. When nothing differs visibly the strongest pixel difference is returned.
 */
export function boxContrast(png, bounds) {
  const x1 = Math.max(0, bounds[0]);
  const y1 = Math.max(0, bounds[1]);
  const x2 = Math.min(png.width, bounds[2]);
  const y2 = Math.min(png.height, bounds[3]);
  if (x2 - x1 < 4 || y2 - y1 < 4) return null;
  const hist = new Map();
  const px = [];
  for (let y = y1; y < y2; y++) {
    for (let x = x1; x < x2; x++) {
      const i = (y * png.width + x) * 4;
      const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      hist.set(key, (hist.get(key) || 0) + 1);
      px.push(lum(r, g, b));
    }
  }
  let bgKey = 0, best = 0;
  for (const [k, v] of hist) if (v > best) { best = v; bgKey = k; }
  const bg = lum(((bgKey >> 10) & 31) << 3, ((bgKey >> 5) & 31) << 3, (bgKey & 31) << 3);
  const all = px.map(l => ratio(l, bg)).sort((a, b) => b - a);
  const glyph = all.filter(r => r >= 1.25);
  // Text that is present but never differs visibly from its background is the worst contrast, not an unmeasurable box.
  if (glyph.length < 3) return all[0];
  return glyph[Math.floor((glyph.length - 1) * 0.25)];
}

/** Contrast findings for the text nodes of one screen. `png` is an image from decodePng. */
export function contrastFindings({ screen, nodes, png, pkg, density = 320, limit = 40, size = [png.width, png.height] }) {
  const dp = DP(density);
  const out = [];
  const app = appNodes(nodes, pkg);
  const barTop = bottomBarTop(app, size);
  const scrollers = app.filter(n => n.scrollable && area(n.bounds) > 0);
  const texts = app.filter(n => n.text && !/\n/.test(n.text) && n.cls !== 'EditText' && n.enabled && !clippedByScroller(n, scrollers, app) && !app.some(d => !d.enabled && d !== n && contains(d.bounds, n.bounds)) && !(n.bounds[3] > barTop && n.bounds[1] > size[1] * 0.5 && !TAB_LABELS.test(n.text.trim())))
    .sort((a, b) => area(b.bounds) - area(a.bounds)).slice(0, limit);
  for (const n of texts) {
    if (n.text.trim().length < 2) continue;
    const r = boxContrast(png, n.bounds);
    if (r == null) continue;
    const large = (n.bounds[3] - n.bounds[1]) / dp >= 24;
    const need = large ? LIMITS.largeTextContrast : LIMITS.textContrast;
    if (r != null && r < need) {
      out.push({ check: 'contrast', fix: FIXES.contrast, severity: r < 3 ? 'major' : 'minor', screen, text: label(n), at: centre(n.bounds), detail: `${r.toFixed(1)}:1, needs ${need}:1` });
    }
  }
  return out;
}
