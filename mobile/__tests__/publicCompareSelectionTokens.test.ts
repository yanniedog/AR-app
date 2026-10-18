import { reconcilePublicCompareSelectionTokens } from '../src/data/publicCompareSelectionTokens';
import { catalogue, core, product, programme, row } from '../testUtils/publicRateJourney';
import { publicOfferSelectionToken } from '../src/data/publicOfferIdentity';

test('legacy occurrences and semantic aliases collapse to one current offer without losing unrelated selections', () => {
  const view = catalogue([programme({ sourceBindings: [{ rateIndex: 0, pointer: '/lendingRates/0' }, { rateIndex: 1, pointer: '/lendingRates/1' }] })]);
  const semantic = publicOfferSelectionToken(product.productKey, 'unit-offer');
  const tokens = [`0#${product.productKey}`, `1#${product.productKey}`, semantic, '99#missing'];
  expect(reconcilePublicCompareSelectionTokens(core([row, { ...row, rate_index: 1 }]), view, tokens))
    .toEqual([semantic, '99#missing']);
  expect(reconcilePublicCompareSelectionTokens(core(), { ...view, status: 'loading' }, tokens)).toEqual(tokens);
});

test('an ambiguous binding never invents a semantic selection', () => {
  const view = catalogue([programme(), programme({ programmeId: 'other', offerId: 'other' })]);
  expect(reconcilePublicCompareSelectionTokens(core(), view, [`0#${product.productKey}`]))
    .toEqual([`0#${product.productKey}`]);
});


test('stale semantic fields without a current catalogue binding do not upgrade a legacy token', () => {
  const stale = { ...row, public_programme_id: 'old', public_offer_id: 'old' };
  expect(reconcilePublicCompareSelectionTokens(core([stale]), catalogue(), [`0#${product.productKey}`]))
    .toEqual([`0#${product.productKey}`]);
});


test.each([false, true])('partial acquisition preserves the occurrence until the final binding is settled: ambiguous=%s', ambiguous => {
  const source = core();
  const first = programme();
  const legacy = [`0#${product.productKey}`];
  const partial = { ...catalogue([first]), allLoaded: false };
  // Other product routes can still supply a second binding. A choice made here
  // could not be reversed once the token had already become a semantic identity.
  const pending = reconcilePublicCompareSelectionTokens(source, partial, legacy);
  expect(pending).toEqual(legacy);
  const complete = catalogue(ambiguous ? [first, programme({ programmeId: 'later', offerId: 'later' })] : [first]);
  expect(reconcilePublicCompareSelectionTokens(source, complete, pending)).toEqual(ambiguous
    ? legacy : [publicOfferSelectionToken(product.productKey, first.offerId)]);
});
