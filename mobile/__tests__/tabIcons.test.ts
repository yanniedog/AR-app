import { M3_NAV_BAR_HEIGHT } from '../src/lib/androidChrome';
import {
  getTabLedgerIcon,
  getTabLabel,
  isTabRouteName,
  TAB_ROUTES,
} from '../src/lib/tabIcons';

describe('tabIcons', () => {
  it.each([
    ['browse', 'Rates', 'search'],
    ['watchlist', 'Saved', 'star'],
    ['market', 'Market', 'changes'],
  ])('maps canonical %s to its visible label and semantic icon', (route, label, icon) => {
    expect(isTabRouteName(route)).toBe(true);
    expect(getTabLabel(route)).toBe(label);
    expect(getTabLedgerIcon(route)).toBe(icon);
  });

  it('returns undefined for unknown routes and retains the supplied label fallback', () => {
    expect(getTabLedgerIcon('unknown')).toBeUndefined();
    expect(getTabLabel('unknown', 'Fallback')).toBe('Fallback');
    expect(getTabLabel('unknown')).toBe('unknown');
  });

  it('contains exactly the three primary destinations in display order', () => {
    expect(TAB_ROUTES).toEqual(['browse', 'watchlist', 'market']);
  });

  it.each(['index', 'tools', 'trends'])('keeps legacy %s outside the visible tab contract', (route) => {
    expect(isTabRouteName(route)).toBe(false);
    expect(getTabLedgerIcon(route)).toBeUndefined();
    expect(getTabLabel(route, 'Legacy')).toBe('Legacy');
    expect(TAB_ROUTES).not.toContain(route);
  });
});

describe('androidChrome', () => {
  it('exports M3 navigation bar height', () => {
    expect(M3_NAV_BAR_HEIGHT).toBe(80);
  });
});
