import core from '../assets/sample/core.json';
import logoSources from '../assets/banks/sources.json';
import { BUNDLED_BANK_LOGOS } from '../src/data/bankLogoAssets';
import {
  lookupProvider,
  isSvgLogoSource,
  resolveBankLogoSources,
  resolveBankLogoSourcesForRuntime,
  resolveBrandShort,
  resolveBundledBankLogoSource,
} from '../src/data/bankBrand';
import type { CorePayload } from '../src/types';

const sample = core as CorePayload;

describe('bankBrand', () => {
  it('canonicalizes CDR provider labels like the dashboard', () => {
    expect(lookupProvider('CommBank')).toBe('commonwealth bank of australia');
    expect(lookupProvider('ING BANK (Australia) Ltd')).toBe('ing');
    expect(lookupProvider('NATIONAL AUSTRALIA BANK')).toBe('national australia bank');
    expect(lookupProvider('St.George Bank')).toBe('st. george bank');
    expect(lookupProvider('Queensland Country Bank')).toBe('queensland country bank');
    expect(lookupProvider('Bank of Queensland Limited')).toBe('bank of queensland');
    expect(lookupProvider('Example Bank')).toBe('Example Bank');
    expect(lookupProvider('Stanza Credit Union')).toBe('Stanza Credit Union');
    expect(resolveBundledBankLogoSource('Queensland Country Bank')).not.toEqual(resolveBundledBankLogoSource('Bank of Queensland Limited'));
  });

  it('resolves bundled logo sources for major lenders', () => {
    const providers = [
      'CommBank',
      'ING BANK (Australia) Ltd',
      'Westpac',
      'AMP - My AMP',
      'NATIONAL AUSTRALIA BANK',
    ];
    for (const provider of providers) {
      const sources = resolveBankLogoSources(provider);
      expect(sources).toEqual([resolveBundledBankLogoSource(provider)]);
    }
  });

  it('provides a network-free source for audit rendering', () => {
    expect(resolveBundledBankLogoSource('ANZ')).not.toBeNull();
    expect(resolveBundledBankLogoSource('Totally Unknown Bank')).toBeNull();
    expect(resolveBankLogoSourcesForRuntime(
      'ANZ',
      'https://payload.test/anz.png',
      'https://register.test/anz.svg',
      true,
    )).toEqual([resolveBundledBankLogoSource('ANZ')]);
    expect(resolveBankLogoSourcesForRuntime(
      'Totally Unknown Bank',
      'https://payload.test/unknown.png',
      'https://register.test/unknown.svg',
      true,
    )).toEqual([]);
  });

  it('prefers verified bundled logos over stale payload artwork', () => {
    const embedded = 'data:image/png;base64,abc';
    const sources = resolveBankLogoSources('ANZ', embedded);
    expect(sources[0]).toBe(resolveBundledBankLogoSource('ANZ'));
    expect(sources).toEqual([resolveBundledBankLogoSource('ANZ')]);
  });

  it('covers every logo-pack lender in the sample export', () => {
    const packProviders = [
      'AMP - My AMP',
      'AMP Bank GO',
      'ANZ',
      'Bank of Melbourne',
      'Bank of Queensland Limited',
      'Bankwest',
      'Bendigo Bank',
      'CommBank',
      'Great Southern Bank',
      'Great Southern Bank Business+',
      'HSBC',
      'HSBC Bank Australia Limited – Wholesale Banking',
      'ING BANK (Australia) Ltd',
      'Macquarie Bank Limited',
      'NATIONAL AUSTRALIA BANK',
      'St.George Bank',
      'Suncorp Bank',
      'Westpac',
    ];
    for (const provider of packProviders) {
      expect(resolveBankLogoSources(provider).length).toBeGreaterThan(0);
    }
    const sampleProviders = Object.keys(sample.brands ?? {});
    const withSources = sampleProviders.filter((p) => resolveBankLogoSources(p).length > 0);
    expect(withSources.length).toBeGreaterThanOrEqual(packProviders.length);
  });

  it('falls back to monogram short labels when no brand entry exists', () => {
    expect(resolveBrandShort('Some New Bank')).toBe('SNB');
  });

  it('uses remote artwork only for providers without a curated bundle', () => {
    const uri = 'https://mystate.com.au/wp-content/uploads/MyState_Logo_s.png';
    expect(resolveBankLogoSources('MyState Bank', undefined, uri)).toEqual([resolveBundledBankLogoSource('MyState Bank')]);
    const anz = resolveBankLogoSources('ANZ', undefined, uri);
    expect(anz).toEqual([resolveBundledBankLogoSource('ANZ')]);
    expect(resolveBankLogoSources('Totally Unknown Bank')).toEqual([]);
  });

  it('rejects untrusted remote and oversized embedded logos', () => {
    expect(resolveBankLogoSources('Unknown', 'https://tracker.test/logo.png')).toEqual([]);
    expect(resolveBankLogoSources('Unknown', `data:image/png;base64,${'a'.repeat(300_000)}`)).toEqual([]);
    for (const uri of [
      'http://bank.test/logo.png',
      'https://user:secret@bank.test/logo.png',
      'https://localhost/logo.png',
      'https://127.0.0.1/logo.png',
      'https://10.0.0.2/logo.png',
      'https://bank.test/logo.html',
    ]) {
      expect(resolveBankLogoSources('Unknown', undefined, uri)).toEqual([]);
    }
  });

  it('keeps audit rendering network-free and resolves every trusted sample logo', () => {
    const remote = 'https://bank.test/logo.svg';
    expect(resolveBankLogoSourcesForRuntime('Unknown', undefined, remote, true)).toEqual([]);
    expect(resolveBankLogoSourcesForRuntime('Unknown', undefined, remote, false)).toEqual([remote]);
    expect(isSvgLogoSource(remote)).toBe(true);

    const providersWithArtwork = Object.entries(sample.brands ?? {}).filter(([, brand]) =>
      Boolean(brand.logo || brand.logo_uri || brand.logo_svg_uri));
    expect(providersWithArtwork.length).toBeGreaterThan(0);
    for (const [provider, brand] of providersWithArtwork) {
      expect(
        resolveBankLogoSources(
          provider,
          brand.logo,
          brand.logo_uri ?? brand.logo_svg_uri,
        ),
      ).not.toHaveLength(0);
    }
  });

  it('has offline artwork for every registered brand and supported historical provider label', () => {
    expect(logoSources.brands).toHaveLength(116);
    // Family First has left the register; retain initials rather than assign
    // Beyond Bank's successor logo to historical Family First records.
    const historicalProviders = Object.keys(sample.brands ?? {}).filter(provider => provider !== 'Family First');
    for (const provider of [...logoSources.brands.map(brand => brand.provider), ...historicalProviders]) {
      expect({ provider, source: resolveBundledBankLogoSource(provider) }).toEqual({
        provider, source: expect.anything(),
      });
      expect(resolveBankLogoSourcesForRuntime(provider, undefined, 'https://bank.test/logo.png', true))
        .toEqual([resolveBundledBankLogoSource(provider)]);
    }
  });

  it('retains safe embedded artwork for an unknown provider', () => {
    expect(resolveBankLogoSources('Unknown', 'data:image/png;base64,abc'))
      .toEqual(['data:image/png;base64,abc']);
  });


  it('resolves each registered provider to its own recorded asset identity', () => {
    for (const brand of logoSources.brands) {
      expect(resolveBundledBankLogoSource(brand.provider)).toBe(BUNDLED_BANK_LOGOS[brand.key]);
    }
    for (const [provider, key] of [
      ['Queensland Country Bank Limited', 'queensland-country-bank'],
      ['Queensland Country Bank Ltd.', 'queensland-country-bank'],
      ['Bank of Queensland Limited', 'bank-of-queensland-limited'],
      ['Greater Bank Limited', 'greater-bank'],
      ['MOVE Bank', 'movebank'],
      ['Newcastle Permanent Building Society', 'newcastle-permanent'],
      ['Qantas Money Home Loans', 'qantas-money-basic-offset-home-loans'],
    ]) {
      expect(resolveBundledBankLogoSource(provider)).toBe(BUNDLED_BANK_LOGOS[key]);
    }
  });

  it('never offers stale payload artwork as a known bank fallback', () => {
    expect(resolveBankLogoSources('Queensland Country Bank',
      'data:image/png;base64,wrong-bank', 'https://another-bank.test/logo.png'))
      .toEqual([BUNDLED_BANK_LOGOS['queensland-country-bank']]);
  });

});
