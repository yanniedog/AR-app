import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const dir = path.join(__dirname, '..', 'tools', 'app-explorer');

function verdict(report: unknown, baseline: unknown) {
  const code = `import { computeVerdict, outcomeLine } from ${JSON.stringify(path.join(dir, 'session-verdict.mjs'))};
const [report, baseline] = JSON.parse(process.argv[1]);
const v = computeVerdict(report, baseline);
console.log(JSON.stringify({ ...v, line: outcomeLine(v) }));`;
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', code, JSON.stringify([report, baseline])], { encoding: 'utf8' }));
}

const step = (n: number, name: string, extra: Record<string, unknown> = {}) => ({
  n, name, session: true, alive: true, settleMs: 1200, firstContentMs: 900, responseMs: 300,
  frames: { frames: 100, janky: 10 }, visible: ['Rates'], ...extra,
});
const report = (steps: unknown[], version = '1.0.1') => ({ app: { versionName: version }, steps });

describe('real-use session verdict', () => {
  it('passes a clean session with no baseline', () => {
    const v = verdict(report([step(1, 'open app'), step(2, 'open product')]), null);
    expect(v.outcome).toBe('pass');
    expect(v.line).toContain('PASS');
  });

  it('fails on crash, ANR, stuck spinner, blank screen, dead end and step errors', () => {
    const v = verdict(report([
      step(1, 'a', { alive: false }), step(2, 'b', { anr: true }), step(3, 'c', { maxLoadingMs: 16000 }),
      step(4, 'd', { blank: true }), step(5, 'e', { error: 'not found: "Lenders"' }), step(6, 'f', { deadEnd: true }),
    ]), null);
    expect(v.outcome).toBe('fail');
    expect(v.findings.map((f: { kind: string }) => f.kind).sort()).toEqual(['anr', 'blank-screen', 'crash', 'dead-end', 'journey', 'stuck-spinner']);
  });

  it('does not fail on slow absolute timings alone', () => {
    const v = verdict(report([step(1, 'open app', { settleMs: 9000, firstContentMs: 8500, responseMs: 8000, activityStartMs: 900 })]), null);
    expect(v.outcome).toBe('pass');
  });

  it('keeps failed steps recorded after an exception in the session', () => {
    const v = verdict(report([step(1, 'ok'), step(2, 'boom', { error: 'adb failed' })]), null);
    expect(v.findings.map((f: { name: string }) => f.name)).toEqual(['boom']);
  });

  it('flags what frustrates people as friction, not a crash', () => {
    const v = verdict(report([
      step(1, 'slow tap', { responseMs: 3500 }),
      step(2, 'empty wait', { responseMs: 400, firstContentMs: 6400 }),
      step(3, 'second tap', { retapped: true }),
      step(4, 'jumpy', { shifts: 3 }),
      step(5, 'error with action', { errorState: { text: 'Refresh failed', action: true } }),
    ]), null);
    expect(v.outcome).toBe('attention');
    expect(v.findings.map((f: { kind: string }) => f.kind).sort()).toEqual(['empty-wait', 'error-shown', 'layout-jump', 'repeated-tap', 'unresponsive']);
  });

  it('fails an error or empty state that offers no action, and nothing to read for 15 s', () => {
    const v = verdict(report([
      step(1, 'error', { errorState: { text: 'Something went wrong', action: false } }),
      step(2, 'empty', { responseMs: 300, firstContentMs: 16000 }),
    ]), null);
    expect(v.findings.map((f: { kind: string }) => f.kind).sort()).toEqual(['error-no-action', 'no-content']);
    expect(v.outcome).toBe('fail');
  });

  it('flags a regression only against the previous build', () => {
    const base = report([step(1, 'open app', { firstContentMs: 2000 })], '1.0.0');
    const slower = verdict(report([step(1, 'open app', { firstContentMs: 5200 })]), base);
    expect(slower.outcome).toBe('attention');
    expect(slower.findings[0].kind).toBe('slower');
    const same = verdict(report([step(1, 'open app', { firstContentMs: 2600 })]), base);
    expect(same.outcome).toBe('pass');
  });

  it('flags dropped frames well above the previous build, and extreme jank outright', () => {
    const base = report([step(1, 'scroll', { frames: { frames: 100, janky: 10 } })], '1.0.0');
    expect(verdict(report([step(1, 'scroll', { frames: { frames: 100, janky: 40 } })]), base).findings[0].kind).toBe('jank');
    expect(verdict(report([step(1, 'scroll', { frames: { frames: 100, janky: 97 } })]), null).outcome).toBe('fail');
    expect(verdict(report([step(1, 'scroll', { frames: { frames: 100, janky: 80 } })]), null).outcome).toBe('pass');
    expect(verdict(report([step(1, 'scroll', { frames: { frames: 5, janky: 5 } })]), null).outcome).toBe('pass');
  });
});

describe('session script', () => {
  const steps = JSON.parse(fs.readFileSync(path.join(dir, 'scripts', 'session.json'), 'utf8')) as Record<string, unknown>[];

  it('walks rates, product, lenders, market, rba and back with human pauses', () => {
    const names = steps.map(s => s.name);
    for (const n of ['open app', 'open product', 'open lenders', 'open market', 'open rba', 'return to rates']) expect(names).toContain(n);
    expect(steps.filter(s => s.launch !== undefined)).toHaveLength(1);
    for (const s of steps.slice(1)) expect(Number(s.think)).toBeGreaterThanOrEqual(800);
  });

  it('asserts where each main navigation lands', () => {
    for (const n of ['open product', 'back to rates', 'open market', 'open rba', 'back from rba', 'return to rates']) {
      const s = steps.find(x => x.name === n) as Record<string, unknown>;
      expect(Boolean(s.then || s.gone)).toBe(true);
    }
  });
});
