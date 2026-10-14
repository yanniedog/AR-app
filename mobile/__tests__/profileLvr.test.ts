import { compareLvrTiers, lvrTierDisplay, lvrTierLabel, refreshLvrLabelText } from '../src/data/lvrTier';
import { lvrTierForValue, parseLvrTier } from '../src/data/profile';

// Real data values from core.sections.Mortgage.rates[].lvr_tier
const TIERS = [
  'lvr_=60%',
  'lvr_60-70%',
  'lvr_70-80%',
  'lvr_80-85%',
  'lvr_85-90%',
  'lvr_90-95%',
  'lvr_unspecified',
];

describe('parseLvrTier', () => {
  it('parses the data tier formats into (lo, hi] ranges', () => {
    expect(parseLvrTier('lvr_=60%')).toEqual({ lo: 0, hi: 60 });
    expect(parseLvrTier('lvr_85-90%')).toEqual({ lo: 85, hi: 90 });
    expect(parseLvrTier('lvr_unspecified')).toBeNull();
    expect(parseLvrTier('')).toBeNull();
  });
});

describe('lvrTierForValue', () => {
  it('maps a computed LVR to the band that contains it', () => {
    expect(lvrTierForValue(55, TIERS)).toBe('lvr_=60%');
    expect(lvrTierForValue(60, TIERS)).toBe('lvr_=60%'); // upper-inclusive
    expect(lvrTierForValue(72.5, TIERS)).toBe('lvr_70-80%');
    expect(lvrTierForValue(88, TIERS)).toBe('lvr_85-90%');
    expect(lvrTierForValue(93, TIERS)).toBe('lvr_90-95%');
  });

  it('rejects an LVR above every published band', () => {
    expect(lvrTierForValue(98, TIERS)).toBeNull();
  });

  it('returns null for non-positive / non-finite LVR or when no usable tiers exist', () => {
    expect(lvrTierForValue(0, TIERS)).toBeNull();
    expect(lvrTierForValue(NaN, TIERS)).toBeNull();
    expect(lvrTierForValue(80, ['lvr_unspecified'])).toBeNull();
  });
});

describe('compareLvrTiers', () => {
  it('orders bands from lowest to highest with unranged tiers last', () => {
    const shuffled = ['lvr_70-80%', 'lvr_unspecified', 'lvr_90-95%', 'lvr_=60%', 'lvr_85-90%', 'lvr_60-70%', 'lvr_80-85%'];
    expect([...shuffled].sort(compareLvrTiers)).toEqual(TIERS);
  });
});

describe('lvrTierLabel', () => {
  it('labels payload tiers for display', () => {
    expect(lvrTierLabel('lvr_=60%')).toBe('LVR ≤60%');
    expect(lvrTierLabel('lvr_85-90%')).toBe('LVR 85–90%');
    expect(lvrTierLabel('lvr_unspecified')).toBe('LVR unspecified');
    expect(lvrTierLabel('lvr_>95%')).toBe('LVR over 95%');
    expect(lvrTierLabel('VARIABLE')).toBeNull();
  });

  it('falls back to the generic enum label for unrecognised values', () => {
    expect(lvrTierDisplay('lvr_=60%')).toBe('LVR ≤60%');
    expect(lvrTierDisplay('PRINCIPAL_AND_INTEREST')).toBe('Principal & interest');
    expect(lvrTierDisplay(undefined)).toBe('');
  });
});

describe('refreshLvrLabelText', () => {
  it('rewrites only percentage LVR tokens in the trailing suffix and is idempotent', () => {
    expect(refreshLvrLabelText('Bank · Loan (Variable · LVR =60%)')).toBe('Bank · Loan (Variable · LVR ≤60%)');
    expect(refreshLvrLabelText('Bank · Loan (Fixed · LVR >95%)')).toBe('Bank · Loan (Fixed · LVR over 95%)');
    expect(refreshLvrLabelText('Bank · Loan (Variable · LVR unspecified)')).toBe('Bank · Loan (Variable · LVR unspecified)');
    expect(refreshLvrLabelText('Bank · Loan (Variable · LVR ≤60%)')).toBe('Bank · Loan (Variable · LVR ≤60%)');
    expect(refreshLvrLabelText('Bank · LVR 60% Special')).toBe('Bank · LVR 60% Special');
  });
});
