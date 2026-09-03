import {
  isRateLabelRankedForEveryEntry,
  showCompactDetailRow,
  usesCompactCompareLayout,
} from '../src/lib/comparePresentation';

describe('compact comparison rate fields', () => {
  it('suppresses only the current card ranked field in a mixed comparison', () => {
    const mixedRankedLabels = ['Advertised rate', 'Ongoing rate'];

    expect(isRateLabelRankedForEveryEntry('Advertised rate', mixedRankedLabels)).toBe(false);
    expect(isRateLabelRankedForEveryEntry('Ongoing rate', mixedRankedLabels)).toBe(false);
    expect(showCompactDetailRow('Advertised rate', 'Ongoing rate', false)).toBe(true);
    expect(showCompactDetailRow('Ongoing rate', 'Ongoing rate', true)).toBe(false);
    expect(showCompactDetailRow('Advertised rate', 'Advertised rate', true)).toBe(false);
    expect(showCompactDetailRow('Ongoing rate', 'Advertised rate', false)).toBe(true);
  });

  it('removes a globally redundant ranked field when every entry uses it', () => {
    expect(isRateLabelRankedForEveryEntry(
      'Advertised rate',
      ['Advertised rate', 'Advertised rate'],
    )).toBe(true);
  });
});

describe('comparison layout accessibility', () => {
  it('uses naturally-sized cards when text is enlarged', () => {
    expect(usesCompactCompareLayout(1_024, 1)).toBe(false);
    expect(usesCompactCompareLayout(1_024, 1.3)).toBe(true);
    expect(usesCompactCompareLayout(390, 1)).toBe(true);
  });
});
