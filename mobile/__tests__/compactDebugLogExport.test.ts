import { compactDebugLogExport } from '../src/lib/compactDebugLogExport';

const sessionId = 'pa-mv4wkeob-cnd55yp0';
const check = (id: string, status: string, metrics: Record<string, unknown> = {}) => ({
  id, label: id, kind: 'journey', status, durationMs: 123.456, metrics,
});
const event = (value: unknown, time = '2026-10-12T07:12:21.717Z') => `${time} [WARN ] perf-audit: ${JSON.stringify(value)}`;
const unpack = (output: string) => {
  const wrapper = JSON.parse(output.trim().split('\n').at(-1)!);
  const resolve = (value: unknown): any => {
    if (Array.isArray(value)) return value.map(resolve);
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      if (Object.keys(obj).length === 1 && typeof obj.$text === 'number') return wrapper.texts[obj.$text];
      return Object.fromEntries(Object.entries(obj).map(([key, nested]) => [key, resolve(nested)]));
    }
    return value;
  };
  return resolve(wrapper.report);
};
const details = (summary: any) => summary.detailGroups.flatMap((group: any) => group.rows.map((row: unknown[]) => {
  const value = Object.fromEntries(group.columns.map((column: string, index: number) => [column, row[index]]));
  value.metrics = { ...group.commonMetrics, ...Object.fromEntries(group.metricColumns.map((key: string, index: number) => [key, (value.metrics as unknown[])[index]])) };
  return value;
}));

it('groups known local-link warnings and routine passes, retaining every failure/skip and exact measurements', () => {
  const failure = { ...check('product.open', 'fail', { expected: 6.125, actual: 6.12, missingValue: null, actionCompleted: false }), error: '80% LVR path did not match', trace: 'native stack' };
  const skipped = check('product.history', 'skipped', { reason: 'Earlier failure removed screen state', skipClassification: 'scenario-recovery', scenarioRecoveryCascade: true, executionAttempted: false });
  const link = { ...check('external-link-765', 'warn'), kind: 'network', metrics: { urlValidation: 'pass', browserHandler: 'unknown', handlerAttempted: false, httpReachability: 'unknown', httpAttempted: false, nonTimingFailure: false, reason: 'Local mode' } };
  const checks = [failure, skipped, check('ready', 'pass'), ...Array.from({ length: 200 }, (_, i) => ({ ...link, id: `link-${i}` }))];
  const input = [event({ kind: 'check', sessionId, check: failure }), JSON.stringify({ sessionId, checks, coverage: { complete: false }, environment: { appVersion: '1.0.229', buildVersion: '290' } })].join('\n');
  const output = compactDebugLogExport(input);
  const report = unpack(output);
  expect(report.checks.total).toBe(203);
  expect(report.checks.routineGroups.reduce((sum: number, group: any) => sum + group.count, 0)).toBe(201);
  expect(details(report.checks)).toEqual([failure, skipped]);
  expect(report.coverage).toEqual({ complete: false });
  expect(report.environment.buildVersion).toBe('290');
  expect(output.length).toBeLessThan(input.length / 10);
});

it('does not aggregate unexpected pass errors, over-budget passes, or unknown network warnings', () => {
  const checks = [{ ...check('hidden-error', 'pass'), error: 'unexpected' },
    { ...check('too-slow', 'pass'), durationMs: 10_001 },
    { ...check('unsafe-url', 'warn'), kind: 'network', metrics: { urlValidation: 'fail' } }];
  expect(details(unpack(compactDebugLogExport(JSON.stringify({ sessionId, checks }))).checks)).toEqual(checks);
});

it('preserves raw crash lines, malformed audit JSON, old-session boundaries and last durable checkpoints', () => {
  const raw = '# Previous app session\n2026-10-12T07:00:00Z [ERROR] recovery: write failed\nperf-audit: {broken';
  const output = compactDebugLogExport([raw,
    event({ sessionId, kind: 'checkpoint', storedChecks: 3 }),
    event({ sessionId, kind: 'checkpoint', storedChecks: 4 }),
    event({ sessionId, kind: 'check', check: check('fatal', 'fail', { reason: 'deadline' }) }),
  ].join('\n'));
  expect(output).toContain(raw);
  const report = unpack(output);
  expect(report.partial).toBe(true);
  expect(report.lastCheckpoints).toEqual([expect.objectContaining({ storedChecks: 4, logPrefix: '2026-10-12T07:12:21.717Z [WARN ]' })]);
  expect(details(report.checks)[0].journalLogPrefix).toContain('2026-10-12T07:12:21.717Z');
});

