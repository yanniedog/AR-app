import { resolvedRateNotificationChanges } from '../src/data/resolvedRateNotifications';
import { normalizeUserRateScenario } from '../src/data/userRateScenario';
import { normalizeProfileFilters } from '../src/data/profile';
import { makeProductSubscription, makeSearchSubscription } from '../src/data/subscriptions';
import { EMPTY_FILTERS } from '../src/data/selectors';
import { makeSavedRateRef } from '../src/data/savedRates';
import { bindCurrentPublicRow } from '../src/data/publicRateIntegration';
import { AS_OF, catalogue, core, product, programme, row } from '../testUtils/publicRateJourney';

it('keeps notification watches distinct when different products share an opaque offer ID', () => {
  const otherProduct = { ...product, productId: 'other-product', productKey: 'OTHER|LOAN', name: 'Other Loan', programmeIds: ['other-programme'] };
  const products = [product, otherProduct], other = programme({ productId: otherProduct.productId, programmeId: 'other-programme' });
  const before = [programme(), other], after = before.map(value => ({ ...value, components: [{ ...value.components[0], value: '0.0625' }] }));
  const previous = catalogue(before, products), current = catalogue(after, products);
  const rows = [row, { ...row, product_key: otherProduct.productKey, product_name: otherProduct.name }];
  const selected = rows.map(value => bindCurrentPublicRow(value, previous));
  const options = { previous, current, oldCore: core(rows), newCore: core(rows), saved: selected.map(value => makeSavedRateRef(value)),
    subscriptions: selected.map(value => makeProductSubscription(value, 0)), scenario: normalizeUserRateScenario({}),
    profile: normalizeProfileFilters({}), thresholdBps: 1, asOf: AS_OF };
  expect(resolvedRateNotificationChanges(options).map(message => message.productKey).sort()).toEqual(products.map(value => value.productKey).sort());
  expect(resolvedRateNotificationChanges({ ...options, subscriptions: [options.subscriptions[0]] }).map(message => message.productKey)).toEqual([product.productKey]);
});

it('uses semantic programme identities for alerts after reordering and describes public scenario pricing', () => {
  const previous = catalogue(), current = catalogue([programme({ sourceBindings: [{ rateIndex: 3, pointer: '/lendingRates/3' }],
    components: [{ ...programme().components[0], value: '0.0625' }] })]);
  const selected = bindCurrentPublicRow(row, previous);
  const messages = resolvedRateNotificationChanges({ previous, current, oldCore: core(), newCore: core([{ ...row, rate_index: 3 }]),
    saved: [makeSavedRateRef(selected)], subscriptions: [makeProductSubscription(selected, 0)],
    scenario: normalizeUserRateScenario({ mortgage: { currentRate: '8.374' } }), profile: normalizeProfileFilters({}), thresholdBps: 1, asOf: AS_OF });
  expect(messages).toHaveLength(1);
  expect(messages[0]).toMatchObject({ rateIndex: 3 });
  expect(messages[0].body).toContain('6.00% → 6.25%');
  expect(messages[0].body).toMatch(/selected public scenario.*charged rate: unverified/i);
  expect(messages[0].body).not.toContain('8.374');
});

it('suppresses unrelated, unresolved, stale, partially loaded and unconfirmed legacy-index alerts', () => {
  const previous = catalogue(), current = catalogue([programme({ offerId: 'other-offer', components: [{ ...programme().components[0], value: '0.04' }] })]);
  const selected = bindCurrentPublicRow(row, previous);
  const options = { previous, current, oldCore: core(), newCore: core(), saved: [], subscriptions: [makeProductSubscription(selected, 0)],
    scenario: normalizeUserRateScenario({}), profile: normalizeProfileFilters({}), thresholdBps: 1, asOf: AS_OF };
  expect(resolvedRateNotificationChanges(options)).toEqual([]);
  expect(resolvedRateNotificationChanges({ ...options, current: { ...current, allLoaded: false } })).toEqual([]);
  expect(resolvedRateNotificationChanges({ ...options, subscriptions: [makeProductSubscription(row, 0)] })).toEqual([]);
  const unknown = catalogue([programme({ components: [{ ...programme().components[0], value: '0.04' }],
    conditions: [{ conditionId: 'purpose', field: 'purpose', operator: 'eq', value: 'OWNER_OCCUPIED', evidenceIds: [] }] })]);
  expect(resolvedRateNotificationChanges({ ...options, current: unknown })).toEqual([]);
  const failed = catalogue([programme({ freshness: { state: 'failed', lastSuccessAt: AS_OF, reasonCodes: ['source_failed'] } })]);
  expect(resolvedRateNotificationChanges({ ...options, current: failed })).toEqual([]);
});

it('preserves saved-search alerts through the shared resolver without source-index false changes', () => {
  const previous = catalogue(), current = catalogue([programme({ sourceBindings: [{ rateIndex: 3, pointer: '/lendingRates/3' }],
    components: [{ ...programme().components[0], value: '0.0625' }] })]);
  const subscription = makeSearchSubscription({ section: 'Mortgage', path: [], hierarchyScoped: false, query: '',
    filters: { ...EMPTY_FILTERS, includeNonStandard: true } });
  const options = { previous, current, oldCore: core(), newCore: core([{ ...row, rate_index: 3 }]), saved: [], subscriptions: [subscription],
    scenario: normalizeUserRateScenario({ mortgage: { currentRate: '8.374', loanBalance: '487321' } }),
    profile: normalizeProfileFilters({}), thresholdBps: 1, asOf: AS_OF, mortgageRateMetric: 'headline' as const };
  const messages = resolvedRateNotificationChanges(options);
  expect(messages).toHaveLength(1);
  expect(messages[0].title).toBe('Search alert · Rate changed');
  expect(messages[0].body).toContain('6.00% → 6.25%');
  expect(messages[0].body).not.toContain('487321'); expect(messages[0].body).not.toContain('8.374');
  expect(messages[0].search?.subscriptionId).toBe(subscription.id);
  const unchanged = catalogue([programme({ sourceBindings: [{ rateIndex: 3, pointer: '/lendingRates/3' }] })]);
  expect(resolvedRateNotificationChanges({ ...options, current: unchanged })).toEqual([]);
  expect(resolvedRateNotificationChanges({ ...options, current: { ...current, allLoaded: false } })).toEqual([]);
});
