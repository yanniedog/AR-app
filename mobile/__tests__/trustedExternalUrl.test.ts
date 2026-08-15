import { trustedExternalUrl } from '../src/lib/trustedExternalUrl';

describe('trustedExternalUrl', () => {
  it('accepts only purpose-matched official destinations and strips fragments', () => {
    expect(trustedExternalUrl({
      url: 'https://www.rba.gov.au/statistics/tables/#cash-rate',
      purpose: 'official_economic_source',
      label: 'RBA tables',
    })).toEqual({
      ok: true,
      url: 'https://www.rba.gov.au/statistics/tables/',
      host: 'www.rba.gov.au',
      label: 'RBA tables',
      purpose: 'official_economic_source',
    });
    expect(trustedExternalUrl({
      url: 'https://data.api.abs.gov.au/rest/data/ABS,CPI,2.0.0',
      purpose: 'official_economic_source',
      label: 'ABS CPI',
    }).ok).toBe(true);
    expect(trustedExternalUrl({
      url: 'https://github.com/yanniedog/AR-app/releases/tag/app-v1.0.157',
      purpose: 'app_release',
      label: 'Release notes',
    }).ok).toBe(true);
    expect(trustedExternalUrl({
      url: 'https://github.com/attacker/fake/releases/tag/app-v1.0.157',
      purpose: 'app_release',
      label: 'Release notes',
    }).ok).toBe(false);
  });

  it('admits CDR lender sources only on approved lender host classes', () => {
    expect(trustedExternalUrl({
      url: 'https://www.commbank.com.au/home-loans.html',
      purpose: 'lender_source',
      label: 'Product overview',
    }).ok).toBe(true);
    expect(trustedExternalUrl({
      url: 'https://www.tyro.com/products/term-deposits',
      purpose: 'lender_source',
      label: 'Product overview',
    }).ok).toBe(true);
    expect(trustedExternalUrl({
      url: 'https://example.com/product',
      purpose: 'lender_source',
      label: 'Product overview',
    }).ok).toBe(false);
  });

  it.each([
    'http://www.rba.gov.au/statistics/tables/',
    'https://user:secret@www.rba.gov.au/statistics/tables/',
    'https://localhost/statistics',
    'https://127.0.0.1/statistics',
    'https://[::1]/statistics',
    'https://www.rba.gov.au:444/statistics',
    'https://xn--rba-7za.gov.au/statistics',
    'https://www.rba.gov.au/statistics?access_token=secret',
  ])('fails closed for unsafe destination %s', (url) => {
    const result = trustedExternalUrl({
      url,
      purpose: 'official_economic_source',
      label: 'Official source',
    });
    expect(result.ok).toBe(false);
  });

  it('does not allow a trusted host under the wrong purpose', () => {
    expect(trustedExternalUrl({
      url: 'https://www.rba.gov.au/statistics/tables/',
      purpose: 'app_release',
      label: 'Release notes',
    }).ok).toBe(false);
    expect(trustedExternalUrl({
      url: 'https://github.com/yanniedog/AR-app/releases/tag/app-v1.0.157',
      purpose: 'official_economic_source',
      label: 'RBA tables',
    }).ok).toBe(false);
  });
});
