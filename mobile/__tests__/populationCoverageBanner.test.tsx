import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { PopulationCoverageBanner } from '../src/components/PopulationCoverageBanner';
import type { CorePayload } from '../src/types';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

const renderBanner = (core: CorePayload | null, topInsetConsumed = false) =>
  <SafeAreaInsetsContext.Provider value={{ top: 32, bottom: 0, left: 0, right: 0 }}>
    <PopulationCoverageBanner core={core} topInsetConsumed={topInsetConsumed} />
  </SafeAreaInsetsContext.Provider>;

test('unknown coverage is always visible with date and identity, has no dismissal, and follows publication replacement', () => {
  const core = { coverage: { population_assessment: { schema_version: 1, scope: 'observed-products', observed_on: '2026-11-02',
    total_population: null, missing_product_count: null, observed_counts: { products: 2, rates: 3, providers: 1 },
    affected_providers: [{ provider_id: 'wise', provider_name: 'Wise', register_status: 'registered', membership_status: 'unknown',
      reason: 'register-endpoint-conflict', missing_product_count: null, register_url: 'https://register.example/', endpoint_url: 'https://wise.example/' }],
  } } } as CorePayload;
  let tree!: ReactTestRenderer & { toJSON(): unknown };
  act(() => { tree = TestRenderer.create(renderBanner(core)) as typeof tree; });
  const output = JSON.stringify(tree.toJSON());
  for (const fact of ['Partial', 'Observed products', 'Total population', 'Unknown', 'Wise', 'Membership']) expect(output).toContain(fact);
  expect(output).not.toContain('Dismiss');
  expect(output).toContain('"paddingTop":38');
  act(() => tree.update(renderBanner({ ...core }, true)));
  expect(JSON.stringify(tree.toJSON())).toContain('Partial');
  expect(JSON.stringify(tree.toJSON())).toContain('"paddingTop":6');
  act(() => tree.update(renderBanner(null)));
  expect(tree.toJSON()).toBeNull();
  act(() => tree.unmount());
});
