import { bankResponseCoverage, evaluateBankResponseCoverage } from '../src/lib/appHealth/bankResponseCoverage';
import { publicBankResponseCoverage } from '../src/lib/appHealth/publicBankResponseCoverage';
import { buildCompactBankResponseWindows } from '../src/data/bankResponseModel';
import { uiBankResponseReason } from '../src/lib/chartUiCopy';
import { passiveAuditCheckKey } from '../src/lib/passiveAuditCache';
import { APP_HEALTH_CHECK_CODES, APP_HEALTH_EXPECTED_CHECK_IDS } from '../src/lib/appHealth/types';
import { toPublicAppHealthReport, finalizeAppHealthReport } from '../src/lib/appHealth/report';
import type { BankInsightsPayload } from '../src/data/bankInsightsTypes';
import type { RbaCalendar } from '../src/data/rbaCalendar';
import type { CorePayload } from '../src/types';
import { bankHistoryPairKey } from '../src/data/sectionIntegrity';
import { normalizeBankInsightsPayload } from '../src/data/bankInsights';

function fixture() {
  const series = { median: [0.04, 0.04, 0.04, 0.04], best: [0.045, 0.045, 0.045, 0.045], count: [2, 2, 2, 2] };
  const source: BankInsightsPayload = { schema_version: 1, run_date: '2026-11-05',
    run_dates: ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'],
    banks: { 'Private Bank': { Savings: series, Mortgage: series, TD: series } }, events: [], eventLedgerComplete: true };
  const calendar: RbaCalendar = { timezone: 'Australia/Sydney', schedule: [], decisions: [
    { date: '2026-11-03', effective: null, rate: 4.85, delta_bps: 25, outcome: 'hike' },
    { date: '2026-11-05', effective: null, rate: 4.85, delta_bps: 0, outcome: 'hold' },
  ] };
  const core = { run_date: source.run_date, sections: { Mortgage: { rates: [] }, Savings: { rates: [] }, TD: { rates: [] } } } as unknown as CorePayload;
  return { source, calendar, core, snapshot: { source: 'cache' as const, core, manifest: null } };
}

test('the declared audit includes exhaustive bank response evidence for every section and decision, including holds', () => {
  const f = fixture();
  const coverage = bankResponseCoverage(f.source, f.source, f.calendar, f.core)!;
  expect(APP_HEALTH_EXPECTED_CHECK_IDS).toContain(APP_HEALTH_CHECK_CODES.BANK_RESPONSE_COVERAGE);
  expect(coverage.rows).toHaveLength(6);
  expect(coverage.windows).toBe(2); // Unique RBA windows, with all three sections retained.
  expect(coverage.rows.every(row => row.displayReason === 'no-recorded-move')).toBe(true);
  const check = evaluateBankResponseCoverage({ ...f.snapshot, bankResponseCoverage: coverage });
  expect(check).toMatchObject({ status: 'pass', metrics: { checked: 6, noRecordedMove: 6, knownMoves: 0,
    unknownMoves: 0, unknownTiming: 0, coverageComplete: true, renderedCoverageVerified: false } });
  const row = buildCompactBankResponseWindows(f.source, f.calendar, 'Savings')[0].rows[0];
  expect(row.movePp).toBeNull(); // Absence of an event is never invented as a zero move.
  expect(uiBankResponseReason(row.evidence.reason)).toBe('No recorded move');
});

test('filtered snapshots retain the source cause and warn instead of passing a loaded list', () => {
  const f = fixture();
  f.source.events.push({ date: '2026-11-04', provider: 'Private Bank', section: 'Savings', dir: 'hike', moved: 1, total: 2, avg_bps: 25 });
  const projected = { ...f.source, events: [], banks: { 'Private Bank': { Savings: {
    median: [null, null, null, 0.04], best: [null, null, null, 0.045], count: [null, null, null, 1],
  } } } };
  const evidence = bankResponseCoverage(f.source, projected, f.calendar, f.core)!;
  expect(evidence.rows.find(row => row.section === 'Savings' && row.decisionDate === '2026-11-03'))
    .toMatchObject({ sourceReason: 'recorded-move', displayReason: 'filtered-history', moveKnown: false });
  expect(evaluateBankResponseCoverage({ ...f.snapshot, bankResponseCoverage: evidence }))
    .toMatchObject({ status: 'warn', metrics: { coverageComplete: false, filteredHistory: 6 } });
  expect(buildCompactBankResponseWindows(projected, f.calendar, 'Savings', f.source)[0].rows[0].evidence.reason)
    .toBe('filtered-history');
});

