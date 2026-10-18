import { PUBLIC_AS_OF, component, condition, programme } from '../testUtils/publicRates';
import { evaluatePublicCondition, resolvePublicRate } from '../src/data/publicRateResolver';
import { estimateEnteredRate, estimateReferenceAdjustment, selectPublicReference } from '../src/data/publicRateLocal';

it('uses explicit units and one public base minus a discount without magnitude guesses', () => {
  const source = programme({ components: [{ ...component('base', 'reference', '9.02'), unit: 'percentage_points' }, { ...component('discount', 'discount', '200'), unit: 'basis_points' }],
    formula: { op: 'subtract', operands: [{ op: 'component', componentId: 'base' }, { op: 'component', componentId: 'discount' }] } });
  expect(resolvePublicRate(source, {}, PUBLIC_AS_OF)).toMatchObject({ status: 'exact', payableRate: '0.0702', origin: 'publicly_calculated', verifiedCurrent: true });
  source.components[0].unit = 'fraction_per_annum';
  expect(resolvePublicRate(source, {}, PUBLIC_AS_OF).status).toBe('unresolved');
});

it('does not turn adjustments into payable rates or discount a published net rate again', () => {
  expect(resolvePublicRate(programme({ components: [component('net', 'discount', '0.02')] }), {}, PUBLIC_AS_OF).reasonCodes).toContain('adjustment_without_base');
  const net = component('net', 'payable', '0.06'), discount = { ...component('discount', 'discount', '0.02'), includedInPayable: true };
  expect(resolvePublicRate(programme({ components: [net, discount] }), {}, PUBLIC_AS_OF).payableRate).toBe('0.06');
  expect(resolvePublicRate(programme({ components: [net, discount], formula: { op: 'subtract', operands: [{ op: 'component', componentId: 'net' }, { op: 'component', componentId: 'discount' }] } }), {}, PUBLIC_AS_OF).status).toBe('unresolved');
});

it('requires exactly one known mutually exclusive alternative and matching component scope', () => {
  const source = programme({ formula: { op: 'alternatives', choices: [
    { conditions: [condition('package', { operator: 'eq', value: 'standard' })], formula: { op: 'component', componentId: 'net' } },
    { conditions: [condition('package', { conditionId: 'premium', operator: 'eq', value: 'premium' })], formula: { op: 'component', componentId: 'net' } },
  ] } });
  expect(resolvePublicRate(source, {}, PUBLIC_AS_OF).status).toBe('unresolved');
  expect(resolvePublicRate(source, { package: 'standard' }, PUBLIC_AS_OF).status).toBe('exact');
  source.components[0].scopeId = 'other-offer';
  expect(resolvePublicRate(source, { package: 'standard' }, PUBLIC_AS_OF).reasonCodes).toContain('component_scope_mismatch');
});

it('preserves open-ended LVR bounds and intersects the genuine product maximum', () => {
  const source = programme({ conditions: [condition('lvr', { operator: 'bounds', minimum: '0.8001' }), condition('lvr', { conditionId: 'product-maximum', operator: 'bounds', maximum: '0.95' })] });
  for (const lvr of ['0.8001', '0.85', '0.850001', '0.90', '0.95']) expect(resolvePublicRate(source, { lvr }, PUBLIC_AS_OF).status).toBe('exact');
  for (const lvr of ['0.8', '0.950001']) expect(resolvePublicRate(source, { lvr }, PUBLIC_AS_OF).status).toBe('unresolved');
  expect(resolvePublicRate(source, {}, PUBLIC_AS_OF).conditions.unknown).toHaveLength(2);
});

it('retains a lender-assessed range without converting it into an exact borrower rate', () => {
  const source = programme({ components: [component('minimum', 'payable', '0.0684'), component('maximum', 'payable', '0.0724')],
    conditions: [condition('customerCategory')], reasonCodes: ['lender_assessment_required'], formula: { op: 'range', minimum: { op: 'component', componentId: 'minimum' }, maximum: { op: 'component', componentId: 'maximum' } } });
  expect(resolvePublicRate(source, {}, PUBLIC_AS_OF)).toMatchObject({ status: 'range', minimumRate: '0.0684', maximumRate: '0.0724' });
  source.conditions.push(condition('purpose'));
  expect(resolvePublicRate(source, {}, PUBLIC_AS_OF).status).toBe('unresolved');
});

