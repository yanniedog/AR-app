import { execFileSync } from 'child_process';
import zlib from 'zlib';
import fs from 'fs';
import os from 'os';
import path from 'path';

const dir = path.join(__dirname, '..', 'tools', 'app-explorer');
const PKG = 'com.eyex.australianrates';

type N = { text?: string; desc?: string; cls?: string; selected?: boolean; clickable?: boolean; scrollable?: boolean; enabled?: boolean; pkg?: string; bounds: number[] };
const node = (n: N) => ({ text: '', desc: '', id: '', cls: 'View', clickable: false, scrollable: false, checked: false, selected: false, enabled: true, pkg: PKG, ...n });
const row = (product: string, bank: string, comparison: number, advertised: number, y: number) =>
  node({ desc: `${product}, ${bank}, Comparison rate ${comparison.toFixed(2)}%, Advertised rate ${advertised.toFixed(2)}% · Variable`, clickable: true, bounds: [0, y, 720, y + 200] });

function review(screens: Record<string, N[]>, steps: Record<string, unknown>[] = [], opts: { sample?: unknown; stale?: boolean; size?: number[]; png?: Record<string, (x: number, y: number) => number[]> } = {}) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'ux-review-'));
  fs.mkdirSync(path.join(out, 'ui'));
  const names = Object.keys(screens);
  names.forEach((name, i) => {
    const slug = `${String(i + 1).padStart(3, '0')}-${name}`;
    fs.writeFileSync(path.join(out, 'ui', `${slug}.nodes.json`), JSON.stringify({ size: opts.size ?? [720, 1600], nodes: screens[name].map(node) }));
    const paint = opts.png?.[name];
    if (paint) {
      const rgba = Buffer.alloc(720 * 1600 * 4);
      for (let y = 0; y < 1600; y++) for (let x = 0; x < 720; x++) rgba.set([...paint(x, y), 255], (y * 720 + x) * 4);
      const png = encodePng(720, 1600, rgba, 4, [0]);
      fs.mkdirSync(path.join(out, 'screens'), { recursive: true });
      fs.writeFileSync(path.join(out, 'screens', `${slug}.png`), png);
    }
  });
  // A node file left by an earlier run, with no step in this run's report.
  if (opts.stale) fs.writeFileSync(path.join(out, 'ui', '099-old.nodes.json'), JSON.stringify([node({ text: 'Old', clickable: true, bounds: [0, 0, 10, 10] })]));
  if (opts.sample) fs.writeFileSync(path.join(out, 'published-sample.json'), JSON.stringify(opts.sample));
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({
    device: { size: [720, 1600] },
    steps: names.map((name, i) => ({ n: i + 1, name, slug: `${String(i + 1).padStart(3, '0')}-${name}`, settleMs: 100, ...(steps[i] || {}) })),
  }));
  execFileSync(process.execPath, [path.join(dir, 'ux-review.mjs'), out], { encoding: 'utf8' });
  return JSON.parse(fs.readFileSync(path.join(out, 'ux-review.json'), 'utf8')) as {
    findings: { check: string; severity: string; detail: string; fix: string; text: string }[];
    rubric: { key: string; score: number }[]; summaryLines: string[]; screens: number;
    tasks: { task: string; taps: number | null; ms: number | null }[]; firstRun: { firstValueMs: number | null };
  };
}

/** Minimal PNG writer; filters cycle through the given types so the decoder's unfiltering is exercised. */
function encodePng(width: number, height: number, rgba: Buffer, bpp: 3 | 4, filters: number[]): Buffer {
  const stride = width * bpp;
  const rows: Buffer[] = [];
  const pixels = (y: number) => {
    const row = Buffer.alloc(stride);
    for (let x = 0; x < width; x++) for (let c = 0; c < bpp; c++) row[x * bpp + c] = rgba[(y * width + x) * 4 + c];
    return row;
  };
  for (let y = 0; y < height; y++) {
    const f = filters[y % filters.length];
    const cur = pixels(y);
    const prev = y ? pixels(y - 1) : Buffer.alloc(stride);
    const out = Buffer.alloc(stride + 1);
    out[0] = f;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
      const pred = f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : f === 4 ? (pa <= pb && pa <= pc ? a : pb <= pc ? b : c) : 0;
      out[i + 1] = (cur[i] - pred) & 255;
    }
    rows.push(out);
  }
  const chunk = (type: string, body: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length, 0);
    head.write(type, 4, 'latin1');
    return Buffer.concat([head, body, Buffer.alloc(4)]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = bpp === 4 ? 6 : 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}

