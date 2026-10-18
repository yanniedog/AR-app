import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { PublicProductDiscovery } from '../src/components/scenario/PublicPricingCoverage';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';
import { openProduct } from '../src/lib/nav';
import { AS_OF, catalogue, core, product } from '../testUtils/publicRateJourney';
import { normalizeUserRateScenario } from '../src/data/userRateScenario';

const mockCatalogue = catalogue();
const mockScenario = normalizeUserRateScenario(undefined);
jest.mock('../src/data/publicRateCatalogue', () => ({ usePublicRateCatalogue: () => mockCatalogue }));
jest.mock('../src/data/store', () => ({ useStore: (selector: (state: unknown) => unknown) => selector({ manifest: null, prefs: {} }) }));
jest.mock('../src/hooks/useUserRateScenario', () => ({ useUserRateScenario: () => ({ scenario: mockScenario }) }));
jest.mock('../src/lib/nav', () => ({ openProduct: jest.fn() }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Card: 'Card', Disclosure: 'Disclosure' }));

beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date(AS_OF)); jest.clearAllMocks(); });
afterEach(() => { installMandatoryEligibility(selectMandatoryEligibility(null, null, null)); jest.useRealTimers(); });

it('opens a matching catalogue-only discovery product and removes it when a mandatory feature becomes unknown', () => {
  installMandatoryEligibility(selectMandatoryEligibility(core([]), { rateTypes: ['VARIABLE'] }, {}));
  let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<PublicProductDiscovery section="Mortgage" />); });
  try {
    const button = tree.root.findByType('Button' as never);
    act(() => button.props.onPress());
    expect(openProduct).toHaveBeenCalledWith(product.productKey);
    act(() => installMandatoryEligibility(selectMandatoryEligibility(core([]), { accountFeatures: ['OFFSET'] }, {})));
    expect(tree.root.findAllByType('Button' as never)).toHaveLength(0);
  } finally { act(() => tree.unmount()); }
});
