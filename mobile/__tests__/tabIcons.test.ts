import { M3_NAV_BAR_HEIGHT } from '../src/lib/androidChrome';
import {
  getTabLedgerIcon,
  getTabLabel,
  TAB_ROUTES,
} from '../src/lib/tabIcons';

describe('tabIcons', () => {
  it('maps every compatibility tab route to a labelled icon', () => {
    for (const route of TAB_ROUTES) {
      expect(getTabLedgerIcon(route)).toBeTruthy();
      expect(getTabLabel(route)).toBeTruthy();
    }
  });

  it('returns undefined for unknown routes', () => {
    expect(getTabLedgerIcon('unknown')).toBeUndefined();
    expect(getTabLabel('unknown', 'Fallback')).toBe('Fallback');
  });

  it('uses plain-language labels a first-time user can guess', () => {
    expect(getTabLabel('index')).toBe('Today');
    expect(getTabLabel('browse')).toBe('Explore');
    expect(getTabLabel('passthrough')).toBe('Changes');
    expect(getTabLabel('watchlist')).toBe('My rates');
  });

  it('contains only the four primary destinations', () => {
    expect(TAB_ROUTES).toEqual([
      'index',
      'browse',
      'passthrough',
      'watchlist',
    ]);
  });
});

describe('androidChrome', () => {
  it('exports M3 navigation bar height', () => {
    expect(M3_NAV_BAR_HEIGHT).toBe(80);
  });
});
