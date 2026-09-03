import { makeSavedRateRef, makeLegacySavedRateRef } from '../src/data/savedRates';
import {
  loadTrackedRatesSecure,
  loadTrackedRatesSecureResult,
  makeTrackedRate,
  normalizeTrackedRates,
  saveTrackedRatesSecure,
  setTrackedRateDate,
  TRACKED_RATE_SECURE_STORAGE_KEY,
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
        relevantDate: '2027-01-31',
        relevantDateKind: 'fixed-rate-end',
      },
    ], [saved]);

    expect(tracked[0]).toMatchObject({
      id: saved.id,
      rateIndex: 7,
      observedRate: 0.0599,
      trackedAt: saved.savedAt,
      relevantDate: '2027-01-31',
    });
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

    const chunkWrite = (SecureStore.setItemAsync as jest.Mock).mock.calls.find(
      ([key]) => String(key).startsWith(`${TRACKED_RATE_SECURE_STORAGE_KEY}.chunk.`),
    )?.[1];
    expect(JSON.parse(chunkWrite)).toEqual([{
      id: saved.id,
      relevantDate: '2027-01-31',
      relevantDateKind: 'fixed-rate-end',
    }]);

    await expect(loadTrackedRatesSecure([saved])).resolves.toEqual([
      expect.objectContaining({
        id: saved.id,
        productKey: saved.productKey,
        rateIndex: 7,
        relevantDate: '2027-01-31',
      }),
    ]);
  });

  it('chunks a long private-date list below the native secure-value warning threshold', async () => {
    const saved = Array.from({ length: 50 }, (_, index) => makeSavedRateRef({
      ...row(index),
      product_key: `EX|${index}|${'LONG'.repeat(12)}`,
    }));
    const tracked = saved.map((ref) => ({
      ...makeTrackedRate(ref),
      relevantDate: '2028-12-31',
      relevantDateKind: 'fixed-rate-end' as const,
    }));

    await saveTrackedRatesSecure(tracked);

    const writes = (SecureStore.setItemAsync as jest.Mock).mock.calls.filter(
      ([key]) => String(key) === TRACKED_RATE_SECURE_STORAGE_KEY ||
        String(key).startsWith(`${TRACKED_RATE_SECURE_STORAGE_KEY}.chunk.`),
    );
    expect(writes.length).toBeGreaterThan(2);
    for (const [, value] of writes) {
      expect(new TextEncoder().encode(String(value)).byteLength).toBeLessThanOrEqual(1_800);
    }
    await expect(loadTrackedRatesSecure(saved)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: saved[0].id, relevantDate: '2028-12-31' }),
        expect.objectContaining({ id: saved[49].id, relevantDate: '2028-12-31' }),
      ]),
    );
  });

  it.each([
    ['unreadable', () => (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('reset'))],
    ['malformed', () => (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('{broken')],
  ])('fails soft for %s private storage', async (_label, arrange) => {
    const saved = makeSavedRateRef(row());
    arrange();

    await expect(loadTrackedRatesSecure([saved])).resolves.toEqual([
      expect.objectContaining({ id: saved.id, relevantDate: null }),
    ]);
  });

  it('reports a transient native read failure separately from an empty record', async () => {
    const saved = makeSavedRateRef(row());
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('device locked'));

    await expect(loadTrackedRatesSecureResult([saved])).resolves.toEqual({
      status: 'unavailable',
      trackedRates: [expect.objectContaining({ id: saved.id, relevantDate: null })],
    });
  });

  it('reports a committed generation with a missing chunk as unavailable', async () => {
    const saved = makeSavedRateRef(row());
    (SecureStore.getItemAsync as jest.Mock)
      .mockResolvedValueOnce(JSON.stringify({
        schemaVersion: 2,
        generation: 'interrupted',
        chunks: 1,
      }))
      .mockResolvedValueOnce(null);

    await expect(loadTrackedRatesSecureResult([saved])).resolves.toEqual({
      status: 'unavailable',
      trackedRates: [expect.objectContaining({ id: saved.id, relevantDate: null })],
    });
  });
});
