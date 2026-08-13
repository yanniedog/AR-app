import {
  buildSuitabilityIndex,
  closeSuitabilityGateUntilRebuild,
  clearSuitabilityIndex,
  getSuitabilityIndex,
  hydrateSuitabilityIndex,
  installSuitabilityIndex,
  rebuildAndInstallSuitabilityIndex,
} from '../src/data/suitabilityIndex';
import { cache } from '../src/data/cache';
import { setSuitabilityAllowed, getSuitabilityAllowed } from '../src/data/suitabilityGate';
import { visibleAccountRows, isBroadlyAvailable } from '../src/data/format';
import { debugLog } from '../src/lib/debugLog';
import type { CorePayload, DetailsPayload, ProductDetail, RateRow } from '../src/types';

jest.mock('../src/data/cache', () => ({
  cache: {
    readSuitabilityIndex: jest.fn(async () => null),
    writeSuitabilityIndex: jest.fn(async () => undefined),
  },
}));

function row(partial: Partial<RateRow> & Pick<RateRow, 'product_key' | 'product_name'>): RateRow {
  return {
    provider: 'Test Bank',
    rate: 0.05,
    rate_index: 0,
    account_class: 'standard',
    hierarchy: ['Variable'],
    section: 'Mortgage',
    ...partial,
  } as RateRow;
}

