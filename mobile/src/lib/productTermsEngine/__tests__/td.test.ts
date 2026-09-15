import { example } from '../testSupport';
import { calculateLedger } from '../ledger';
import { nextTdBusinessDay } from '../tdSchedule';
import { EVALUATOR_VERSION, SAVINGS_EVALUATOR_VERSION } from '../types';
import { hashText } from '../validation';

/** Modeled arithmetic from captured source patterns, not an approved bank/product fixture. */
function tdExample(legacy = false) {
  const { contract: c, scenario: s } = example();
  const quote = 'Daily Closing Balance';
  c.evidence = [{ id: 'td-source', clauseId: '1.2', documentSha256: legacy ? '68bd10a6052de286d0ac15cb42e4fbb40d61236751e0e6d847b44dee938140df' : 'edede719bfadde17f6dbfa6e6a2c01cc35f912d1fe2734ad9db420153f1a8e2d',
    sourceUrl: legacy ? 'https://www.macquarie.com.au/digital-banking/term-deposit-account-terms-and-conditions.html' : 'https://www.macquarie.com.au/digital-banking/digital-term-deposit-account-terms-and-conditions.html',
    locator: '1.2; local captured full terms, modeled arithmetic only', quote, quoteSha256: hashText(quote) }];
  c.dependencyIds = c.evidence.map(e => e.documentSha256);
  c.direction = 'asset'; c.initialAnnualRate = '0.01'; c.initialRateEvidenceIds = ['td-source'];
  c.interest = { ...c.interest, offset: 'none', postingDates: [], dailyAccrualScale: null, evidenceIds: ['td-source'] };
  c.applicability = { cohortKey: 'modeled-td', from: '2024-01-01', toExclusive: '2027-01-01' };
  c.tdLifecycle = { schemaVersion: 1, mode: legacy ? 'legacy_noncompounding' : 'digital_notice_no_interest', cohortKey: 'modeled-td',
    evidenceIds: ['td-source'], confirmationEvidenceIds: ['td-source'], investmentAmount: '36500', fundedDate: '2026-01-01', accrualStartDate: '2026-01-01',
    term: { unit: 'days', count: 100, monthConvention: 'clamp' }, nominalMaturityDate: '2026-04-11',
    calendar: legacy ? { id: 'modeled-calendar', accountAllocatedState: 'TAS', from: '2026-01-01', toExclusive: '2027-01-01', holidays: [], evidenceIds: ['td-source'] } : null,
    roundingReviewed: true, taxTreatment: 'none_confirmed', payments: { cadence: 'maturity', destination: 'linked_account', firstPeriodEnd: null, monthConvention: 'clamp', periodEnds: [], evidenceIds: ['td-source'] },
    closure: { kind: 'early_notice', acceptedNoticeDate: '2026-03-01', confirmedDate: '2026-04-10', feeDecision: legacy ? 'charge_25_percent' : 'waived', principalRecovery: 'confirmed_if_required', evidenceIds: ['td-source'] } };
  s.startDate = '2026-01-01'; s.endDateExclusive = '2026-04-11'; s.cohortKey = 'modeled-td'; s.openingBalance = '36500'; s.initialOffset = '0';
  return { c, s, td: c.tdLifecycle };
}
test('Digital funded day accrues, accepted notice day and entire notice period do not', () => {
  const { c, s } = tdExample(); const r = calculateLedger(c, s);
  expect(r.totals?.interestAccrued).toBe('59.000000000000');
  expect(r.totals?.externalOutflows).toBe('36559.00'); expect(r.totals?.closingBalance).toBe('0.00');
  expect(r.ledger.some(e => e.type === 'interest_accrual' && e.date >= '2026-03-01')).toBe(false);
  expect(r.claimAvailable).toBe(false); // Captured clause evidence is not whole-product approval.
});
test('Digital leap year uses365 and excludes maturity day', () => {
  const { c, s, td } = tdExample(); td.fundedDate = td.accrualStartDate = s.startDate = '2024-02-28';
  td.term.count = 2; td.nominalMaturityDate = '2024-03-01';
  td.closure = { ...td.closure, kind: 'maturity', acceptedNoticeDate: null, confirmedDate: '2024-03-01' }; s.endDateExclusive = '2024-03-02';
  expect(calculateLedger(c, s).totals?.interestAccrued).toBe('2.000000000000');
});
test('legacy interim credited interest does not compound; fee can recover principal', () => {
  const { c, s, td } = tdExample(true);
  td.payments = { cadence: 'monthly', destination: 'linked_account', firstPeriodEnd: '2026-01-31', monthConvention: 'preserve_month_end', periodEnds: ['2026-01-31', '2026-02-28', '2026-03-31'], evidenceIds: ['td-source'] };
  const r = calculateLedger(c, s);
  expect(r.totals?.interestAccrued).toBe('99.000000000000'); expect(r.totals?.feesCharged).toBe('24.75');
  expect(r.ledger.find(e => e.id === 'td:closure')?.amount).toBe('-36485.25');
  expect(r.totals?.externalOutflows).toBe('36574.25');
});
test('source calendar shifts weekend and holiday; absent coverage never guesses', () => {
  const { td } = tdExample(true); td.calendar!.holidays = ['2026-04-13'];
  expect(nextTdBusinessDay('2026-04-11', td.calendar)).toBe('2026-04-14');
  td.calendar!.toExclusive = '2026-04-14'; expect(nextTdBusinessDay('2026-04-11', td.calendar)).toBeNull();
});
test.each(['calendar', 'rounding', 'tax', 'fee'] as const)('unknown %s leaves settlement null, not zero', key => {
  const { c, s, td } = tdExample(true);
  if (key === 'calendar') td.calendar = null;
  if (key === 'rounding') td.roundingReviewed = false;
  if (key === 'tax') td.taxTreatment = 'unknown';
  if (key === 'fee') td.closure.feeDecision = 'unknown';
  const r = calculateLedger(c, s); expect(r.status).toBe('incomplete'); expect(r.totals).toBeNull(); expect(r.claimAvailable).toBe(false);
});
test('scenario cannot move contract closure or inject its own payout', () => {
  const { c, s } = tdExample(); s.endDateExclusive = '2026-04-12';
  expect(calculateLedger(c, s).issues).toContain('td_horizon_must_include_exact_closure');
  s.endDateExclusive = '2026-04-11'; s.events = [{ id: 'fake', date: '2026-04-10', order: 0, type: 'cashflow', delta: '1', label: 'fake' }];
  expect(calculateLedger(c, s).issues).toContain('td_mixed_scenario_unsupported');
});
test('final31-day rule, Digital legacy policy mixing, old evaluators reject TD', () => {
  const { c, s, td } = tdExample(); td.closure.acceptedNoticeDate = '2026-04-01';
  expect(calculateLedger(c, s).issues).toContain('td_notice_inside_final_period');
  td.closure.acceptedNoticeDate = '2026-03-01'; td.closure.feeDecision = 'charge_25_percent';
  expect(calculateLedger(c, s).issues).toContain('td_digital_legacy_policy_conflict');
  td.closure.feeDecision = 'waived'; c.evaluatorVersion = SAVINGS_EVALUATOR_VERSION;
  expect(calculateLedger(c, s).issues).toContain('contract_version_unsupported');
  c.evaluatorVersion = EVALUATOR_VERSION; expect(calculateLedger(c, s).evaluatorVersion).toBe(EVALUATOR_VERSION);
});
test.each(['hardship', 'rollover'] as const)('%s never invents timing or a future rate', kind => {
  const { c, s, td } = tdExample(); td.closure.kind = kind;
  const r = calculateLedger(c, s); expect(r.issues).toContain(`td_${kind}_unsupported`); expect(r.totals).toBeNull();
});
test('principal recovery requires its own confirmed decision when prior payments consume interest', () => {
  const { c, s, td } = tdExample(true);
  td.payments = { cadence: 'monthly', destination: 'linked_account', firstPeriodEnd: '2026-01-31', monthConvention: 'preserve_month_end', periodEnds: ['2026-01-31', '2026-02-28', '2026-03-31'], evidenceIds: ['td-source'] };
  td.closure.principalRecovery = 'unknown';
  const r = calculateLedger(c, s); expect(r.issues).toContain('td_principal_recovery_decision_unknown'); expect(r.totals).toBeNull();
  expect(r.ledger.some(e => e.id === 'td:closure')).toBe(false);
});
test('complete declared cadence rejects a missing installment; zero fee is explicit', () => {
  const { c, s, td } = tdExample(true);
  td.payments = { cadence: 'monthly', destination: 'linked_account', firstPeriodEnd: '2026-01-31', monthConvention: 'preserve_month_end', periodEnds: ['2026-01-31', '2026-03-31'], evidenceIds: ['td-source'] };
  expect(calculateLedger(c, s).issues).toContain('td_payment_cadence_incomplete');
  td.payments.periodEnds.splice(1, 0, '2026-02-28'); td.closure.feeDecision = 'waived';
  expect(calculateLedger(c, s).totals?.feesCharged).toBe('0.00');
});
test('legacy interest retained in the deposit stays noncompounding and available for the fee', () => {
  const { c, s, td } = tdExample(true);
  td.payments = { cadence: 'monthly', destination: 'term_deposit', firstPeriodEnd: '2026-01-31', monthConvention: 'preserve_month_end', periodEnds: ['2026-01-31', '2026-02-28', '2026-03-31'], evidenceIds: ['td-source'] };
  td.closure.principalRecovery = 'unknown'; // Not needed: retained interest covers the fee.
  const r = calculateLedger(c, s);
  expect(r.totals?.interestAccrued).toBe('99.000000000000'); expect(r.totals?.externalOutflows).toBe('36574.25');
  expect(r.ledger.filter(e => e.type === 'cashflow')).toHaveLength(1);
  td.payments.destination = 'unknown'; expect(calculateLedger(c, s).totals).toBeNull();
});
test('exact31-day notice and month-end term convention are explicit, not a12month fallback', () => {
  const { c, s, td } = tdExample(); td.closure.acceptedNoticeDate = '2026-03-11'; td.closure.confirmedDate = '2026-04-11'; s.endDateExclusive = '2026-04-12';
  expect(calculateLedger(c, s).totals?.interestAccrued).toBe('69.000000000000');
  td.closure.acceptedNoticeDate = '2026-03-12'; expect(calculateLedger(c, s).issues).toContain('td_notice_inside_final_period');
  td.term.count = 0; expect(calculateLedger(c, s).issues).toContain('td_term_invalid');
});
test('changed confirmed rate changes receipt identity; v2 flat inputs retain old semantics', () => {
  const { c, s } = tdExample(); const original = calculateLedger(c, s);
  c.initialAnnualRate = '0.02'; const changed = calculateLedger(c, s);
  expect(changed.inputSha256).not.toBe(original.inputSha256); expect(changed.totals?.interestAccrued).toBe('118.000000000000');
  const previous = example(); previous.contract.evaluatorVersion = SAVINGS_EVALUATOR_VERSION;
  expect(calculateLedger(previous.contract, previous.scenario).totals).not.toBeNull();
});
test('confirmed investment amount cannot be changed in the scenario', () => {
  const { c, s } = tdExample(); s.openingBalance = '36501';
  expect(calculateLedger(c, s).issues).toContain('td_confirmed_investment_amount_mismatch');
});
test('legacy break fee cannot be charged on resolved maturity', () => {
  const { c, s, td } = tdExample(true); td.closure.confirmedDate = '2026-04-13'; s.endDateExclusive = '2026-04-14';
  expect(calculateLedger(c, s).issues).toContain('td_break_fee_not_before_maturity');
  td.closure.feeDecision = 'waived'; expect(calculateLedger(c, s).totals?.feesCharged).toBe('0.00');
});
test('annual cadence enforces a complete source-defined12-month schedule', () => {
  const { c, s, td } = tdExample(true);
  td.term = { unit: 'months', count: 24, monthConvention: 'clamp' }; td.nominalMaturityDate = '2028-01-01';
  td.calendar!.toExclusive = '2028-02-01';
  td.payments = { cadence: 'annual', destination: 'term_deposit', firstPeriodEnd: '2027-01-01', monthConvention: 'clamp', periodEnds: ['2027-01-01'], evidenceIds: ['td-source'] };
  td.closure = { ...td.closure, kind: 'maturity', acceptedNoticeDate: null, confirmedDate: '2028-01-03', feeDecision: 'waived' }; s.endDateExclusive = '2028-01-04';
  expect(calculateLedger(c, s).totals?.interestAccrued).toBe('732.000000000000');
  td.payments.periodEnds = []; expect(calculateLedger(c, s).issues).toContain('td_payment_cadence_incomplete');
});
