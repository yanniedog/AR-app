import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import RbaResponseScreen from '../app/rba-response';

type TestNode = {
  props: Record<string, unknown>;
  findAllByProps: (props: Record<string, unknown>) => TestNode[];
  findAllByType: (type: string) => TestNode[];
  findByProps: (props: Record<string, unknown>) => TestNode;
};
type InspectableRenderer = ReactTestRenderer & { root: TestNode };

const mockRetryBankInsights = jest.fn(async () => undefined);
const mockEnsureBankInsights = jest.fn(async () => undefined);
const cachedSpread = {
  schema_version: 1,
  run_date: '2026-08-15',
  run_dates: ['2026-08-15'],
  method: 'mean_rate_rows_per_product_then_mean_products_per_provider',
  cohorts: { mortgage: 'mortgage', savings: 'savings' },
  banks: {
    Clean: {
      mortgage_mean: [0.06], savings_mean: [0.04], gap: [0.02],
      mortgage_count: [1], savings_count: [1], mortgage_hash: ['m'], savings_hash: ['s'], quality: ['complete'],
    },
    Tainted: {
      mortgage_mean: [0.061], savings_mean: [0.041], gap: [0.02],
      mortgage_count: [1], savings_count: [1], mortgage_hash: ['tm'], savings_hash: ['ts'], quality: ['complete'],
    },
  },
};
const mockState: Record<string, unknown> = {
  core: {
    run_date: '2026-08-15',
    sections: { Mortgage: { rates: [] }, Savings: { rates: [] }, TD: { rates: [] } },
    brands: {},
    rba: [],
  },
  coreIntegrity: null,
  rbaCalendar: null,
  bankInsights: { run_date: '2026-08-15', run_dates: [], banks: {}, events: [] },
  bankSpreadHistory: null,
  bankSpreadHistoryError: null,
  bankInsightsError: null,
  details: null,
  prefs: { includeNonStandard: true },
  ensureBankInsights: mockEnsureBankInsights,
  ensureBankSpreadHistory: jest.fn(async () => undefined),
  retryBankInsights: mockRetryBankInsights,
  retryBankSpreadHistory: jest.fn(async () => undefined),
  ensureDetails: jest.fn(async () => undefined),
  ensureRbaCalendar: jest.fn(async () => undefined),
  activeSection: 'Mortgage',
};

jest.mock('../src/data/store', () => ({
  useStore: (selector: (state: typeof mockState) => unknown) => selector(mockState),
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
}));

jest.mock('../src/hooks/useSuitabilityRevision', () => ({
  useSuitabilityRevision: () => 1,
}));

jest.mock('../src/data/suitabilityGate', () => ({
  isSuitabilityFilterReady: () => true,
}));

jest.mock('../src/data/bankInsights', () => ({
  filterBankInsightsForSuitability: (payload: unknown) => payload,
}));

jest.mock('../src/components/Screen', () => ({
  Screen: 'Screen',
  ScreenContent: 'ScreenContent',
}));

jest.mock('../src/components/feedback', () => ({
  ScreenSkeleton: 'ScreenSkeleton',
}));

jest.mock('../src/components/ui', () => ({
  AppText: 'AppText',
  Button: 'Button',
  Card: 'Card',
}));

jest.mock('../src/components/passthrough/BankResponseDashboard', () => ({
  BankResponseDashboard: 'BankResponseDashboard',
}));

describe('Bank response trust state', () => {
  beforeEach(() => {
    mockState.core = {
      run_date: '2026-08-15',
      sections: { Mortgage: { rates: [] }, Savings: { rates: [] }, TD: { rates: [] } },
      brands: {},
      rba: [],
    };
    mockState.bankInsights = { run_date: '2026-08-15', run_dates: [], banks: {}, events: [] };
    mockState.coreIntegrity = null;
    mockState.bankSpreadHistory = null;
    mockState.bankInsightsError = null;
    jest.clearAllMocks();
  });

  it('uses one shared scaffold and discloses cached data after refresh failure', async () => {
    mockState.bankInsightsError = 'network timeout';
    let tree!: InspectableRenderer;
    await act(async () => {
      tree = TestRenderer.create(<RbaResponseScreen />) as InspectableRenderer;
      await Promise.resolve();
    });

    expect(tree.root.findAllByType('Screen')).toHaveLength(1);
    const cachedError = tree.root.findByProps({ testID: 'bank-response-cached-error' });
    expect(cachedError.props.accessible).toBeUndefined();
    expect(tree.root.findAllByProps({ accessibilityRole: 'alert' })).toHaveLength(1);
    expect(tree.root.findAllByType('BankResponseDashboard')).toHaveLength(1);

    await act(async () => {
      (tree.root.findByProps({ title: 'Retry Bank response data' }).props.onPress as () => void)();
      await Promise.resolve();
    });
    expect(mockRetryBankInsights).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it('does not show a stale-data notice when the current insight asset has no error', async () => {
    let tree!: InspectableRenderer;
    await act(async () => {
      tree = TestRenderer.create(<RbaResponseScreen />) as InspectableRenderer;
      await Promise.resolve();
    });
    expect(tree.root.findAllByType('Screen')).toHaveLength(1);
    expect(tree.root.findAllByProps({ testID: 'bank-response-cached-error' })).toHaveLength(0);
    act(() => tree.unmount());
  });

  it('filters a cold cached spread through core integrity while retaining clean providers', async () => {
    mockState.bankSpreadHistory = cachedSpread;
    mockState.coreIntegrity = {
      schemaVersion: 1,
      core: mockState.core,
      contract: 'v1',
      runDate: '2026-08-15',
      generationDigest: null,
      coreSha256: 'a'.repeat(64),
      normalizationVersion: 'test',
      quarantines: {
        bankHistoryPairs: new Set(['Savings\u0000Tainted']),
        rowsByReason: { explicit_term_deposit_in_savings: 1 },
      },
    };
    let tree!: InspectableRenderer;
    await act(async () => {
      tree = TestRenderer.create(<RbaResponseScreen />) as InspectableRenderer;
      await Promise.resolve();
    });

    const dashboard = tree.root.findAllByType('BankResponseDashboard')[0];
    expect(dashboard).toBeDefined();
    expect(Object.keys((dashboard.props.spreadHistory as typeof cachedSpread).banks)).toEqual(['Clean']);
    act(() => tree.unmount());
  });

  it('keeps unavailable and loading states inside the same one-banner scaffold', async () => {
    mockState.core = null;
    let tree!: InspectableRenderer;
    await act(async () => {
      tree = TestRenderer.create(<RbaResponseScreen />) as InspectableRenderer;
    });
    expect(tree.root.findAllByType('Screen')).toHaveLength(1);
    expect(tree.root.findAllByType('ScreenSkeleton')).toHaveLength(1);
    act(() => tree.unmount());
  });
});