const checks = (r: ReturnType<typeof review>) => r.findings.map(f => f.check);

describe('app explorer UX review', () => {
  it('flags tap targets under 48 dp and not ones that meet it', () => {
    const r = review({ rates: [
      { text: 'Filter', clickable: true, bounds: [10, 300, 130, 360] },
      { text: 'Search', clickable: true, bounds: [200, 300, 400, 420] },
    ] });
    const small = r.findings.filter(f => f.check === 'tap-target');
    expect(small.map(f => f.text)).toEqual(['Filter']);
    expect(small[0].fix).toMatch(/48 dp/);
  });

  it('flags text boxes that overlap but not a parent that contains its child', () => {
    const r = review({ rates: [
      { text: 'Comparison rate 5.99%', bounds: [10, 300, 400, 340] },
      { text: 'Advertised rate', bounds: [10, 320, 400, 360] },
      { desc: 'Row', clickable: true, bounds: [0, 500, 720, 700] },
      { text: 'Row title', bounds: [20, 520, 300, 560] },
    ] });
    expect(r.findings.filter(f => f.check === 'overlap')).toHaveLength(1);
  });

  it('flags unexpanded jargon and sentences in the app', () => {
    const r = review({ rates: [
      { text: 'LVR', bounds: [10, 300, 200, 340] },
      { text: 'We compare many lenders so that you can find a better deal today.', bounds: [10, 400, 700, 440] },
    ] });
    expect(checks(r)).toEqual(expect.arrayContaining(['jargon', 'prose']));
  });

  it('checks displayed rates for impossible values, duplicates and sort order', () => {
    const r = review({ rates: [
      node({ text: 'Home loans', selected: true, bounds: [0, 200, 200, 260] }),
      node({ text: 'Sort · Comparison rate', bounds: [0, 100, 300, 150] }),
      row('Choice Home Loan', 'Bank A', 6.1, 6.0, 300),
      row('Basic Loan', 'Bank B', 5.9, 6.5, 500),
      row('Basic Loan', 'Bank B', 5.9, 6.5, 700),
    ] });
    const details = r.findings.filter(f => f.check === 'accuracy').map(f => f.detail).join(' | ');
    expect(details).toMatch(/comparison 5.9% is below advertised 6.5%/);
    expect(details).toMatch(/shown 2 times/);
    expect(details).toMatch(/with sort by comparison rate/);
  });

  it('flags first-run gates, slow first value and input requests on the first screen', () => {
    const r = review({ 'cold-start': [
      { text: 'Continue', clickable: true, bounds: [100, 1200, 620, 1320] },
      { text: 'Enter setup key to continue', bounds: [100, 600, 620, 700] },
      row('Basic Loan', 'Bank B', 5.9, 5.8, 300),
    ] }, [{ settleMs: 17000, firstContentMs: 16000 }]);
    expect(checks(r)).toEqual(expect.arrayContaining(['first-run-gate', 'slow-first-value', 'intimidating-first-run']));
    expect(r.rubric.find(x => x.key === 'onboarding')!.score).toBeLessThan(5);
  });

  it('flags a dead-end error state and offers a fix for every finding', () => {
    const r = review({ rates: [{ text: 'Data unavailable', bounds: [100, 600, 620, 660] }] });
    const dead = r.findings.find(f => f.check === 'dead-end-state');
    expect(dead?.severity).toBe('major');
    for (const f of r.findings) { expect(typeof f.fix).toBe('string'); expect(f.fix.length).toBeGreaterThan(0); }
    expect(r.summaryLines.join('\n')).toMatch(/Frustration and abandonment risk/);
  });

  it('scores a clean screen at the top of the rubric', () => {
    const r = review({ rates: [
      row('Choice Home Loan', 'Bank A', 5.9, 5.8, 300),
      row('Basic Loan', 'Bank B', 6.1, 6.0, 500),
      node({ text: 'Saved', clickable: true, bounds: [0, 1480, 240, 1600] }),
      node({ text: 'Updated today', bounds: [0, 150, 400, 200] }),
    ] });
    expect(r.findings.filter(f => f.severity === 'major')).toEqual([]);
    expect(r.rubric.find(x => x.key === 'layout')!.score).toBe(5);
  });

  it('flags fixed content cut off vertically but not scrolled content past the fold', () => {
    const r = review({ rates: [
      { text: 'Fixed bar', clickable: true, bounds: [0, 1560, 720, 1700] },
      { desc: 'list', scrollable: true, bounds: [0, 200, 720, 1500] },
      { text: 'Row inside', bounds: [20, 1400, 700, 1700] },
    ] });
    expect(r.findings.filter(f => f.check === 'off-screen').map(f => f.text)).toEqual(['Fixed bar']);
  });

  it('checks content descriptions for jargon and prose once, not per parent and child', () => {
    const r = review({ rates: [
      { desc: '≤80% LVR', clickable: true, bounds: [0, 300, 300, 400] },
      { text: '≤80% LVR', bounds: [10, 310, 200, 340] },
      { desc: 'This screen shows you the best rates that we found for you today.', bounds: [10, 500, 700, 540] },
    ] });
    expect(r.findings.filter(f => f.check === 'jargon')).toHaveLength(1);
    expect(r.findings.filter(f => f.check === 'prose')).toHaveLength(1);
  });

  it('reads advertised-first rows and flags a missing advertised rate against the published sample', () => {
    const adv = { desc: 'Basic Loan, Bank B, Advertised rate 6.50%, Comparison rate 6.60% · Variable', clickable: true, bounds: [0, 300, 720, 500] };
    const r = review({ rates: [adv] }, [], { sample: [{ product: 'Basic Loan', provider: 'Bank B', comparison: 6.6, advertised: null }] });
    expect(r.findings.some(f => f.check === 'accuracy' && /published 6.6% \/ none%/.test(f.detail))).toBe(true);
  });

  it('flags the same product shown with different rates', () => {
    const r = review({ rates: [
      row('Basic Loan', 'Bank B', 5.9, 5.8, 300),
      row('Basic Loan', 'Bank B', 6.4, 6.3, 500),
    ] });
    expect(r.findings.find(f => f.check === 'accuracy' && /different rates/.test(f.detail))?.severity).toBe('major');
  });

  it('does not treat the Rates search field as an intimidating first run', () => {
    const r = review({ 'cold-start': [{ text: '', desc: 'Search', cls: 'EditText', clickable: true, bounds: [20, 380, 700, 460] }] });
    expect(checks(r)).not.toContain('intimidating-first-run');
  });

  it('reports one keyboard finding even when a single action is hidden', () => {
    const r = review({ search: [
      { text: 'Apply', clickable: true, bounds: [100, 1100, 620, 1220] },
      { cls: 'Keyboard', pkg: 'com.google.android.inputmethod.latin', bounds: [0, 1000, 720, 1600] },
    ] });
    expect(r.findings.filter(f => f.check === 'keyboard-collision')).toHaveLength(1);
  });

  it('reviews only screens from this run and uses the size saved with each screen', () => {
    const r = review({ rates: [{ text: 'Wide', clickable: true, bounds: [0, 300, 1500, 420] }] }, [], { stale: true, size: [1600, 720] });
    expect(r.screens).toBe(1);
    expect(checks(r)).not.toContain('off-screen');
  });

  it('prints unknown for first value and task costs the driver did not measure', () => {
    const unknown = review({ rates: [row('Basic Loan', 'Bank B', 5.9, 5.8, 300)] }, [{ settleMs: 9000 }]);
    expect(unknown.firstRun.firstValueMs).toBeNull();
    expect(unknown.tasks.every(t => t.taps === null && t.ms === null)).toBe(true);
    expect(unknown.summaryLines.join('\n')).toMatch(/First value unknown/);
    const known = review({ 'open-app': [], 'open-product': [] }, [{ firstContentMs: 2100 }, { name: 'open product', firstContentMs: 400, tapped: 'Row' }]);
    expect(known.tasks.find(t => t.task === 'Open a product')).toMatchObject({ taps: 1, ms: 400 });
  });

  it('measures contrast from glyph pixels and says so when it cannot', () => {
    const faint = (x: number, y: number) => (x > 20 && x < 300 && y > 300 && y < 340 && (x + y) % 3 === 0 ? [200, 200, 200] : [255, 255, 255]);
    const bold = (x: number, y: number) => (x > 20 && x < 300 && y > 300 && y < 340 && (x + y) % 3 === 0 ? [20, 20, 20] : [255, 255, 255]);
    const node = { text: 'Rate', bounds: [20, 300, 300, 340] };
    expect(checks(review({ rates: [node] }, [], { png: { rates: faint } }))).toContain('contrast');
    expect(checks(review({ rates: [node] }, [], { png: { rates: bold } }))).not.toContain('contrast');
    const none = review({ rates: [node] });
    expect(checks(none)).toContain('contrast-not-measured');
    expect(none.summaryLines.join('\n')).toMatch(/Contrast not measured/);
  });

  it('decodes RGB and RGBA PNGs with every filter type and rejects what it cannot read', () => {
    const w = 9, h = 10;
    const rgba = Buffer.alloc(w * h * 4);
    for (let i = 0; i < w * h; i++) rgba.set([(i * 7) % 256, (i * 13) % 256, (i * 29) % 256, 255], i * 4);
    const code = `import { decodePng } from ${JSON.stringify(path.join(dir, 'ux-checks.mjs'))};
const [rgb, rgbaPng, bad] = JSON.parse(process.argv[1]).map(x => Buffer.from(x, 'base64'));
const a = decodePng(rgb), b = decodePng(rgbaPng);
console.log(JSON.stringify({ a: a && [a.width, a.height, a.data.toString('base64')], b: b && [b.width, b.height, b.data.toString('base64')], bad: decodePng(bad) }));`;
    const run = execFileSync(process.execPath, ['--input-type=module', '-e', code, JSON.stringify([
      encodePng(w, h, rgba, 3, [0, 1, 2, 3, 4]).toString('base64'), encodePng(w, h, rgba, 4, [4, 3, 2, 1, 0]).toString('base64'), Buffer.from('not a png').toString('base64'),
    ])], { encoding: 'utf8' });
    const got = JSON.parse(run);
    expect(Buffer.from(got.a[2], 'base64').equals(rgba)).toBe(true);
    expect(Buffer.from(got.b[2], 'base64').equals(rgba)).toBe(true);
    expect(got.bad).toBeNull();
  });

  it('ignores Remove and Save controls when reading rate rows', () => {
    const r = review({ saved: [
      row('Basic Loan', 'Bank B', 5.9, 5.8, 300),
      node({ desc: 'Remove, Basic Loan, Bank B, Comparison rate 7.20%, Advertised rate 7.10%', clickable: true, bounds: [600, 300, 720, 420] }),
      node({ desc: 'Save, Basic Loan, Bank B, Comparison rate 7.30%', clickable: true, bounds: [600, 500, 720, 620] }),
    ] });
    expect(r.findings.filter(f => f.check === 'accuracy')).toEqual([]);
  });

  it('expects deposits to sort highest first and loans lowest first', () => {
    const list = (tab: string, rates: number[]) => ({ [`${tab}`]: [
      node({ desc: tab, selected: true, clickable: true, bounds: [0, 200, 200, 260] }),
      node({ text: 'Sort · Advertised rate', bounds: [0, 100, 300, 150] }),
      ...rates.map((x, i) => node({ desc: `Product ${i}, Bank ${i}, Advertised rate ${x.toFixed(2)}%`, clickable: true, bounds: [0, 300 + i * 200, 720, 480 + i * 200] })),
    ] });
    const sortFlag = (r: ReturnType<typeof review>) => r.findings.some(f => f.check === 'accuracy' && /with sort by/.test(f.detail));
    expect(sortFlag(review(list('Savings', [5.1, 4.8, 4.2])))).toBe(false);
    expect(sortFlag(review(list('Savings', [4.2, 4.8, 5.1])))).toBe(true);
    expect(sortFlag(review(list('Home loans', [5.1, 4.8, 4.2])))).toBe(true);
    expect(sortFlag(review(list('Home loans', [4.2, 4.8, 5.1])))).toBe(false);
  });

  it('reports very faint or invisible text as low contrast instead of skipping it', () => {
    const faint = (x: number, y: number) => (x > 20 && x < 300 && y > 300 && y < 340 && (x + y) % 3 === 0 ? [240, 240, 240] : [255, 255, 255]);
    const blank = () => [255, 255, 255];
    const node = { text: 'Rate', bounds: [20, 300, 300, 340] };
    expect(review({ rates: [node] }, [], { png: { rates: faint } }).findings.filter(f => f.check === 'contrast')).toHaveLength(1);
    expect(review({ rates: [node] }, [], { png: { rates: blank } }).findings.filter(f => f.check === 'contrast')).toHaveLength(1);
  });

  it('reads cards labelled with a payable-rate origin and keeps the provider boundary', () => {
    const r = review({ rates: [
      node({ desc: 'Basic Loan, Bank B, Public payable rate 31.00%, Monthly repayment $2,000, Eligibility unverified', clickable: true, bounds: [0, 300, 720, 500] }),
      node({ desc: 'Everyday Saver, Bank C, Rate 4.50%, Tier 2', clickable: true, bounds: [0, 600, 720, 800] }),
    ] });
    const acc = r.findings.filter(f => f.check === 'accuracy');
    expect(acc).toHaveLength(1);
    expect(acc[0].text).toBe('Basic Loan, Bank B');
    expect(acc[0].detail).toMatch(/payable rate 31% outside/);
  });

  it('accepts a published 0% deposit rate but not a 0% loan rate', () => {
    const tab = (name: string) => node({ text: name, selected: true, bounds: [0, 200, 200, 260] });
    const zero = node({ desc: 'Everyday Saver, Bank C, Rate 0.00%', clickable: true, bounds: [0, 300, 720, 500] });
    const bad = (r: ReturnType<typeof review>) => r.findings.some(f => f.check === 'accuracy' && /outside/.test(f.detail));
    expect(bad(review({ savings: [tab('Savings'), zero] }))).toBe(false);
    expect(bad(review({ loans: [tab('Home loans'), node({ desc: 'Basic Loan, Bank B, Advertised rate 0.00%', clickable: true, bounds: [0, 300, 720, 500] })] }))).toBe(true);
  });

  it('does not report first value or a completed best-rate task when launch ends on Data unavailable', () => {
    const r = review({ 'cold-start': [
      { text: 'Data unavailable', bounds: [100, 600, 620, 660] },
      { text: 'Try again', clickable: true, bounds: [100, 900, 620, 1020] },
    ] }, [{ firstContentMs: 1500, settleMs: 1500 }]);
    expect(r.firstRun.firstValueMs).toBeNull();
    expect(r.tasks.find(t => t.task === 'Find the best rate')).toMatchObject({ taps: null, ms: null });
    expect(checks(r)).toContain('no-first-value');
    expect(r.rubric.find(x => x.key === 'onboarding')!.score).toBeLessThan(5);
  });

  it('does not count the Lenders filter control as opening a lender', () => {
    const r = review({ 'open-app': [], 'open-lenders': [], 'lender-detail': [] }, [{}, { name: 'open lenders', firstContentMs: 900, tapped: 'Lenders' }, { name: 'lender detail', firstContentMs: 700, tapped: 'Row' }]);
    expect(r.tasks.find(t => t.task === 'Open a lender')).toMatchObject({ taps: 1, ms: 700 });
    const only = review({ 'open-lenders': [] }, [{ name: 'open lenders', firstContentMs: 900, tapped: 'Lenders' }]);
    expect(only.tasks.find(t => t.task === 'Open a lender')).toMatchObject({ taps: null, ms: null });
  });

  it('judges navigation by the tab labels, not by anything near the bottom of the screen', () => {
    const tab = (t: string, x: number) => node({ text: t, clickable: true, bounds: [x, 1480, x + 240, 1600] });
    const scrolled = node({ desc: 'Basic Loan, Bank B, Advertised rate 5.10%', clickable: true, bounds: [0, 1420, 720, 1600] });
    const full = review({ a: [tab('Rates', 0), tab('Saved', 240), tab('Market', 480), scrolled], b: [tab('Rates', 0), tab('Saved', 240), tab('Market', 480)] });
    expect(checks(full)).not.toContain('nav-inconsistent');
    expect(checks(review({ a: [scrolled] }))).not.toContain('nav-inconsistent');
    expect(checks(review({ a: [tab('Rates', 0), tab('Saved', 240)] }))).toContain('nav-inconsistent');
  });
});
