import { DEFAULT_PREFS } from '../src/data/store';
import type { Subscription } from '../src/data/subscriptions';
import {
  canAddAlertSubscription,
  effectiveBankInsights,
  effectiveDeepSearch,
  effectiveHistoryRibbon,
  FREE_ALERT_SLOTS,
  hasProAccess,
  proGateCopy,
} from '../src/lib/proAccess';

const productSub: Subscription = {
  id: 'product:a:1',
  kind: 'product',
  productKey: 'a',
  rateIndex: 1,
  label: 'Test',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('free beta access', () => {
  it('ignores the deprecated local entitlement flag', () => {
    expect(DEFAULT_PREFS.rateIntelligencePro).toBe(false);
    expect(hasProAccess(DEFAULT_PREFS)).toBe(true);
    expect(FREE_ALERT_SLOTS).toBe(Number.POSITIVE_INFINITY);
  });

  it('uses only the user feature preferences', () => {
    const prefs = { ...DEFAULT_PREFS, enableDeepSearch: true, showHistoryRibbon: true };
    expect(effectiveDeepSearch(prefs)).toBe(true);
    expect(effectiveHistoryRibbon(prefs)).toBe(true);
    expect(effectiveDeepSearch({ ...prefs, enableDeepSearch: false })).toBe(false);
    expect(effectiveHistoryRibbon({ ...prefs, showHistoryRibbon: false })).toBe(false);
  });

  it('includes bank insights in the free beta', () => {
    expect(effectiveBankInsights(DEFAULT_PREFS)).toBe(true);
  });

  it('does not apply a fake local alert purchase limit', () => {
    expect(canAddAlertSubscription([], DEFAULT_PREFS)).toBe(true);
    expect(canAddAlertSubscription([productSub], DEFAULT_PREFS)).toBe(true);
  });

  it('uses free-beta information copy without purchase claims', () => {
    expect(proGateCopy('alert_limit').bullets.length).toBeGreaterThan(0);
    expect(proGateCopy('deep_search').title).toMatch(/free beta/i);
    expect(proGateCopy('alert_limit').body).not.toMatch(/upgrade|purchase/i);
    expect(proGateCopy('history_ribbon').bullets.some((b) => /history/i.test(b))).toBe(true);
    expect(proGateCopy('bank_insights').bullets.some((b) => /RBA pass-through/i.test(b))).toBe(true);
  });
});
