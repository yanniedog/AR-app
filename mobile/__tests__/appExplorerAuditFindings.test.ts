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
  test('folds numbers in error text so one cause is one group', () => {
    const { groups } = run([
      check('a', { error: { message: 'Step exceeded the 10-second limit (10015ms)' } }),
      check('b', { error: { message: 'Step exceeded the 10-second limit (10018ms)' } }),
      check('c', { kind: 'network', error: 'HTTP 404: missing', durationMs: 5 }),
      { id: 'd', kind: 'network', status: 'pass' },
    ]);
    expect(groups.map((g: any) => [g.kind, g.count])).toEqual([['journey', 2], ['network', 1]]);
    expect(groups[0].examples).toEqual(['a', 'b']);
  });
});
