import { DEFAULT_PREFS } from '../src/data/store';
import {
  effectiveBankInsights,
  effectiveDeepSearch,
  effectiveHistoryRibbon,
} from '../src/lib/proAccess';

describe('feature availability', () => {
  it('ships deep search and history on by default', () => {
    expect(DEFAULT_PREFS.enableDeepSearch).toBe(true);
    expect(DEFAULT_PREFS.showHistoryRibbon).toBe(true);
    expect(effectiveDeepSearch(DEFAULT_PREFS)).toBe(true);
    expect(effectiveHistoryRibbon(DEFAULT_PREFS)).toBe(true);
  });

  it('follows the user preference when a feature is turned off', () => {
    expect(effectiveDeepSearch({ ...DEFAULT_PREFS, enableDeepSearch: false })).toBe(false);
    expect(effectiveHistoryRibbon({ ...DEFAULT_PREFS, showHistoryRibbon: false })).toBe(false);
  });

  it('always makes bank insights available', () => {
    expect(effectiveBankInsights()).toBe(true);
  });
});
