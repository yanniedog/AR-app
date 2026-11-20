import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const dir = path.join(__dirname, '..', 'tools', 'app-explorer');
const PKG = 'com.eyex.australianrates';

type N = { text?: string; desc?: string; cls?: string; clickable?: boolean; scrollable?: boolean; enabled?: boolean; pkg?: string; bounds: number[] };
const node = (n: N) => ({ text: '', desc: '', id: '', cls: 'View', clickable: false, scrollable: false, checked: false, selected: false, enabled: true, pkg: PKG, ...n });
const row = (product: string, bank: string, comparison: number, advertised: number, y: number) =>
  node({ desc: `${product}, ${bank}, Comparison rate ${comparison.toFixed(2)}%, Advertised rate ${advertised.toFixed(2)}% · Variable`, clickable: true, bounds: [0, y, 720, y + 200] });

function review(screens: Record<string, N[]>, steps: Record<string, unknown>[] = []) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'ux-review-'));
  fs.mkdirSync(path.join(out, 'ui'));
  const names = Object.keys(screens);
  names.forEach((name, i) => {
    const slug = `${String(i + 1).padStart(3, '0')}-${name}`;
    fs.writeFileSync(path.join(out, 'ui', `${slug}.nodes.json`), JSON.stringify(screens[name].map(node)));
  });
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({
    device: { size: [720, 1600] },
    steps: names.map((name, i) => ({ n: i + 1, name, slug: `${String(i + 1).padStart(3, '0')}-${name}`, settleMs: 100, ...(steps[i] || {}) })),
  }));
  execFileSync(process.execPath, [path.join(dir, 'ux-review.mjs'), out], { encoding: 'utf8' });
  return JSON.parse(fs.readFileSync(path.join(out, 'ux-review.json'), 'utf8')) as {
    findings: { check: string; severity: string; detail: string; fix: string; text: string }[];
    rubric: { key: string; score: number }[]; summaryLines: string[]; screens: number;
  };
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
      { text: 'Setup key', cls: 'EditText', bounds: [100, 600, 620, 700] },
    ] }, [{ settleMs: 17000 }]);
    expect(checks(r)).toEqual(expect.arrayContaining(['first-run-gate', 'slow-first-value', 'intimidating-first-run']));
    expect(r.rubric.find(x => x.key === 'onboarding')!.score).toBeLessThan(5);
  });

  it('flags a dead-end error state and offers a fix for every finding', () => {
    const r = review({ rates: [{ text: 'Data unavailable', bounds: [100, 600, 620, 660] }] });
    const dead = r.findings.find(f => f.check === 'dead-end-state');
    expect(dead?.severity).toBe('major');
    for (const f of r.findings) expect(f.fix).not.toBe('');
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
});
