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

  it('fails on crash, ANR, stuck spinner, blank screen and step errors', () => {
    const v = verdict(report([
      step(1, 'a', { alive: false }), step(2, 'b', { anr: true }), step(3, 'c', { maxLoadingMs: 16000 }),
      step(4, 'd', { blank: true }), step(5, 'e', { error: 'not found: "Lenders"' }),
    ]), null);
    expect(v.outcome).toBe('fail');
    expect(v.findings.map((f: { kind: string }) => f.kind).sort()).toEqual(['anr', 'blank-screen', 'crash', 'journey', 'stuck-spinner']);
  });

  it('does not fail on slow absolute timings alone', () => {
    const v = verdict(report([step(1, 'open app', { settleMs: 9000, firstContentMs: 8500 })]), null);
    expect(v.outcome).toBe('pass');
  });

  it('flags a regression only against the previous build', () => {
    const base = report([step(1, 'open app', { firstContentMs: 2000 })], '1.0.0');
    const slower = verdict(report([step(1, 'open app', { firstContentMs: 5200 })]), base);
    expect(slower.outcome).toBe('regression');
    expect(slower.findings[0].kind).toBe('slower');
    const same = verdict(report([step(1, 'open app', { firstContentMs: 2600 })]), base);
    expect(same.outcome).toBe('pass');
  });

  it('flags dropped frames well above the previous build, and extreme jank outright', () => {
    const base = report([step(1, 'scroll', { frames: { frames: 100, janky: 10 } })], '1.0.0');
    expect(verdict(report([step(1, 'scroll', { frames: { frames: 100, janky: 40 } })]), base).outcome).toBe('regression');
    expect(verdict(report([step(1, 'scroll', { frames: { frames: 100, janky: 70 } })]), null).outcome).toBe('fail');
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
});
