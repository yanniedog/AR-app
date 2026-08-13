import { makeSavedRateRef, makeLegacySavedRateRef } from '../src/data/savedRates';
import {
  loadTrackedRatesSecure,
  makeTrackedRate,
  normalizeTrackedRates,
  saveTrackedRatesSecure,
  setTrackedRateDate,
} from '../src/data/trackedRates';
import * as SecureStore from 'expo-secure-store';
import type { RateRow } from '../src/types';

const row = (rateIndex = 7): RateRow => ({
  provider: 'Example Bank',
  product_key: 'EX|HOME',
  product_name: 'Variable home loan',
  rate_index: rateIndex,
  rate: '0.0599',
});

describe('tracked rate metadata', () => {
  it('migrates a saved exact tier without weakening its identity', () => {
    const saved = makeSavedRateRef(row(), 'rate', '2026-08-13T00:00:00.000Z');

    expect(normalizeTrackedRates(undefined, [saved])).toEqual([
      expect.objectContaining({
        schemaVersion: 1,
        id: 'rate:EX|HOME:7',
        scope: 'rate',
        productKey: 'EX|HOME',
        rateIndex: 7,
        observedRate: 0.0599,
        trackedAt: '2026-08-13T00:00:00.000Z',
      }),
    ]);
  });

  it('reconciles metadata to saved identities and drops orphaned records', () => {
    const exact = makeSavedRateRef(row());
    const product = makeLegacySavedRateRef('EX|SAVER');
    const raw = [
      { ...makeTrackedRate(exact), relevantDate: '2027-01-31', relevantDateKind: 'fixed-rate-end' },
      { ...makeTrackedRate(product), observedRate: 0.04 },
      { ...makeTrackedRate(makeLegacySavedRateRef('REMOVED')) },
    ];

    expect(normalizeTrackedRates(raw, [exact, product])).toEqual([
      expect.objectContaining({ id: exact.id, relevantDate: '2027-01-31' }),
      expect.objectContaining({ id: product.id, scope: 'product', rateIndex: null }),
    ]);
  });

  it('validates relevant calendar dates and keeps date kind coupled to the date', () => {
    const tracked = [makeTrackedRate(makeSavedRateRef(row()))];

    expect(setTrackedRateDate(tracked, tracked[0].id, '2027-02-28', 'fixed-rate-end')[0])
      .toMatchObject({ relevantDate: '2027-02-28', relevantDateKind: 'fixed-rate-end' });
    expect(setTrackedRateDate(tracked, tracked[0].id, null, null)[0])
      .toMatchObject({ relevantDate: null, relevantDateKind: null });
    expect(() => setTrackedRateDate(tracked, tracked[0].id, '2027-02-29', 'fixed-rate-end'))
      .toThrow(/real YYYY-MM-DD/);
    expect(() => setTrackedRateDate(tracked, tracked[0].id, '2027-02-28', null))
      .toThrow(/supported date kind/);
  });

  it('fails closed when persisted exact metadata conflicts with the saved reference', () => {
    const saved = makeSavedRateRef(row(7));
    const tracked = normalizeTrackedRates([
      {
        schemaVersion: 1,
        id: saved.id,
        scope: 'rate',
        productKey: 'EX|HOME',
        rateIndex: 999,
        trackedAt: '2026-01-01',
        observedRate: 0.01,
      },
    ], [saved]);

    expect(tracked[0]).toMatchObject({ id: saved.id, rateIndex: 7, observedRate: 0.01 });
  });

  it('stores only user-entered date metadata in encrypted native storage', async () => {
    const saved = makeSavedRateRef(row(7));
    const tracked = setTrackedRateDate(
      [makeTrackedRate(saved)],
      saved.id,
      '2027-01-31',
      'fixed-rate-end',
    );

    await saveTrackedRatesSecure(tracked);

    const secureWrite = (SecureStore.setItemAsync as jest.Mock).mock.calls.at(-1)?.[1];
    expect(JSON.parse(secureWrite)).toEqual([{
      id: saved.id,
      relevantDate: '2027-01-31',
      relevantDateKind: 'fixed-rate-end',
    }]);

    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(secureWrite);
    await expect(loadTrackedRatesSecure([saved])).resolves.toEqual([
      expect.objectContaining({
        id: saved.id,
        productKey: saved.productKey,
        rateIndex: 7,
        relevantDate: '2027-01-31',
      }),
    ]);
  });
});
