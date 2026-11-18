import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { ProductDocuments } from '../src/components/product/ProductDocuments';
import { useAuditExternalLinks } from '../src/hooks/useAuditExternalLinks';
import type { ProductDetail } from '../src/types';

jest.mock('../src/hooks/useAuditExternalLinks', () => ({ useAuditExternalLinks: jest.fn() }));
jest.mock('../src/components/ExternalLinkConfirmation', () => ({ useTrustedExternalUrl: () => ({ requestExternalUrl: jest.fn() }) }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Row: 'Row', Disclosure: 'Disclosure' }));

test('provider homepages never appear as document evidence or passive document audit targets', async () => {
  const url = 'https://up.com.au/docs/Up-Home-Loan-Booklet.pdf';
  const productDetails: ProductDetail = { sourceDocuments: [
    { url: 'https://up.com.au/', sourcePath: '/additionalInformation/overviewUri', relation: 'overview' },
    { url, sourcePath: '/additionalInformation/termsUri', relation: 'terms', specificity: 'product-family' },
  ] };
  let tree!: ReactTestRenderer & { toJSON: () => unknown; root: { findAllByProps: (props: Record<string, unknown>) => unknown[] } };
  await act(async () => { tree = TestRenderer.create(<ProductDocuments productDetails={productDetails} />) as typeof tree; });
  expect(JSON.stringify(tree.toJSON())).not.toContain('Provider website');
  expect(jest.mocked(useAuditExternalLinks).mock.calls.at(-1)?.[0]).toEqual([{ url, purpose: 'lender_source', label: 'Source' }]);
  expect(tree.root.findAllByProps({ title: 'Open document' })).toHaveLength(1);
});
