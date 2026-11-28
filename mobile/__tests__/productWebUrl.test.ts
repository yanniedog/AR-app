import { productWebUrl } from '../src/components/product/ProductPageLink';

jest.mock('../src/components/ExternalLinkConfirmation', () => ({ useTrustedExternalUrl: () => ({ requestExternalUrl: jest.fn() }) }));
jest.mock('../src/hooks/useAuditExternalLinks', () => ({ useAuditExternalLinks: jest.fn() }));

describe('productWebUrl', () => {
  it('prefers the already validated overview page', () => {
    expect(productWebUrl({ overview: 'https://www.example.com.au/a' }, 'https://www.example.com.au/page')).toBe('https://www.example.com.au/page');
  });
  it('never returns documents or API hosts', () => {
    expect(productWebUrl({ overview: 'https://www.example.com.au/terms.pdf', fees: 'https://api.example.com.au/x' }, null)).toBeNull();
    expect(productWebUrl(undefined, null)).toBeNull();
  });
});
