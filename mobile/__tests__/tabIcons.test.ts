import { M3_NAV_BAR_HEIGHT } from '../src/lib/androidChrome';
import {
  getTabIonicon,
  getTabLabel,
  getTabMaterialSymbol,
  TAB_MATERIAL_SYMBOLS,
  TAB_ROUTES,
} from '../src/lib/tabIcons';

describe('tabIcons', () => {
  it('maps every tab route to a material symbol and ionicon', () => {
    for (const route of TAB_ROUTES) {
      expect(getTabMaterialSymbol(route)).toBe(TAB_MATERIAL_SYMBOLS[route]);
      expect(getTabIonicon(route)).toBeTruthy();
      expect(getTabLabel(route)).toBeTruthy();
    }
  });

  it('returns undefined for unknown routes', () => {
    expect(getTabMaterialSymbol('unknown')).toBeUndefined();
    expect(getTabIonicon('unknown')).toBeUndefined();
    expect(getTabLabel('unknown', 'Fallback')).toBe('Fallback');
  });

  it('presents the macro and market analysis destination as Outlook', () => {
    expect(getTabLabel('trends')).toBe('Outlook');
  });

  it('uses decision-oriented labels for the primary navigation', () => {
    expect(getTabLabel('index')).toBe('Today');
    expect(getTabLabel('browse')).toBe('Products');
    expect(getTabLabel('passthrough')).toBe('Moves');
    expect(getTabLabel('watchlist')).toBe('Saved');
    expect(getTabLabel('settings')).toBe('Settings');
  });

  it('lists Settings as the final primary tab', () => {
    expect(TAB_ROUTES.at(-1)).toBe('settings');
    expect(TAB_ROUTES).toEqual([
      'index',
      'browse',
      'passthrough',
      'trends',
      'watchlist',
      'settings',
    ]);
  });
});

describe('androidChrome', () => {
  it('exports M3 navigation bar height', () => {
    expect(M3_NAV_BAR_HEIGHT).toBe(80);
  });
});
