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
    event({ sessionId, kind: 'checkpoint', storedChecks: 3 }).replace('[WARN ]', '[INFO ]'),
    event({ sessionId, kind: 'checkpoint', storedChecks: 4 }).replace('[WARN ]', '[INFO ]'),
    event({ sessionId, kind: 'check', check: check('fatal', 'fail', { reason: 'deadline' }) }),
  ].join('\n'));
  expect(output).toContain(raw);
  const report = unpack(output);
  expect(report.partial).toBe(true);
  expect(report.lastCheckpoints).toEqual([expect.objectContaining({ storedChecks: 4, logPrefix: '2026-10-12T07:12:21.717Z [INFO ]' })]);
  expect(details(report.checks)[0].journalLogPrefix).toContain('2026-10-12T07:12:21.717Z');
});

it.each([
  ['ERROR', {}], ['WARN', {}], ['INFO', { error: 'Previous write failed', trace: 'native stack' }],
  ['INFO', { status: 'fail' }], ['INFO', { metrics: { nonTimingFailure: true } }],
  ['INFO', { diagnosticDetails: { operation: 'restore', cause: 'disk full' } }],
  ['INFO', { durationMs: 10_001 }], ['INFO', { storedChecks: 'unknown' }],
  ['INFO', { storedChecks: null }],
] as const)('preserves %s checkpoint evidence before later routine progress (%j)', (level, evidence) => {
  const failed = { sessionId, kind: 'checkpoint', storedChecks: 3, ...evidence };
  const report = unpack(compactDebugLogExport([
    event(failed, '2026-10-12T07:00:00Z').replace('[WARN ]', `[${level} ]`),
    event({ sessionId, kind: 'checkpoint', storedChecks: 4 }, '2026-10-12T07:00:01Z').replace('[WARN ]', '[INFO ]'),
    event({ sessionId, kind: 'checkpoint', storedChecks: 5 }, '2026-10-12T07:00:02Z').replace('[WARN ]', '[INFO ]'),
  ].join('\n')));
  expect(report.journalEvents).toEqual([{ ...failed, sourceLine: 1, logPrefix: `2026-10-12T07:00:00Z [${level} ]` }]);
  expect(report.lastCheckpoints).toEqual([{ sessionId, kind: 'checkpoint', storedChecks: 5,
    sourceLine: 3, logPrefix: '2026-10-12T07:00:02Z [INFO ]' }]);
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

it('keeps compact run markers between raw crash lines and timestamps canonical anomalies', () => {
  const failed = { ...check('restore', 'fail'), error: 'Storage write failed' };
  const output = compactDebugLogExport([
    '# Previous app session',
    event({ kind: 'checkpoint', sessionId, storedChecks: 3 }, '2026-10-12T07:00:00Z'),
    event({ kind: 'check', sessionId, check: failed }, '2026-10-12T07:00:01Z'),
    '2026-10-12T07:00:02Z [ERROR] app: native crash',
    '# Current app session',
    event({ kind: 'start', sessionId: 'new' }, '2026-10-12T07:01:00Z'),
    '2026-10-12T07:01:01Z [WARN ] recovery: journal retained',
    JSON.stringify({ sessionId, checks: [failed] }),
  ].join('\n'));
  const markers = output.split('\n').filter(line => line.startsWith('# Audit source {'));
  expect(markers).toHaveLength(3);
  expect(JSON.parse(markers[0].slice('# Audit source '.length))).toMatchObject({ sessionId, lines: [2, 3] });
  expect(output.indexOf(markers[0])).toBeLessThan(output.indexOf('app: native crash'));
  expect(output.indexOf('app: native crash')).toBeLessThan(output.indexOf(markers[1]));
  expect(output.indexOf(markers[1])).toBeLessThan(output.indexOf('recovery: journal retained'));
  const wrapper = JSON.parse(output.split('\n').find(line => line.startsWith('{') && line.includes(`"sessionId":"${sessionId}"`))!);
  expect(wrapper.report.checkLocations).toEqual({ columns: ['id', 'sourceLine', 'logPrefix'],
    rows: [['restore', 3, '2026-10-12T07:00:01Z [WARN ]']] });
  expect(wrapper.report.additionalJournalChecks).toBeUndefined();
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

it('compacts nested fallback reports without losing failure, session or incomplete evidence', () => {
  const failure = { ...check('persistence', 'fail', { queued: 4 }), error: 'Native write failed', trace: 'native stack' };
  const fallback = { kind: 'report-fallback', sessionId, storeError: 'The saved report is incomplete',
    app: { buildVersion: '290' }, report: { sessionId, partial: true,
      checks: [failure, ...Array.from({ length: 500 }, (_, i) => check(`pass-${i}`, 'pass'))],
      appHealth: { checks: [{ status: 'warn', localEvidence: { producerFailures: [{ provider: 'Geelong Bank', status: '200' }] } }] },
    } };
  const input = `[INCOMPLETE EXPORT: previous log unreadable]\n${event(fallback)}`;
  const output = compactDebugLogExport(input);
  const retained = unpack(output).journalEvents[0];
  expect(output).toContain('[INCOMPLETE EXPORT: previous log unreadable]');
  expect(retained).toMatchObject({ kind: fallback.kind, sessionId, app: fallback.app, storeError: fallback.storeError,
    report: { sessionId, partial: true, appHealth: fallback.report.appHealth } });
  expect(retained.report.checks.total).toBe(501);
  expect(details(retained.report.checks)).toEqual([failure]);
  expect(output.length).toBeLessThan(input.length / 10);
});

it('retains successful probe context for display failures, including unknown journal fields and source chronology', () => {
  const probe = check('search.enter', 'pass', { readinessEvidence: 'search.results: ready, visibleRows=0, modelRows=450',
    nonTimingFailure: false, futureProbe: { viewport: null, renderGeneration: 17 } });
  const warning = check('chart.open', 'warn', { graphicEvidence: 'outlook.dashboard: ready, chartPoints=12',
    nonTimingFailure: false, actionCompleted: true, renderRevisionBefore: 'before', renderRevisionAfter: 'after',
    readinessActionEvidence: 'open-chart: action completed', futureMetric: [null, false, 'exact'] });
  const laterProbe = { ...probe, id: 'search.return', label: 'search.return' };
  const journalProbe = { ...probe, futureJournalEvidence: { originalVisit: 'first', unknownField: null } };
  const health = { checks: [{ id: 'display-visible', code: 'display-visible', status: 'fail',
    localEvidence: { failedSurfaceIds: ['search.results'] } }] };
  const links = Array.from({ length: 400 }, (_, i) => ({ ...check(`link-${i}`, 'warn'), kind: 'network', metrics: {
    urlValidation: 'pass', browserHandler: 'pass', httpReachability: 'unknown', httpAttempted: false, nonTimingFailure: false,
  } }));
  const input = [
    event({ kind: 'check', sessionId, check: journalProbe }, '2026-10-12T07:00:01Z').replace('[WARN ]', '[INFO ]'),
    '2026-10-12T07:00:02Z [WARN ] app: viewport observation',
    event({ kind: 'check', sessionId, check: warning }, '2026-10-12T07:00:03Z'),
    JSON.stringify({ sessionId, checks: [probe, ...links, warning, laterProbe], appHealth: health }),
  ].join('\n');
  const output = compactDebugLogExport(input);
  const report = unpack(output);
  const indexed = report.checks.detailGroups.flatMap((group: any) => details({ detailGroups: [group] })
    .map((value: unknown, i: number) => ({ index: group.checkIndexes[i], value })))
    .sort((a: any, b: any) => a.index - b.index);
  expect(indexed).toEqual([{ index: 0, value: probe }, { index: 401, value: warning }, { index: 402, value: laterProbe }]);
  expect(details(report.additionalJournalChecks)).toEqual([{ ...journalProbe, journalLogPrefix: '2026-10-12T07:00:01Z [INFO ]' }]);
  expect(report.checkLocations).toEqual({ columns: ['id', 'sourceLine', 'logPrefix'], rows: [
    ['search.enter', 1, '2026-10-12T07:00:01Z [INFO ]'], ['chart.open', 3, '2026-10-12T07:00:03Z [WARN ]'],
  ] });
  expect(report.appHealth).toEqual(health);
  expect(report.checks.routineGroups).toEqual([expect.objectContaining({ kind: 'network', count: 400 })]);
  expect(output).toContain('app: viewport observation');
  expect(output.length).toBeLessThan(input.length / 10);
});

it.each(['readinessEvidence', 'graphicEvidence', 'readinessActionEvidence'])(
  'retains %s in older partial journals without requiring a health report or failure', (field) => {
    const probe = { ...check('older-success', 'pass', { [field]: 'successful probe', extra: { empty: null } }), futureField: ['unchanged'] };
    const report = unpack(compactDebugLogExport(event({ kind: 'check', sessionId, check: probe })));
    expect(report.partial).toBe(true);
    expect(details(report.checks)).toEqual([{ ...probe, journalLogPrefix: '2026-10-12T07:12:21.717Z [WARN ]' }]);
    expect(report.checks.detailGroups[0].checkIndexes).toEqual([0]);
    expect(report.checkLocations.rows).toEqual([['older-success', 1, '2026-10-12T07:12:21.717Z [WARN ]']]);
  },
);

it('retains structured future probes in fallback reports and all duplicate journal variants', () => {
  const first = check('same-step', 'pass', { readinessEvidence: { futureSchema: true, visible: 0 } });
  const second = check('same-step', 'warn', { nonTimingFailure: false, actionCompleted: true,
    readinessEvidence: { futureSchema: true, visible: 4 } });
  const report = unpack(compactDebugLogExport([
    event({ kind: 'check', sessionId, check: first }), event({ kind: 'check', sessionId, check: second }),
    event({ kind: 'report-fallback', sessionId, report: { sessionId, partial: true, checks: [second] } }),
  ].join('\n')));
  expect(report.duplicateJournalIds).toEqual(['same-step']);
  expect(details(report.duplicateJournalChecks)).toEqual([first, second].map(value => ({ ...value,
    journalLogPrefix: '2026-10-12T07:12:21.717Z [WARN ]' })));
  expect(details(report.journalEvents[0].report.checks)).toEqual([second]);
});

it('keeps interleaved journal retries in source order for partial, additional and duplicate checks', () => {
  const checks = [check('A', 'pass', { readinessEvidence: 'A first' }),
    check('B', 'pass', { readinessEvidence: 'B first' }),
    check('A', 'warn', { readinessEvidence: 'A retry' }),
    check('B', 'warn', { readinessEvidence: 'B retry' })];
  const lines = checks.map((value, i) => event({ kind: 'check', sessionId, check: value }, `2026-10-12T07:00:0${i}Z`));
  const expected = checks.map((value, i) => ({ ...value, journalLogPrefix: `2026-10-12T07:00:0${i}Z [WARN ]` }));
  const orderedDetails = (summary: any) => summary.detailGroups.flatMap((group: any) => details({ detailGroups: [group] })
    .map((value: unknown, i: number) => ({ index: group.checkIndexes[i], value })))
    .sort((a: any, b: any) => a.index - b.index).map((entry: any) => entry.value);
  const partial = unpack(compactDebugLogExport(lines.join('\n')));
  const saved = unpack(compactDebugLogExport([...lines, JSON.stringify({ sessionId, checks: [] })].join('\n')));
  expect(orderedDetails(partial.checks)).toEqual(expected);
  expect(orderedDetails(saved.additionalJournalChecks)).toEqual(expected);
  for (const report of [partial, saved]) {
    expect(orderedDetails(report.duplicateJournalChecks)).toEqual(expected);
    expect(report.checkLocations.rows).toEqual(checks.map((value, i) => [value.id, i + 1, expected[i].journalLogPrefix]));
  }
});
