import { APP_ICON_MAP } from '../src/components/icons/AppIcon';

describe('Rate Ledger app icon bridge', () => {
  it('maps every retained control vocabulary entry to local semantic geometry', () => {
    expect(Object.keys(APP_ICON_MAP).length).toBeGreaterThanOrEqual(60);
    expect(Object.values(APP_ICON_MAP).every(Boolean)).toBe(true);
  });

  it('keeps core rate concepts distinct', () => {
    expect(APP_ICON_MAP.home).toBe('home');
    expect(APP_ICON_MAP.wallet).toBe('wallet');
    expect(APP_ICON_MAP.time).toBe('time');
    expect(APP_ICON_MAP['git-compare']).toBe('compare');
    expect(APP_ICON_MAP['shield-checkmark-outline']).toBe('shield');
    expect(APP_ICON_MAP.star).toBe('star-filled');
    expect(APP_ICON_MAP['star-outline']).toBe('star');
  });
});