it('treats failures, stale checks and future effective prices explicitly', () => {
  const source = programme({ freshness: { state: 'failed', lastSuccessAt: PUBLIC_AS_OF, checkedAt: PUBLIC_AS_OF, reasonCodes: ['http_failure'] } });
  expect(resolvePublicRate(source, {}, PUBLIC_AS_OF)).toMatchObject({ status: 'unresolved', verifiedCurrent: false });
  expect(resolvePublicRate(source, { allowHistorical: true }, PUBLIC_AS_OF)).toMatchObject({ status: 'exact', payableRate: '0.06', verifiedCurrent: false });
  expect(resolvePublicRate(programme(), {}, '2026-10-16T00:00:00.001Z').freshness.state).toBe('stale');
  expect(resolvePublicRate(programme({ effectiveFrom: '2026-10-15' }), {}, PUBLIC_AS_OF).reasonCodes).toContain('programme_not_yet_effective');
});

it('resolves qualified savings, per-tier caps and introduction phases', () => {
  const source = programme({ section: 'Savings', components: [component('base', 'reference', '0.0001'), component('bonus', 'bonus', '0.0374')],
    conditions: [condition('monthlyDeposit', { operator: 'bounds', minimum: '10' }), condition('withdrawals', { operator: 'bounds', maximum: '0' })],
    formula: { op: 'add', operands: [{ op: 'component', componentId: 'base' }, { op: 'component', componentId: 'bonus' }] },
    phases: [{ phaseId: 'intro', startMonth: 0, endMonth: 3, formula: { op: 'add', operands: [{ op: 'component', componentId: 'base' }, { op: 'component', componentId: 'bonus' }] }, conditions: [], evidenceIds: ['public-source'] },
      { phaseId: 'ongoing', startMonth: 3, formula: { op: 'component', componentId: 'base' }, conditions: [], evidenceIds: ['public-source'] }] });
  expect(resolvePublicRate(source, {}, PUBLIC_AS_OF).status).toBe('unresolved');
  expect(resolvePublicRate(source, { monthlyDeposit: '10', withdrawals: '0' }, PUBLIC_AS_OF)).toMatchObject({ status: 'exact', payableRate: '0.0375', phases: [{ payableRate: '0.0375' }, { payableRate: '0.0001' }] });
  const tiers = programme({ section: 'Savings', components: [component('first', 'payable', '0.05'), component('excess', 'payable', '0.01')],
    formula: { op: 'tiered', field: 'balance', method: 'per_tier', tiers: [{ maximum: '1000', formula: { op: 'component', componentId: 'first' } }, { minimum: '1000', formula: { op: 'component', componentId: 'excess' } }] } });
  expect(resolvePublicRate(tiers, { balance: '2000' }, PUBLIC_AS_OF).payableRate).toBe('0.03');
  expect(resolvePublicRate(tiers, { balance: '3000' }, PUBLIC_AS_OF).reasonCodes).toContain('exact_rate_rational_rounded');
});

it('keeps local modes private in origin and replaces public discounts with one total adjustment', () => {
  const reference = { referenceId: 'reference', providerId: 'bank', name: 'Public indicator', value: '9.02', unit: 'percentage_points' as const, freshness: programme().freshness, evidenceIds: ['public-source'] };
  expect(estimateEnteredRate('0.4')).toMatchObject({ payableRate: '0.004', origin: 'user_entered', verifiedCurrent: false });
  expect(estimateEnteredRate(' .5 % ')).toMatchObject({ payableRate: '0.005', origin: 'user_entered' });
  expect(estimateEnteredRate('6%').payableRate).toBe('0.06');
  expect(estimateReferenceAdjustment(reference, '+.3', PUBLIC_AS_OF).payableRate).toBe('0.0932');
  expect(estimateReferenceAdjustment(reference, '-.5', PUBLIC_AS_OF).payableRate).toBe('0.0852');
  expect(estimateReferenceAdjustment(reference, '-2', PUBLIC_AS_OF)).toMatchObject({ payableRate: '0.0702', origin: 'locally_calculated', verifiedCurrent: false });
  expect(estimateReferenceAdjustment({ ...reference, value: undefined }, '-2', PUBLIC_AS_OF).status).toBe('unresolved');
  expect(evaluatePublicCondition(condition('qualification', { value: 'bonusMet' }), { bonusMet: false }, PUBLIC_AS_OF)).toBe('unmet');
});

