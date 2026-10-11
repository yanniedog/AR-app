import { trustedExternalUrl } from '../src/lib/trustedExternalUrl';

describe('trustedExternalUrl', () => {
  it.each([
    'https://anz.com/plus/homeloantncs',
    'https://www.bankofchina.com/au/en/pbservice/',
    'https://www.qantasmoney.com/terms-and-forms/tmd',
    'https://www.racq.com/downloads',
    'https://cdn.bfldr.com/1R31Y8GR/as/document/Loan_fees_schedule',
    'https://cdn.intelligencebank.com/au/share/e3Gq6M/document/original/TMD',
    'https://cdn.intelligencebank.com/au/share/NZw2/document/original/TMD',
    'https://cdn.intelligencebank.com/au/share/w8gXkZ/document/original/TMD',
    'https://cdn.mediavalet.com/aunsw/policebank/document/Original/TMD.pdf',
    'https://d9a7lp1kie9ya.cloudfront.net/2025/12/EXISTING-Fees-Charges-111225.pdf',
    'https://cdn.gsb1.prod.cxnpl.io/files/products/product/v1/terms.pdf',
  ])('accepts published lender/document destination %s', (url) => {
    expect(trustedExternalUrl({ url, purpose: 'lender_source', label: 'Published source' }).ok).toBe(true);
  });

  it.each([
    'https://cdn.bfldr.com/OTHER/as/document',
    'https://cdn.intelligencebank.com/au/share/OTHER/document',
    'https://cdn.mediavalet.com/another/tenant/file.pdf',
    'https://other.cloudfront.net/2025/12/terms.pdf',
    'https://cdn.gsb1.prod.cxnpl.io/other/file.pdf',
    'https://anz.com.attacker.com/terms',
    'http://localhost/terms',
    'http://www.anz.com:8080/terms',
    'http://user:secret@www.anz.com/terms',
  ])('keeps unrelated tenants and unsafe legacy links blocked %s', (url) => {
    expect(trustedExternalUrl({ url, purpose: 'lender_source', label: 'Source' }).ok).toBe(false);
  });

  it('canonicalizes approved legacy lender links without allowing HTTP transport', () => {
    for (const [url, expected] of [
      ['http://www.anz.com/terms#fees', 'https://www.anz.com/terms'],
      ['http://brokenhill.bank/rates-and-fees', 'https://brokenhill.bank/rates-and-fees'],
      ['https://www.summerland.com.au.', 'https://www.summerland.com.au/'],
    ]) expect(trustedExternalUrl({ url, purpose: 'lender_source', label: 'Source' }))
      .toMatchObject({ ok: true, url: expected });
  });

  it('uses standards parsing even when the global URL is React Native\'s getter-only fallback', () => {
    const original = globalThis.URL;
    const native = jest.requireActual('react-native/Libraries/Blob/URL').URL;
    globalThis.URL = native;
    try {
      const source = 'https://www.rba.gov.au/statistics/tables/csv/j1-cash-rate.csv?format=csv#forecast';
      expect(trustedExternalUrl({ url: source, purpose: 'official_economic_source', label: 'RBA survey' })).toMatchObject({
        ok: true,
        url: 'https://www.rba.gov.au/statistics/tables/csv/j1-cash-rate.csv?format=csv',
      });
      expect(trustedExternalUrl({ url: 'https://www.rba.gov.au:443/statistics/tables/', purpose: 'official_economic_source', label: 'RBA' })).toMatchObject({
        ok: true, url: 'https://www.rba.gov.au/statistics/tables/',
      });
      expect(trustedExternalUrl({ url: 'https://www.rba.gov.au/?%61ccess_token=private', purpose: 'official_economic_source', label: 'RBA' }).ok).toBe(false);
    } finally {
      globalThis.URL = original;
    }
  });

  it('allows only the ASX tracker page for the market-source purpose', () => {
    const path = '/markets/trade-our-derivatives-market/futures-market/rba-rate-tracker';
    for (const host of ['asx.com.au', 'www.asx.com.au']) {
      expect(trustedExternalUrl({ url: `https://${host}${path}`, purpose: 'official_market_source', label: 'ASX tracker' }).ok).toBe(true);
    }
    for (const url of [
      'https://www.asx.com.au/',
      `https://other.asx.com.au${path}`,
      `https://www.asx.com.au${path}?redirect=https://example.com`,
      'https://www.asx.com.au/content/dam/asx/data/market_exp.csv',
    ]) {
      expect(trustedExternalUrl({ url, purpose: 'official_market_source', label: 'ASX tracker' }).ok).toBe(false);
    }
    expect(trustedExternalUrl({ url: `https://www.asx.com.au${path}`, purpose: 'official_economic_source', label: 'ASX tracker' }).ok).toBe(false);
  });
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
