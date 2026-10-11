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
  // Dnister's exact source rows have unspecified LVR, so both siblings are now
  // opt-in. BCU's two ordinary VARIABLE savings tiers remain visible by default.
  const ordinary = caseIndex === 0 ? [] : rates.filter((row) => row.rate_type === 'VARIABLE');
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
  ] as const)('applies current LVR and conditionality policy through default filters: %s', async (_label, caseIndex, reverse) => {
    const { core, details, visible, ordinary, rates } = observedCase(caseIndex, reverse);
    expect(ordinary).toHaveLength(caseIndex === 0 ? 0 : 2);
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
    expect(persisted).toMatchObject({ schemaVersion: 5, allowed: caseIndex === 0 ? [] : [key] });

    clearSuitabilityIndex();
    jest.mocked(cache.readSuitabilityIndex).mockResolvedValue(persisted);
    expect(await hydrateSuitabilityIndex(core.run_date, CORE_SHA, DETAILS_SHA)).not.toBeNull();
    expect(visible()).toEqual(ordinary);
  });
});
