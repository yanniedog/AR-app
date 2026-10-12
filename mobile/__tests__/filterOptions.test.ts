import { FILTER_OPTION_LIMIT, matchingLenders, visibleFilterOptions } from '../src/lib/filterOptions';

const options = Array.from({ length: 30 }, (_, index) => `opt${index}`);

describe('filter option visibility', () => {
  it('shows short groups in full', () => {
    expect(visibleFilterOptions(['a', 'b'], [], false)).toEqual({ visible: ['a', 'b'], hidden: 0 });
  });

  it('collapses long groups and reports how many are hidden', () => {
    const { visible, hidden } = visibleFilterOptions(options, [], false);
    expect(visible).toHaveLength(FILTER_OPTION_LIMIT);
    expect(hidden).toBe(30 - FILTER_OPTION_LIMIT);
  });

  it('keeps a selection beyond the limit visible, in its original position', () => {
    const { visible, hidden } = visibleFilterOptions(options, ['opt28'], false);
    expect(visible).toHaveLength(FILTER_OPTION_LIMIT + 1);
    expect(visible[visible.length - 1]).toBe('opt28');
    expect(hidden).toBe(30 - FILTER_OPTION_LIMIT - 1);
  });

  it('shows every option once expanded', () => {
    expect(visibleFilterOptions(options, [], true)).toEqual({ visible: options, hidden: 0 });
  });
});

describe('lender search', () => {
  const lenders = ['NATIONAL AUSTRALIA BANK', 'ING', 'gmcu', 'Bank Australia'];

  it('matches without regard to case and ignores surrounding spaces', () => {
    expect(matchingLenders(lenders, '  australia ', [])).toEqual(['NATIONAL AUSTRALIA BANK', 'Bank Australia']);
    expect(matchingLenders(lenders, 'GMCU', [])).toEqual(['gmcu']);
  });

  it('returns every lender for an empty query', () => {
    expect(matchingLenders(lenders, '', [])).toEqual(lenders);
  });

  it('keeps selected lenders listed so they can be cleared', () => {
    expect(matchingLenders(lenders, 'australia', ['ING'])).toEqual(['NATIONAL AUSTRALIA BANK', 'ING', 'Bank Australia']);
  });
});