test('missing baseline, missing daily observations and absent banks stay distinct; a later event is not verified as the first', () => {
  const f = fixture();
  f.source.banks['Private Bank'].Savings!.count[0] = null;
  f.source.banks.Gap = { Savings: { median: [0.04, null, 0.04, 0.04], best: [0.04, null, 0.04, 0.04], count: [1, null, 1, 1] } };
  f.source.banks.Absent = { Savings: { median: [null, null, null, null], best: [null, null, null, null], count: [null, null, null, null] } };
  f.source.events.push({ date: '2026-11-04', provider: 'Gap', section: 'Savings', dir: 'hike', moved: 1, total: 1, avg_bps: 25 });
  const rows = bankResponseCoverage(f.source, f.source, f.calendar, f.core)!.rows.filter(row => row.decisionDate === '2026-11-03');
  expect(rows.find(row => row.provider === 'Private Bank' && row.section === 'Savings')).toMatchObject({ displayReason: 'missing-baseline' });
  expect(rows.find(row => row.provider === 'Gap')).toMatchObject({ displayReason: 'history-gap', missingDays: 1, moveKnown: true, firstMoveVerified: false });
  expect(rows.find(row => row.provider === 'Absent')).toMatchObject({ displayReason: 'missing-history', displayed: false });
});

test('stale assets fail and unloaded calendar/source never become a zero-gap pass', () => {
  const f = fixture();
  expect(bankResponseCoverage(f.source, f.source, null, f.core)).toBeNull();
  expect(evaluateBankResponseCoverage(f.snapshot)).toMatchObject({ status: 'unavailable', metrics: { coverageComplete: false } });
  f.core.run_date = '2026-11-06';
  expect(evaluateBankResponseCoverage({ ...f.snapshot, bankResponseCoverage: bankResponseCoverage(f.source, f.source, f.calendar, f.core) }))
    .toMatchObject({ status: 'fail', metrics: { runMatches: false, coverageComplete: false } });
});

test.each([undefined, {}, [{ provider: 'Private Bank', date: 'invalid' }]])('normalization retains incomplete event-ledger evidence for %j', events => {
  const f = fixture();
  const normalized = normalizeBankInsightsPayload({ ...f.source, events })!;
  expect(normalized.eventLedgerComplete).toBe(false);
  const cached = normalizeBankInsightsPayload(JSON.parse(JSON.stringify(normalized)), { fromCache: true })!;
  expect(cached.eventLedgerComplete).toBe(false);
  const check = evaluateBankResponseCoverage({ ...f.snapshot,
    bankResponseCoverage: bankResponseCoverage(cached, cached, f.calendar, f.core) });
  expect(check).toMatchObject({ status: 'warn', metrics: { coverageComplete: false, unverifiedEvents: 6, noRecordedMove: 0 } });
});

test('legacy normalized caches cannot prove absent events, while validated source survives cache roundtrip', () => {
  const f = fixture();
  const legacy = { ...f.source, eventLedgerComplete: undefined };
  const cached = normalizeBankInsightsPayload(legacy, { fromCache: true })!;
  expect(cached.eventLedgerComplete).toBe(false);
  const source = normalizeBankInsightsPayload(legacy)!;
  expect(source.eventLedgerComplete).toBe(true);
  expect(normalizeBankInsightsPayload(JSON.parse(JSON.stringify(source)), { fromCache: true })!.eventLedgerComplete).toBe(true);
});

test.each([0, 1.5])('contradictory or fractional product counts cannot establish complete daily observations (%s)', count => {
  const f = fixture();
  f.source.banks['Private Bank'].Savings = { median: [0.04, 0.04, 0.04, 0.04], best: [0.04, 0.04, 0.04, 0.04], count: [count, count, count, count] };
  const check = evaluateBankResponseCoverage({ ...f.snapshot, bankResponseCoverage: bankResponseCoverage(f.source, f.source, f.calendar, f.core) });
  expect(check.metrics.coverageComplete).toBe(false);
  expect(check.metrics.noProducts).toBe(0);
});

test('quarantined history is distinct from selected-product exclusions', () => {
  const f = fixture();
  const evidence = bankResponseCoverage(f.source, { ...f.source, banks: {} }, f.calendar, f.core,
    new Set([bankHistoryPairKey('Private Bank', 'Savings')]))!;
  expect(evidence.rows.filter(row => row.section === 'Savings').every(row => row.displayReason === 'quarantined-history')).toBe(true);
  expect(evaluateBankResponseCoverage({ ...f.snapshot, bankResponseCoverage: evidence })).toMatchObject({
    status: 'warn', metrics: { quarantinedHistory: 2, filteredHistory: 4, coverageComplete: false },
  });
});