it('requires reference package and fixed-period applicability even when historical pricing is selected', () => {
  const reference = { referenceId: 'fixed-reference', providerId: 'bank', name: 'Fixed package reference', value: '7', unit: 'percentage_points' as const,
    conditions: [condition('package', { operator: 'eq', value: 'premium' }), condition('termMonths', { operator: 'eq', value: '24' })],
    freshness: { ...programme().freshness, state: 'failed' as const }, evidenceIds: ['public-source'] };
  expect(estimateReferenceAdjustment(reference, '-1', PUBLIC_AS_OF, true)).toMatchObject({ status: 'unresolved', reasonCodes: ['reference_conditions_unknown'] });
  expect(estimateReferenceAdjustment(reference, '-1', PUBLIC_AS_OF, true, { package: 'standard', termMonths: '24' }).conditions.unmet).toHaveLength(1);
  expect(estimateReferenceAdjustment(reference, '-1', PUBLIC_AS_OF, true, { package: 'premium', termMonths: '24.0' })).toMatchObject({ status: 'exact', payableRate: '0.06', verifiedCurrent: false });
  expect(estimateReferenceAdjustment(reference, '-1', PUBLIC_AS_OF, false, { package: 'premium', termMonths: '24' }).status).toBe('unresolved');
});

it('selects dated reference versions exactly at the effective boundary without choosing the first or nearest rate', () => {
  const reference = { referenceId: 'reference', providerId: 'bank', name: 'Public reference', value: '8.65', unit: 'percentage_points' as const,
    effectiveFrom: '2026-10-08T13:00:00Z', effectiveTo: '2026-10-15T00:00:00Z', freshness: programme().freshness, evidenceIds: ['public-source'] };
  const future = { ...reference, value: '9.15', effectiveFrom: '2026-10-15T00:00:00Z', effectiveTo: undefined };
  expect(selectPublicReference([future, reference], 'reference', '2026-10-14T23:59:59.999Z').reference).toBe(reference);
  expect(selectPublicReference([reference, future], 'reference', '2026-10-15T00:00:00Z').reference).toBe(future);
  expect(estimateReferenceAdjustment(reference, '-2', '2026-10-15T00:00:00Z').reasonCodes).toContain('reference_effective_period_ended');
  expect(estimateReferenceAdjustment(future, '-2', '2026-10-15T00:00:00Z').payableRate).toBe('0.0715');
  expect(selectPublicReference([reference], 'reference', '2026-10-15T00:00:00Z')).toEqual({ reasonCodes: ['reference_effective_period_ended'] });
  expect(selectPublicReference([future], 'reference', PUBLIC_AS_OF)).toEqual({ reasonCodes: ['reference_not_yet_effective'] });
  expect(selectPublicReference([reference, { ...reference, value: '9.14' }], 'reference', PUBLIC_AS_OF)).toEqual({ reasonCodes: ['source_conflict'] });
  expect(selectPublicReference([reference], 'missing', PUBLIC_AS_OF)).toEqual({ reasonCodes: ['selected_reference_unavailable'] });
  expect(selectPublicReference([reference], 'reference', 'invalid')).toEqual({ reasonCodes: ['invalid_as_of'] });
  expect(selectPublicReference([{ ...reference, effectiveTo: '2026-10-07' }], 'reference', PUBLIC_AS_OF)).toEqual({ reasonCodes: ['reference_effective_period_invalid'] });
});

it('keeps comparison rates out of payable arithmetic and detects conflicting component identities', () => {
  const source = programme({ components: [component('net', 'payable', '0.06'), component('comparison', 'comparison', '0.08')] });
  expect(resolvePublicRate(source, {}, PUBLIC_AS_OF)).toMatchObject({ payableRate: '0.06', comparisonRate: '0.08' });
  source.formula = { op: 'component', componentId: 'comparison' };
  expect(resolvePublicRate(source, {}, PUBLIC_AS_OF).status).toBe('unresolved');
  source.formula = { op: 'component', componentId: 'net' }; source.components.push(component('net', 'payable', '0.07'));
  expect(resolvePublicRate(source, {}, PUBLIC_AS_OF).status).toBe('unresolved');
});

it('compares typed decimal predicates numerically and refuses a positive rate rounded to zero', () => {
  expect(evaluatePublicCondition(condition('amount', { operator: 'eq', value: '1000' }), { amount: '1000.00' }, PUBLIC_AS_OF)).toBe('met');
  const tiny = programme({ components: [{ ...component('net', 'payable', '0.000000000000000000000001'), unit: 'basis_points' }] });
  const result = resolvePublicRate(tiny, {}, PUBLIC_AS_OF);
  expect(result.reasonCodes).toContain('rate_precision_unsupported'); expect(result.payableRate).toBeUndefined();
});
