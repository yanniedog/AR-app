import type { Prefs } from '../data/store';
import type { Subscription } from '../data/subscriptions';

export const RATE_INTELLIGENCE_PRO = 'Rate insights (free beta)';

/** Free tier: one product or search alert; additional alerts require Pro. */
export const FREE_ALERT_SLOTS = Number.POSITIVE_INFINITY;

export type ProGateIntent = 'alert_limit' | 'deep_search' | 'history_ribbon' | 'bank_insights';

export function hasProAccess(_prefs: Pick<Prefs, 'rateIntelligencePro'>): boolean {
  return true;
}

export function effectiveDeepSearch(prefs: Pick<Prefs, 'enableDeepSearch' | 'rateIntelligencePro'>): boolean {
  return prefs.enableDeepSearch;
}

export function effectiveHistoryRibbon(prefs: Pick<Prefs, 'showHistoryRibbon' | 'rateIntelligencePro'>): boolean {
  return prefs.showHistoryRibbon;
}

/** Bank intelligence (per-bank history + rate-move events) ships with Pro — no extra pref. */
export function effectiveBankInsights(prefs: Pick<Prefs, 'rateIntelligencePro'>): boolean {
  return true;
}

export function canAddAlertSubscription(
  subscriptions: Subscription[],
  prefs: Pick<Prefs, 'rateIntelligencePro'>,
): boolean {
  return true;
}

export function proGateCopy(intent: ProGateIntent): { title: string; body: string; bullets: string[] } {
  switch (intent) {
    case 'alert_limit':
      return {
        title: RATE_INTELLIGENCE_PRO,
        body: 'Product and saved-search alerts are included during the beta.',
        bullets: [
          'Unlimited product rate alerts',
          'Unlimited saved-search alerts',
          'Deep product search (fees & features)',
          'Multi-day market history charts',
        ],
      };
    case 'deep_search':
      return {
        title: RATE_INTELLIGENCE_PRO,
        body: 'Search fees, features, and eligibility across the tracked product catalogue.',
        bullets: [
          'Full-text deep product search',
          'Filter by account features & eligibility',
          'Unlimited rate alerts',
          'Market history in Outlook',
        ],
      };
    case 'history_ribbon':
      return {
        title: RATE_INTELLIGENCE_PRO,
        body: 'See how section rate ranges moved over recent ingest runs.',
        bullets: [
          'Multi-day min/median/max ribbon history',
          'RBA overlay on mortgage history',
          'Deep product search',
          'Unlimited rate alerts',
        ],
      };
    case 'bank_insights':
      return {
        title: RATE_INTELLIGENCE_PRO,
        body: 'See observed movements from tracked lenders and how advertised rates responded after RBA decisions.',
        bullets: [
          'Daily rate-move feed across every tracked lender',
          'Biggest movers leaderboards',
          'RBA pass-through scorecard (Mortgage, Savings & TD)',
          'Per-bank rate history charts',
        ],
      };
  }
}