test('the passive cache changes with projected or source evidence on the same publication date', () => {
  const f = fixture();
  const snapshot = { ...f.snapshot, bankResponseCoverage: bankResponseCoverage(f.source, f.source, f.calendar, f.core) };
  const before = passiveAuditCheckKey(snapshot, '1', APP_HEALTH_CHECK_CODES.BANK_RESPONSE_COVERAGE);
  snapshot.bankResponseCoverage!.rows[0].displayReason = 'filtered-history';
  expect(passiveAuditCheckKey(snapshot, '1', APP_HEALTH_CHECK_CODES.BANK_RESPONSE_COVERAGE)).not.toBe(before);
});

test('removed source events remain filtered even when every projected daily observation remains available', () => {
  const f = fixture();
  f.source.events.push({ date: '2026-11-04', provider: 'Private Bank', section: 'Savings', dir: 'hike', moved: 1, total: 2, avg_bps: 25 });
  const projected = { ...f.source, events: [] };
  const coverage = bankResponseCoverage(f.source, projected, f.calendar, f.core)!;
  expect(coverage.rows.find(row => row.section === 'Savings' && row.decisionDate === '2026-11-03'))
    .toMatchObject({ sourceReason: 'recorded-move', displayReason: 'filtered-history', missingDays: 0, baselineAvailable: true, moveKnown: false });
  expect(evaluateBankResponseCoverage({ ...f.snapshot, bankResponseCoverage: coverage }).metrics.coverageComplete).toBe(false);
});

test('event-only providers retain the known move without claiming verified first-move history', () => {
  const f = fixture();
  f.source.events.push({ date: '2026-11-04', provider: 'Event Only', section: 'Savings', dir: 'hike', moved: 1, total: 1, avg_bps: 25 });
  const row = buildCompactBankResponseWindows(f.source, f.calendar, 'Savings')[1].rows.find(row => row.provider === 'Event Only');
  expect(row).toMatchObject({ movePp: 0.25, daysAfter: 1, evidence: { reason: 'missing-history', firstMoveVerified: false } });
  const coverage = bankResponseCoverage(f.source, f.source, f.calendar, f.core)!;
  expect(coverage.rows.find(row => row.provider === 'Event Only' && row.decisionDate === '2026-11-03'))
    .toMatchObject({ moveKnown: true, timingKnown: true, firstMoveVerified: false, displayReason: 'missing-history' });
});

test('public aliases survive bank insertion order and malformed complete claims remain invalid', () => {
  const f = fixture();
  f.source.banks.Other = f.source.banks['Private Bank'];
  const check = evaluateBankResponseCoverage({ ...f.snapshot, bankResponseCoverage: bankResponseCoverage(f.source, f.source, f.calendar, f.core) });
  const original = JSON.parse(publicBankResponseCoverage(check).bankResponseRows as string);
  const evidence = check.localEvidence!.bankResponseCoverage as ReturnType<typeof bankResponseCoverage>;
  const reordered = publicBankResponseCoverage({ ...check, localEvidence: { bankResponseCoverage: { ...evidence, rows: [...evidence!.rows].reverse() } } });
  expect(JSON.parse(reordered.bankResponseRows as string).reverse()).toEqual(original);
  expect(publicBankResponseCoverage({ ...check, metrics: { ...check.metrics, checked: 0 },
    localEvidence: { bankResponseCoverage: { ...evidence, rows: [] } } }).bankResponseEvidenceInvalid).toBe(true);
  expect(publicBankResponseCoverage({ ...check, localEvidence: { bankResponseCoverage: {
    ...evidence, rows: evidence!.rows.map(row => ({ ...row, missingDays: 1 })),
  } } }).bankResponseEvidenceInvalid).toBe(true);
});

test('public diagnostics keep every bank/window cause with stable aliases and reject malformed nested records', () => {
  const f = fixture();
  const check = evaluateBankResponseCoverage({ ...f.snapshot, bankResponseCoverage: bankResponseCoverage(f.source, f.source, f.calendar, f.core) });
  const report = finalizeAppHealthReport({ sessionId: 'private', mode: 'local', startedAt: '', finishedAt: '',
    checks: [check], plannedCheckIds: [check.id] });
  const exported = toPublicAppHealthReport(report);
  expect(JSON.stringify(exported)).not.toContain('Private Bank');
  const rows = JSON.parse(exported.checks[0].metrics.bankResponseRows as string);
  expect(rows).toHaveLength(6);
  expect(new Set(rows.map((row: { bank: string }) => row.bank)).size).toBe(1);
  expect(rows[0]).toMatchObject({ bank: 'bank-1', sourceReason: 'no-recorded-move', displayReason: 'no-recorded-move' });
  const malformed = publicBankResponseCoverage({ ...check, localEvidence: { bankResponseCoverage: { rows: [
    { provider: 'secret', section: 'private', sourceReason: 'private' }, 'private',
  ] } } });
  expect(malformed).toMatchObject({ bankResponseInvalidRows: 2, bankResponseEvidenceInvalid: true });
  expect(JSON.stringify(malformed)).not.toContain('private');
});
