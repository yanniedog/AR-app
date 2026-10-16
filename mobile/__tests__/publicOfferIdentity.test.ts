import { legacyPublicOfferRefId, parsePublicOfferSelectionToken, publicOfferSelectionToken } from '../src/data/publicOfferIdentity';
import { resolveCompareSelections } from '../src/data/compareSelection';
import { makeSavedRateRef, normalizeSavedRates, toggleSavedRateRefs } from '../src/data/savedRates';
import { addSubscription, makeProductSubscription, normalizeProductSubscriptionIds } from '../src/data/subscriptions';
import { normalizeTrackedRates } from '../src/data/trackedRates';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import type { RateRow } from '../src/types';
import { core } from '../testUtils/publicRateJourney';

const row = (product_key: string, public_offer_id: string, rate_index = 0): RateRow => ({
  product_key, public_offer_id, rate_index, provider: 'Unit Bank', product_name: 'Unit Loan', rate: '0.05',
});
beforeEach(() => installMandatoryEligibility({ active: false, loading: false, rows: new WeakSet(), productKeys: new Set() }));

test('opaque semantic selection identities round-trip without delimiter collisions', () => {
  const ids = ['UNIT', 'A#B', 'B#UNIT', ':offer:', '["x"]', '\\"'];
  const tokens = ids.flatMap(productKey => ids.map(offerId => {
    const token = publicOfferSelectionToken(productKey, offerId);
    expect(parsePublicOfferSelectionToken(token)).toEqual({ productKey, offerId });
    return token;
  }));
  expect(new Set(tokens).size).toBe(ids.length ** 2);
});

test('distinct offers that collided in the old selection token resolve to their exact rows', () => {
  const rows = [row('UNIT', 'A#B'), row('B#UNIT', 'A', 1)];
  const source = core(rows);
  expect(resolveCompareSelections(source, rows.map(r => publicOfferSelectionToken(r.product_key, r.public_offer_id!)))
    .map(item => item.row)).toEqual(rows);
  expect(resolveCompareSelections(source, ['offer:A#B#UNIT'])).toEqual([]);
  expect(resolveCompareSelections(core([rows[0]]), ['offer:A#B#UNIT'])[0].row).toBe(rows[0]);
});

test.each(['offer-v2:{', 'offer-v2:[1,"UNIT"]', 'offer-v2:["A",""]', 'offer-v2:["A","UNIT",1]'])
('malformed versioned token %s cannot become a different selection', token => {
  expect(resolveCompareSelections(core([row('UNIT', 'A')]), [token])).toEqual([]);
});

test('colliding old Saved IDs retain both structured references and toggle independently', () => {
  const rows = [row('UNIT:offer:A', 'B'), row('UNIT', 'A:offer:B', 1)];
  const refs = rows.map(r => makeSavedRateRef(r));
  expect(new Set(refs.map(ref => ref.id)).size).toBe(2);
  const oldRefs = refs.map(ref => ({ ...ref, id: legacyPublicOfferRefId('rate', ref.productKey, ref.offerId!) }));
  expect(new Set(oldRefs.map(ref => ref.id)).size).toBe(1);
  expect(normalizeSavedRates(oldRefs)).toEqual(refs);
  const both = toggleSavedRateRefs(toggleSavedRateRefs([], rows[0]), rows[1]);
  expect(both.map(ref => ref.id)).toEqual(refs.map(ref => ref.id));
  expect(toggleSavedRateRefs(both, rows[0]).map(ref => ref.id)).toEqual([refs[1].id]);
});

test('persisted product alerts re-key from their fields before deduplication', () => {
  const subs = [makeProductSubscription(row('UNIT:offer:A', 'B'), 0), makeProductSubscription(row('UNIT', 'A:offer:B', 1), 1)];
  const old = subs.map(sub => ({ ...sub, id: legacyPublicOfferRefId('product', sub.productKey, sub.offerId!) }));
  expect(new Set(old.map(sub => sub.id)).size).toBe(1);
  expect(normalizeProductSubscriptionIds(old)).toEqual(subs);
  expect(addSubscription([subs[0]], subs[1])).toEqual(subs);
  expect(normalizeProductSubscriptionIds(subs)).toBe(subs);
});

test('a unique legacy private date migrates without moving or exposing its metadata', () => {
  const ref = makeSavedRateRef(row('UNIT', 'A#B'));
  const old = { id: legacyPublicOfferRefId('rate', ref.productKey, ref.offerId!), relevantDate: '2027-01-31', relevantDateKind: 'fixed-rate-end' };
  expect(normalizeTrackedRates([old], [ref])[0]).toMatchObject({ id: ref.id, relevantDate: '2027-01-31', relevantDateKind: 'fixed-rate-end' });
  expect(normalizeTrackedRates([{ ...old, productKey: 'OTHER' }], [ref])[0].relevantDate).toBeNull();
});

test('ambiguous legacy date IDs cannot copy one private date onto two different offers', () => {
  const refs = [makeSavedRateRef(row('UNIT:offer:A', 'B')), makeSavedRateRef(row('UNIT', 'A:offer:B', 1))];
  const old = { id: legacyPublicOfferRefId('rate', refs[0].productKey, refs[0].offerId!), relevantDate: '2027-01-31', relevantDateKind: 'fixed-rate-end' };
  expect(normalizeTrackedRates([old], refs).map(item => item.relevantDate)).toEqual([null, null]);
});
