import fixture from './fixtures/suitability-conditional-siblings-20260913.json';
import { cache } from '../src/data/cache';
import { EMPTY_FILTERS, filterRows } from '../src/data/selectors';
import {
  buildSuitabilityIndex,
  clearSuitabilityIndex,
  closeSuitabilityGateUntilRebuild,
  hydrateSuitabilityIndex,
  installSuitabilityIndex,
  rebuildAndInstallSuitabilityIndex,
} from '../src/data/suitabilityIndex';
import type { CorePayload, DetailsPayload, RateRow, SectionKey } from '../src/types';

jest.mock('../src/data/cache', () => ({
  cache: {
    readSuitabilityIndex: jest.fn(async () => null),
    writeSuitabilityIndex: jest.fn(async () => undefined),
  },
}));

// Cache identities for this extracted unit-test subset; original asset hashes
// remain in the fixture's provenance and are not claimed for this subset.
const CORE_SHA = 'conditional-sibling-fixture-core';
const DETAILS_SHA = 'conditional-sibling-fixture-details';

function observedCase(caseIndex: number, reverse = false) {
  const observed = fixture.cases[caseIndex];
  const rates = [...observed.rates] as RateRow[];
  if (reverse) rates.reverse(); // Ordering control; every source field is unchanged.
  const section = observed.section as SectionKey;
  const core = {
    run_date: fixture.provenance.run_date,
    sections: { [section]: { rates } },
  } as unknown as CorePayload;
  const details = {
    run_date: core.run_date,
    products: { [observed.product_key]: observed.detail },
  } as unknown as DetailsPayload;
  const visible = (includeNonStandard = false) => filterRows(
    rates, { ...EMPTY_FILTERS, includeNonStandard }, details.products, null, section,
  );
  // Both retained products publish ordinary VARIABLE siblings above the deposit
  // token-rate floor. Their introductory/bonus sibling must remain opt-in.
  const ordinary = rates.filter((row) => row.rate_type === 'VARIABLE');
  return { core, details, rates, visible, ordinary, key: observed.product_key };
}

describe('observed conditional and ordinary siblings in the suitability index', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearSuitabilityIndex();
  });
  afterEach(clearSuitabilityIndex);

  it.each([
    ['Dnister source order', 0, false],
    ['Dnister reversed order', 0, true],
    ['BCU source order', 1, false],
    ['BCU reversed order', 1, true],
  ] as const)('preserves ordinary rows through default filters: %s', async (_label, caseIndex, reverse) => {
    const { core, details, visible, ordinary, rates } = observedCase(caseIndex, reverse);
    expect(ordinary.length).toBeGreaterThan(0);
    expect(visible()).toEqual(ordinary);
    const index = await buildSuitabilityIndex(core, details, DETAILS_SHA, CORE_SHA);
    installSuitabilityIndex(index);
    expect(visible()).toEqual(ordinary);
    expect(visible(true)).toEqual(rates);
  });

  it.each([0, 1])('replaces and rehydrates the stale schema2 omission for observed case %s', async (caseIndex) => {
    const { core, details, visible, ordinary, key } = observedCase(caseIndex);
    // This is the old persisted state produced when the first conditional row
    // swallowed its ordinary siblings. The underlying source rows are retained.
    jest.mocked(cache.readSuitabilityIndex).mockResolvedValue({
      schemaVersion: 2,
      runDate: core.run_date,
      coreSha: CORE_SHA,
      detailsSha: DETAILS_SHA,
      allowed: [],
    } as never);
    expect(await hydrateSuitabilityIndex(core.run_date, CORE_SHA, DETAILS_SHA)).toBeNull();

    // Mirror the existing bootstrap handoff: keep lists closed until matching
    // cached details rebuild the gate, without a payload/cache/user-data reset.
    closeSuitabilityGateUntilRebuild();
    expect(visible()).toEqual([]);
    await rebuildAndInstallSuitabilityIndex(core, details, DETAILS_SHA, () => true, CORE_SHA);
    expect(visible()).toEqual(ordinary);
    const persisted = jest.mocked(cache.writeSuitabilityIndex).mock.calls[0][0];
    expect(persisted).toMatchObject({ schemaVersion: 3, allowed: [key] });

    clearSuitabilityIndex();
    jest.mocked(cache.readSuitabilityIndex).mockResolvedValue(persisted);
    expect(await hydrateSuitabilityIndex(core.run_date, CORE_SHA, DETAILS_SHA)).not.toBeNull();
    expect(visible()).toEqual(ordinary);
  });
});
