import { uiConditionalRateFacts, uiConditionTag, uiEvidenceFact, uiEvidenceStatus } from '../src/lib/financialUiCopy';
import { rateConditionalFacts } from '../src/data/rateConditionalFacts';
import { displayEvidenceFacts } from '../src/data/displayEvidenceFacts';
import { uiDetailItem, uiNormalizedProductFact, uiFeeValue } from '../src/lib/productUiFacts';
import { uiTermRevisionValue } from '../src/lib/productTermsUiFacts';
import { scopedRateConditions } from '../src/data/rateConditions';
import { scopedFinancialConditionFacts } from '../src/data/scopedFinancialConditionFacts';
import { selectedConstraintFixture } from '../testUtils/selectedTargetConstraints';
import { formatRunDate, humanizeEnum } from '../src/data/format';
import { uiCustomerAnswer, uiInputDefinitionLabel, uiNegotiatedTermField } from '../src/lib/uiCopy';
import type { RateRow } from '../src/types';
import type { TermRevision } from '../src/data/productTerms';
import type { CustomerAnswer, InputDefinition, NegotiatedTerm } from '../src/data/customerProfile';
const loan: RateRow = { provider: 'Maitland Mutual Limited', product_name: 'Budget Home Loan', product_key: 'maitland-budget', rate: '0.0579', rate_index: 4, lvr_tier: 'lvr_=60%' };
const privateProvenance = { source: 'user_input' as const, recordedAt: '2026-10-14T01:00:00Z', productKey: 'loan', effectiveFrom: null, effectiveToExclusive: null };
test('actual publication admission distinguishes equal normalized Maitland rows with exact source bounds', () => {
  const publication = selectedConstraintFixture('Mortgage', [loan, { ...loan, rate_index: 5 }], [{ rateIndex: 4, text: 'LVR up to 59.99%.' }, { rateIndex: 5, text: 'For LVR 60% to 79.99%.' }]);
  const models = publication.rows.map(row => scopedFinancialConditionFacts(scopedRateConditions(row, 'Mortgage', publication)));
  expect(models.map(model => model.facts.map(uiConditionTag))).toEqual([['LVR ≤59.99%'], ['LVR 60%–79.99%']]);
  expect(models[0].facts[0].source.rateIndex).toBe(4); expect(models[1].facts[0].source.rateIndex).toBe(5);
  const stale = scopedFinancialConditionFacts(scopedRateConditions(publication.rows[0], 'Mortgage', { ...publication, manifest: null }));
  expect(stale.state).toBe('unverified'); expect(stale.facts).toEqual([]);
});
test('bonus unknown does not invent a lower ongoing rate; zero and known intro duration are preserved', () => {
  expect(uiConditionalRateFacts(rateConditionalFacts({ ribbon_deposit_kind: 'bonus' }, 'Savings'))).toBe('Bonus rate · Conditions required · Ongoing rate: Unknown');
  expect(uiConditionalRateFacts(rateConditionalFacts({ ribbon_deposit_kind: 'intro', term: 'P6M', ongoing_rate: '0' }, 'Savings'))).toBe('Introductory · Introductory period: 6 months · Ongoing rate: 0.00%');
});
test('malicious reasons remain closed statuses while actual bank, coverage, counts and observed date survive', () => {
  const model = displayEvidenceFacts({ source: 'remote', offline: false, assetStatus: 'partial', assetReason: 'BUY NOW. Read our detailed explanation.', runDate: '2026-10-14', now: new Date('2026-10-14T03:00:00Z'),
    coverage: { providers_attempted: 3, providers_succeeded: 2, observed_on: '2026-10-14', counts: { providers_partial: 1, providers_failed: 0 }, provider_failures: [{ provider: 'Example Bank', status: 'partial', reason: 'Explanatory source paragraph.' }], limitations: ['Unbounded source paragraph.'] } });
  const rendered = model.facts.map(uiEvidenceFact); expect(uiEvidenceStatus(model)).toBe('Partial');
  expect(rendered).toContainEqual({ label: 'Bank', value: 'Example Bank · Partial' });
  expect(rendered).toContainEqual({ label: 'Observed', value: '14 Oct 2026' });
  expect(rendered).toContainEqual({ label: 'Providers attempted', value: '3' });
  expect(JSON.stringify(rendered)).not.toMatch(/BUY NOW|paragraph|explanation/);
});
test('unreported counts and invalid observed dates remain Unknown', () => {
  const facts = displayEvidenceFacts({ source: 'cache', offline: true, runDate: '2026-02-30' }).facts.map(uiEvidenceFact);
  expect(facts).toContainEqual({ label: 'Observed', value: 'Unknown' }); expect(facts).toContainEqual({ label: 'Failed providers', value: 'Unknown' });
});
test('unrecognized payload prose cannot become an enum label or date', () => {
  expect(humanizeEnum('This account includes wonderful benefits.')).toBe('Unknown'); expect(humanizeEnum('OTHER_TYPE')).toBe('OTHER_TYPE');
  expect(formatRunDate('Please read this explanation.')).toBe('Unknown'); expect(formatRunDate('2026-02-30')).toBe('Unknown');
});
test('fee zero, rate-based fees and variable published bounds survive without descriptions', () => {
  expect(uiFeeValue({ amount: '0', amountStatus: 'fixed' })).toBe('$0');
  expect(uiFeeValue({ rateBased: { rate: '0.01', rateType: 'BALANCE', accrualFrequency: 'P1M' } })).toBe('1.00% · BALANCE · per month');
  expect(uiFeeValue({ amountStatus: 'variable', variable: { feeMinimum: '100', feeMaximum: '200' } })).toBe('$100–$200');
  expect(uiFeeValue({ value: 'Contact us and we will give you a quote.' })).toBe('Unknown');
  expect(uiFeeValue({ value: '1,,2' })).toBe('Unknown');
});
test('normalized source paragraphs never render as facts; numbers and applicable enums do', () => {
  const fact = uiNormalizedProductFact({ id: 'fact-1', kind: 'constraint', canonicalKey: 'constraint.MIN_BALANCE', label: 'Amazing paragraph here.', value: '100', unit: 'AUD', condition: 'Customer eligibility must be investigated.', appliesTo: ['OWNER_OCCUPIED'] });
  expect(fact.value).toBe('$100'); expect(fact.conditions).toBe('source-review-required'); expect(fact.scope).toEqual(['Owner occupied']); expect(fact.label).not.toContain('Amazing');
  expect(uiDetailItem({ label: 'MIN_LIMIT', value: '$150,000' }, 0, 'Constraints').value).toBe('$150,000');
});
test('validated term decimals remain exact and unrecognized complex/source text is explicit', () => {
  const revision = { value: '123456789.123456789012345678', unit: 'AUD' } as TermRevision;
  expect(uiTermRevisionValue(revision)).toBe('$123456789.123456789012345678');
  expect(uiTermRevisionValue({ ...revision, value: 'Explanatory source text' })).toBe('Source review required');
  expect(uiTermRevisionValue({ ...revision, value: { note: 'dynamic explanation' } })).toBe('Source review required');
});
test('private answer boundaries admit explicit authored text, reject legacy prose and validate definition labels', () => {
  const definition: InputDefinition = { id: 'agreement', label: 'Term', type: 'text' };
  const answer: CustomerAnswer = { state: 'known', fact: { type: 'text', value: 'Agreed fixed rate' }, provenance: privateProvenance };
  expect(uiCustomerAnswer(answer, definition)).toBe('Agreed fixed rate');
  expect(uiCustomerAnswer({ ...answer, provenance: { ...privateProvenance, source: 'legacy_user_input' } }, definition)).toBe('Source review required');
  expect(uiCustomerAnswer({ ...answer, fact: { type: 'text', value: 'First paragraph\nSecond paragraph' } }, definition)).toBe('Source review required');
  expect(uiInputDefinitionLabel(definition)).toBe('Term'); expect(uiInputDefinitionLabel({ ...definition, label: 'Explanatory source paragraph.' })).toBe('Source review required');
});
test('private negotiated facts exclude notes and fail closed outside user provenance', () => {
  const term: NegotiatedTerm = { id: 'user.1', label: 'Fixed rate', value: '5.25', unit: '%', note: 'This note must never render.', provenance: privateProvenance };
  expect(uiNegotiatedTermField(term, 'value')).toBe('5.25'); expect(uiNegotiatedTermField({ ...term, label: 'Paragraph\nMore' }, 'label')).toBe('Source review required');
});
test('private numeric answers retain exact decimal amounts, percentages and durations', () => {
  const fact = { type: 'decimal' as const, value: '123456789.123456789012345678', unit: 'AUD' };
  const answer: CustomerAnswer = { state: 'known', fact, provenance: privateProvenance };
  const definition: InputDefinition = { id: 'amount', label: 'Balance', type: 'decimal', unit: 'AUD' };
  expect(uiCustomerAnswer(answer, definition)).toBe('$123456789.123456789012345678');
  expect(uiCustomerAnswer({ ...answer, fact: { ...fact, value: '0.03123456789012345678', unit: 'fraction' } }, { ...definition, unit: 'fraction' })).toBe('3.12345678901234567800%');
  expect(uiCustomerAnswer({ ...answer, fact: { ...fact, value: '12.000000000000000001', unit: 'months' } }, { ...definition, unit: 'months' })).toBe('12.000000000000000001 months');
});