it('retains earlier failure evidence when a duplicate ID later passes or the report disagrees', () => {
  const failed = { ...check('restore', 'fail'), error: 'Storage write failed' };
  const passed = check('restore', 'pass');
  const output = compactDebugLogExport([
    event({ kind: 'check', sessionId, check: failed }),
    event({ kind: 'check', sessionId, check: passed }),
    JSON.stringify({ sessionId, checks: [passed] }),
  ].join('\n'));
  const report = unpack(output);
  expect(report.duplicateJournalIds).toEqual(['restore']);
  expect(details(report.additionalJournalChecks)[0].error).toBe('Storage write failed');
  expect(details(report.duplicateJournalChecks)[0].error).toBe('Storage write failed');
});

it('keeps same-session timing, errors and versions separate across sessions', () => {
  const output = compactDebugLogExport([
    JSON.stringify({ sessionId: 'old', app: { buildVersion: '289' }, checks: [check('old-failure', 'fail')] }),
    JSON.stringify({ sessionId: 'new', app: { buildVersion: '290' }, checks: [check('new-success', 'pass')] }),
  ].join('\n'));
  const reports = output.split('\n').filter((line) => line.startsWith('{')).map((line) => JSON.parse(line).report);
  expect(reports.map((report) => [report.sessionId, report.app.buildVersion])).toEqual([['old', '289'], ['new', '290']]);
});

it('retains conflicting failure measurements even if status and error text match the sidecar', () => {
  const journal = { ...check('write', 'fail', { pending: 4 }), error: 'Write deadline', trace: 'original stack' };
  const final = { ...journal, metrics: { pending: 0 }, trace: 'replacement stack' };
  const report = unpack(compactDebugLogExport([
    event({ kind: 'check', sessionId, check: journal }), JSON.stringify({ sessionId, checks: [final] }),
  ].join('\n')));
  expect(details(report.additionalJournalChecks)[0]).toMatchObject(journal);
  expect(details(report.checks)[0]).toEqual(final);
});

it('retains upstream failures even when the census passes, while compacting provider counts and plan steps', () => {
  const failed = { status: 'fail', localEvidence: { failedSurfaceIds: ['outlook.dashboard'] } };
  const report = unpack(compactDebugLogExport(JSON.stringify({ sessionId, checks: [],
    plan: { inputs: { seed: 'repeatable' }, passes: [{ id: 'first', steps: [{ id: 'a' }, { id: 'b' }] }] },
    appHealth: { checks: [failed, { status: 'pass', metrics: { products: 2814 }, localEvidence: {
      producerFailures: [{ provider: 'Aussie Home Loans', status: 404 }],
      sourceAccounting: { excluded_rates: 157 }, detailsOnlyProductKeys: ['a'],
      sections: [{ section: 'Mortgage', providers: [{ provider: 'Aussie Home Loans', published: { rates: 0 }, missingDetails: 1 }] }],
    } }] },
  })));
  expect(report.appHealth.checks[0]).toEqual(failed);
  expect(report.appHealth.checks[1].localEvidence).toEqual({
    producerFailures: [{ provider: 'Aussie Home Loans', status: 404 }],
    sourceAccounting: { excluded_rates: 157 }, detailsOnlyProductKeys: ['a'],
    sections: [{ section: 'Mortgage', providerTable: { count: 1, columns: ['provider', 'published.rates', 'missingDetails'], rows: [['Aussie Home Loans', 0, 1]] } }],
  });
  expect(report.plan).toEqual({ inputs: { seed: 'repeatable' }, passes: [{ id: 'first', plannedSteps: 2 }] });
});

it('leaves non-audit exports unchanged', () => {
  const text = 'Native fatal exception\nunknown diagnostic\n{"sessionId":"other","data":"keep"}';
  expect(compactDebugLogExport(text)).toBe(text);
});
