import { productSourceUrl, productWebUrl } from '../src/components/product/ProductPageLink';

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

test('a product page beats a landing-page overview; the landing page is the last resort', () => {
  expect(productWebUrl({ overview: 'https://www.example-bank.com.au/', fees: 'https://www.example-bank.com.au/home-loans/fees' } as never, null))
    .toBe('https://www.example-bank.com.au/home-loans/fees');
  expect(productWebUrl({ overview: 'https://www.example-bank.com.au/' } as never, null)).toBe('https://www.example-bank.com.au/');
});

test('a public-only product with no lender links uses the page its rate was read from, never a document or feed', () => {
  expect(productSourceUrl('https://www.mortgagemart.example.au/portfolio-loan')).toBe('https://www.mortgagemart.example.au/portfolio-loan');
  expect(productSourceUrl('https://www.mortgagemart.example.au/')).toBe('https://www.mortgagemart.example.au/');
  for (const url of ['https://www.example.au/rates.pdf', 'https://www.example.au/rates.csv', 'https://www.example.au/news.rss',
    'https://www.example.au/blog/feed', 'https://www.example.au/atom/', 'https://api.example.au/loans']) expect(productSourceUrl(url)).toBeNull();
  expect(productSourceUrl(null)).toBeNull();
  expect(productWebUrl({ overview: 'https://www.example.au/rates.csv', fees: 'https://www.example.au/news.xml' } as never, null)).toBeNull();
});
