import core from '../assets/sample/core.json';
import {
  lookupProvider,
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

  it('prefers payload-embedded logos before bundled fallbacks', () => {
    const embedded = 'data:image/png;base64,abc';
    const sources = resolveBankLogoSources('ANZ', embedded);
    expect(sources[0]).toBe(embedded);
    expect(sources.length).toBeGreaterThan(1);
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

  it('rejects remote register artwork and falls back to local art or initials', () => {
    const uri = 'https://mystate.com.au/wp-content/uploads/MyState_Logo_s.png';
    expect(resolveBankLogoSources('MyState Bank', undefined, uri)).toEqual([]);
    const anz = resolveBankLogoSources('ANZ', undefined, uri);
    expect(anz).toEqual([resolveBundledBankLogoSource('ANZ')]);
    expect(resolveBankLogoSources('Totally Unknown Bank')).toEqual([]);
  });

  it('rejects remote and oversized embedded logos', () => {
    expect(resolveBankLogoSources('Unknown', 'https://tracker.test/logo.png')).toEqual([]);
    expect(resolveBankLogoSources('Unknown', `data:image/png;base64,${'a'.repeat(300_000)}`)).toEqual([]);
  });
});
