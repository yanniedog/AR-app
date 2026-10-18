import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { ProductRatesList } from '../src/components/product/ProductDetailParts';
import { openProduct } from '../src/lib/nav';
import { row } from '../testUtils/publicRateJourney';

jest.mock('../src/lib/nav', () => ({ openProduct: jest.fn() }));
jest.mock('../src/data/store', () => ({ useStore: (selector: any) => selector({ prefs: { mortgageRateMetric: 'headline' } }) }));
jest.mock('../src/components/icons/AppIcon', () => 'AppIcon');
jest.mock('../src/components/ExternalLinkConfirmation', () => ({ useTrustedExternalUrl: () => ({ requestExternalUrl: jest.fn() }) }));
jest.mock('../src/hooks/useAuditExternalLinks', () => ({ useAuditExternalLinks: jest.fn() }));
jest.mock('../src/components/feedback', () => ({}));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: {} }) }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Row: 'Row',
  Disclosure: ({ children }: any) => children }));

test('opening a generated sibling preserves its exact public programme identity', () => {
  let tree!: ReactTestRenderer & { root: { findAllByType: (type: any) => { props: { onPress: () => void } }[] } };
  act(() => { tree = TestRenderer.create(<ProductRatesList rows={[
    { ...row, rate_index: undefined, public_offer_id: 'first-offer', public_programme_id: 'first-programme' },
    { ...row, rate_index: undefined, public_offer_id: 'second-offer', public_programme_id: 'second-programme' },
  ]} section="Mortgage" accent="#000" defaultOpen />) as typeof tree; });
  const buttons = tree.root.findAllByType('Button' as any);
  act(() => buttons[1].props.onPress());
  expect(openProduct).toHaveBeenCalledWith(row.product_key, undefined, 'second-programme');
  act(() => tree.unmount());
});