describe('suitabilityIndex', () => {
  beforeEach(() => jest.clearAllMocks());

  afterEach(() => {
    clearSuitabilityIndex();
  });

  it('builds an allowed set matching isBroadlyAvailable', async () => {
    const open = row({ product_key: 'a|1', product_name: 'Standard Variable' });
    const staff = row({ product_key: 'a|2', product_name: 'Staff Home Loan' });
    const core = {
      run_date: '2026-07-15',
      sections: { Mortgage: { rates: [open, staff] } },
    } as unknown as CorePayload;
    const details = {
      run_date: '2026-07-15',
      products: {
        'a|1': { product_key: 'a|1', description: 'Open', eligibility: [], constraints: [] },
        'a|2': {
          product_key: 'a|2',
          description: 'Staff only',
          eligibility: [{ label: 'STAFF', name: 'Staff', value: 'Y', info: '' }],
          constraints: [],
        },
      },
    } as unknown as DetailsPayload;

    const index = await buildSuitabilityIndex(core, details, 'sha');
    expect(index.allowed.has('a|1')).toBe(true);
    expect(index.allowed.has('a|2')).toBe(false);
    expect(isBroadlyAvailable(open, details.products['a|1'] as ProductDetail)).toBe(true);
    expect(isBroadlyAvailable(staff, details.products['a|2'] as ProductDetail)).toBe(false);
  });

  it('classifies duplicate rate tiers once and reports row versus identity counts', async () => {
    const open = row({ product_key: 'dup|1', product_name: 'Standard Variable' });
    const restricted = row({ product_key: 'dup|2', product_name: 'Staff Home Loan' });
    const core = {
      run_date: '2026-07-15',
      sections: {
        Mortgage: { rates: [open, { ...open, rate: 0.051 }, restricted, { ...restricted, rate: 0.052 }] },
      },
    } as unknown as CorePayload;
    const infoSpy = jest.spyOn(debugLog, 'info').mockImplementation(() => {});

    const index = await buildSuitabilityIndex(core, null, '');

    expect(index.allowed).toEqual(new Set(['dup|1']));
    expect(infoSpy).toHaveBeenCalledWith(
      'suitability',
      expect.stringMatching(/\brows=4 identities=2 allowed=1\b/),
    );
    infoSpy.mockRestore();
  });

  it('preserves any-allowed semantics for inconsistent identities sharing a product key', async () => {
    const core = {
      run_date: '2026-07-15',
      sections: {
        Mortgage: {
          rates: [
            row({
              product_key: 'inconsistent|1',
              product_name: 'Staff Home Loan',
              account_class: 'non_standard',
            }),
            row({
              product_key: 'inconsistent|1',
              product_name: 'Everyday Home Loan',
              account_class: 'standard',
            }),
          ],
        },
      },
    } as unknown as CorePayload;

    const index = await buildSuitabilityIndex(core, null, '');

    expect(index.allowed).toEqual(new Set(['inconsistent|1']));
  });

  it('makes visibleAccountRows O(1) after install', async () => {
    const open = row({ product_key: 'b|1', product_name: 'Standard Variable' });
    const staff = row({ product_key: 'b|2', product_name: 'Staff Home Loan' });
    const core = {
      run_date: '2026-07-15',
      sections: { Mortgage: { rates: [open, staff] } },
    } as unknown as CorePayload;

    expect(getSuitabilityAllowed()).toBeNull();
    const index = await buildSuitabilityIndex(core, null, '');
    installSuitabilityIndex(index);
    expect(getSuitabilityIndex()?.allowed.size).toBeGreaterThan(0);
    expect(getSuitabilityAllowed()).toBe(index.allowed);

    const filtered = visibleAccountRows([open, staff], false, null);
    expect(filtered.map((r) => r.product_key)).toEqual(['b|1']);
  });

  it('clearSuitabilityIndex restores per-row assessAccess path', () => {
    setSuitabilityAllowed(new Set(['only']));
    clearSuitabilityIndex();
    expect(getSuitabilityAllowed()).toBeNull();
    expect(getSuitabilityIndex()).toBeNull();
  });

  it('fails closed between payload replacement and the matching rebuild', () => {
    const open = row({ product_key: 'pending|1', product_name: 'Standard Variable' });

    closeSuitabilityGateUntilRebuild();

    expect(getSuitabilityIndex()).toBeNull();
    expect(getSuitabilityAllowed()).toEqual(new Set());
    expect(visibleAccountRows([open], false, null)).toEqual([]);
  });

  it('hydrates an exact core and details hash without loading details', async () => {
    jest.mocked(cache.readSuitabilityIndex).mockResolvedValue({
      schemaVersion: 2,
      runDate: '2026-07-15',
      coreSha: 'core-sha',
      detailsSha: 'details-sha',
      allowed: ['a|1', 'b|2'],
    });

    const hydrated = await hydrateSuitabilityIndex(
      '2026-07-15',
      'core-sha',
      'details-sha',
    );
    expect(hydrated?.allowed).toEqual(new Set(['a|1', 'b|2']));
    expect(getSuitabilityAllowed()).toBe(hydrated?.allowed);
  });

  it('rejects a persisted gate built with older access-classification rules', async () => {
    jest.mocked(cache.readSuitabilityIndex).mockResolvedValue({
      schemaVersion: 1,
      runDate: '2026-07-15',
      coreSha: 'core-sha',
      detailsSha: 'details-sha',
      allowed: ['first-home-product'],
    } as never);

    await expect(
      hydrateSuitabilityIndex('2026-07-15', 'core-sha', 'details-sha'),
    ).resolves.toBeNull();
    expect(getSuitabilityAllowed()).toBeNull();
  });

  it('rejects a persisted gate from another payload pair', async () => {
    jest.mocked(cache.readSuitabilityIndex).mockResolvedValue({
      schemaVersion: 2,
      runDate: '2026-07-14',
      coreSha: 'old-core',
      detailsSha: 'old-details',
      allowed: ['a|1'],
    });

    await expect(
      hydrateSuitabilityIndex('2026-07-15', 'core-sha', 'details-sha'),
    ).resolves.toBeNull();
    expect(getSuitabilityAllowed()).toBeNull();
  });

  it('persists rebuilt gates and allows a later payload rebuild', async () => {
    const open = row({ product_key: 'c|1', product_name: 'Standard Variable' });
    const core = {
      run_date: '2026-07-15',
      sections: { Mortgage: { rates: [open] } },
    } as unknown as CorePayload;

    await rebuildAndInstallSuitabilityIndex(core, null, 'details-1', () => true, 'core-1');
    await rebuildAndInstallSuitabilityIndex(core, null, 'details-2', () => true, 'core-2');

    expect(cache.writeSuitabilityIndex).toHaveBeenCalledTimes(2);
    expect(jest.mocked(cache.writeSuitabilityIndex).mock.calls[1][0]).toMatchObject({
      schemaVersion: 2,
      coreSha: 'core-2',
      detailsSha: 'details-2',
      allowed: ['c|1'],
    });
  });
});
