import { execFileSync } from 'child_process';
import path from 'path';

const dir = path.join(__dirname, '..', 'tools', 'app-explorer');
const run = (checks: unknown[]) => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e',
  `import { groupAuditFailures, failureCause } from ${JSON.stringify(path.join(dir, 'audit-findings.mjs'))};
   const checks = ${JSON.stringify(checks)};
   console.log(JSON.stringify({ groups: groupAuditFailures(checks), cause: failureCause(checks[0]) }));`], { encoding: 'utf8' }));

const check = (id: string, extra: Record<string, unknown>) => ({ id, kind: 'journey', status: 'fail', durationMs: 10015, ...extra });

describe('audit failure grouping', () => {
  test('names the stuck probe as the cause', () => {
    const { cause } = run([check('a', { diagnostic: { readiness: { blockers: [{ surface: 'lender.details', probe: 'lender.products' }] } } })]);
    expect(cause).toBe('lender.details lender.products never became ready');
  });
  test('keeps different HTTP statuses apart', () => {
    const { groups } = run([check('a', { kind: 'network', error: 'HTTP 404: gone' }), check('b', { kind: 'network', error: 'HTTP 500: gone' })]);
    expect(groups).toHaveLength(2);
  });
  test('names a probe that errored, not only one that is pending', () => {
    const { cause } = run([check('a', { diagnostic: { readiness: { blockers: [{ code: 'probe-error', surface: 'rba.dashboard', probe: 'rba.data' }] } } })]);
    expect(cause).toBe('rba.dashboard rba.data probe-error');
  });
  test('falls back to the blocker code when no probe is named', () => {
    const { cause } = run([check('a', { diagnostic: { readiness: { blockers: [{ code: 'no-surfaces' }] } } })]);
    expect(cause).toBe('readiness blocked: no-surfaces');
  });
  test('folds numbers in error text so one cause is one group', () => {
    const { groups } = run([
      check('a', { error: { message: 'Step exceeded the 10-second limit (10015ms)' } }),
      check('b', { error: { message: 'Step exceeded the 10-second limit (10018ms)' } }),
      check('c', { kind: 'network', error: 'HTTP 404: missing', durationMs: 5 }),
      { id: 'd', kind: 'network', status: 'pass' },
    ]);
    expect(groups.map((g: any) => [g.kind, g.count])).toEqual([['journey', 2], ['network', 1]]);
    expect(groups[0].cause).not.toMatch(/10015|10018/);
    expect(groups[0].examples).toEqual(['a', 'b']);
  });
});

test('table cells cannot carry markdown or mentions', () => {
  const out = execFileSync(process.execPath, ['--input-type=module', '-e',
    `import { renderAuditFailureGroups } from ${JSON.stringify(path.join(dir, 'audit-findings.mjs'))};
     console.log(JSON.stringify(renderAuditFailureGroups([{ kind: 'network', cause: 'a | b @user [x](http://e)\\nnext', count: 1, maxMs: 1, examples: ['id'] }])));`], { encoding: 'utf8' });
  const row = JSON.parse(out)[3] as string;
  expect(row.split('|')).toHaveLength(7);
  expect(row).not.toMatch(/[@\[\]\n]/);
});
