import type { SectionKey } from '../types';
import { cache } from './cache';
import { resetDetailSearchIndexCache } from './detailSearch';
import {
  addSubscription,
  findSearchSubscription as lookupSearchSubscription,
  isProductSubscribed as productIsSubscribed,
  makeProductSubscription,
  makeSearchSubscription,
  productSubscriptionId,
  removeSubscription as dropSubscription,
  type Subscription,
} from './subscriptions';
import { normalizeInterests, resolveInterestSection } from './interests';
import { debugLog } from '../lib/debugLog';
import { hapticSelection } from '../lib/haptics';
import { clearSuitabilityIndex } from './suitabilityIndex';
import type { AppState, Prefs, StoreGet, StoreSet } from './storeTypes';
import {
  isSavedRate as savedRateExists,
  makeLegacySavedRateRef,
  toggleSavedRateRefs,
} from './savedRates';

export function createUserActions(set: StoreSet, get: StoreGet) {
  return {
    getDetail(productKey: string) {
      return get().details?.products?.[productKey] ?? null;
    },

    toggleFavorite(key: string) {
      const favorites = get().favorites;
      const removing = favorites.includes(key);
      set({
        favorites: removing
          ? favorites.filter((k) => k !== key)
          : [...favorites, key],
        savedRates: removing
          ? get().savedRates.filter((ref) => ref.productKey !== key)
          : [...get().savedRates, makeLegacySavedRateRef(key)],
      });
      hapticSelection();
    },

    isFavorite(key: string) {
      return get().savedRates.some((ref) => ref.productKey === key);
    },

    toggleSavedRate(row: Parameters<AppState['toggleSavedRate']>[0], scope: Parameters<AppState['toggleSavedRate']>[1] = 'rate') {
      const savedRates = toggleSavedRateRefs(get().savedRates, row, scope);
      set({
        savedRates,
        favorites: [...new Set(savedRates.map((item) => item.productKey))],
      });
      hapticSelection();
    },

    removeSavedRate(id: string) {
      const savedRates = get().savedRates.filter((item) => item.id !== id);
      set({
        savedRates,
        favorites: [...new Set(savedRates.map((item) => item.productKey))],
      });
    },

    isRateSaved(productKey: string, rateIndex: number | null) {
      return savedRateExists(get().savedRates, productKey, rateIndex);
    },

    subscribeProduct(productKey: string, rateIndex: number | null, labelRow: Parameters<AppState['subscribeProduct']>[2]) {
      if (productIsSubscribed(get().subscriptions, productKey, rateIndex)) return false;
      set({
        subscriptions: addSubscription(
          get().subscriptions,
          makeProductSubscription(labelRow, rateIndex),
        ),
      });
      return true;
    },

    unsubscribeProduct(productKey: string, rateIndex: number | null) {
      const id = productSubscriptionId(productKey, rateIndex);
      set({ subscriptions: dropSubscription(get().subscriptions, id) });
    },

    subscribeSearch(input: Parameters<AppState['subscribeSearch']>[0]) {
      if (lookupSearchSubscription(get().subscriptions, input)) return false;
      set({
        subscriptions: addSubscription(get().subscriptions, makeSearchSubscription(input)),
      });
      return true;
    },

    unsubscribeSearch(id: string) {
      get().removeSubscription(id);
    },

    removeSubscription(id: string) {
      set({ subscriptions: dropSubscription(get().subscriptions, id) });
    },

    restoreSubscription(sub: Subscription) {
      if (get().subscriptions.some((s) => s.id === sub.id)) return;
      set({ subscriptions: addSubscription(get().subscriptions, sub) });
    },

    isProductSubscribed(productKey: string, rateIndex: number | null) {
      return productIsSubscribed(get().subscriptions, productKey, rateIndex);
    },

    findSearchSubscription(input: Parameters<AppState['findSearchSubscription']>[0]) {
      return lookupSearchSubscription(get().subscriptions, input);
    },

    setActiveSection(section: SectionKey) {
      set({ activeSection: resolveInterestSection(get().prefs.interests, section) });
    },

    setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
      if (key === 'interests') {
        const interests = normalizeInterests(value as SectionKey[]);
        const prefs = { ...get().prefs, interests };
        if (!interests.includes(prefs.defaultSection)) {
          prefs.defaultSection = interests[0];
        }
        set({
          prefs,
          activeSection: resolveInterestSection(interests, get().activeSection),
        });
      } else if (key === 'defaultSection') {
        const section = value as SectionKey;
        const interests = normalizeInterests(get().prefs.interests);
        set({
          prefs: {
            ...get().prefs,
            defaultSection: interests.includes(section) ? section : interests[0],
          },
        });
      } else {
        set({ prefs: { ...get().prefs, [key]: value } });
      }
      if (key === 'enableDeepSearch') {
        if (value) {
          void get().ensureSearchIndex();
          void get().ensureDetails();
        } else {
          set({ searchIndex: null });
        }
      }
      if (key === 'profileFilters') {
        const features = (value as Prefs['profileFilters'])?.accountFeatures;
        if (Array.isArray(features) && features.length > 0) {
          void get().ensureDetails();
        }
      }
      if (key === 'showHistoryRibbon') {
        set({ historyBanksError: null });
        if (value) {
          // Trends + product history screens expect assets immediately after the
          // toggle; do not wait for the next manual refresh.
          void get().ensureHistoryBanks();
          void get().ensureBankInsights();
        }
      }
    },

    completeOnboarding(interests: SectionKey[], notifications: boolean) {
      const normalized = normalizeInterests(interests);
      const defaultSection = normalized[0];
      set({
        activeSection: defaultSection,
        prefs: {
          ...get().prefs,
          onboarded: true,
          interests: normalized,
          defaultSection,
          notificationsEnabled: notifications,
        },
      });
    },

    async clearCache() {
      debugLog.info('store', 'clearCache');
      await cache.clear();
      resetDetailSearchIndexCache();
      clearSuitabilityIndex();
      set({
        core: null,
        details: null,
        searchIndex: null,
        historyBanks: null,
        historyBanksError: null,
        bankInsights: null,
        bankInsightsError: null,
        productHistory: null,
        productHistoryError: null,
        manifest: null,
        status: 'idle',
        source: 'sample',
      });
      await get().bootstrap();
    },

    clearRefreshOutcome() {
      set({ refreshOutcome: null });
    },
  } satisfies Pick<
    AppState,
    | 'getDetail'
    | 'toggleFavorite'
    | 'isFavorite'
    | 'toggleSavedRate'
    | 'removeSavedRate'
    | 'isRateSaved'
    | 'subscribeProduct'
    | 'unsubscribeProduct'
    | 'subscribeSearch'
    | 'unsubscribeSearch'
    | 'removeSubscription'
    | 'restoreSubscription'
    | 'isProductSubscribed'
    | 'findSearchSubscription'
    | 'setPref'
    | 'setActiveSection'
    | 'completeOnboarding'
    | 'clearCache'
    | 'clearRefreshOutcome'
  >;
}
