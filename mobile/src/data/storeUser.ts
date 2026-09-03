import type { LegacyProductAliasMap } from '../contracts/v3/canonicalCoreAdapter';
import type { SectionKey } from '../types';
import { cache } from './cache';
import { resetDetailSearchIndexCache } from './detailSearch';
import {
  addSubscription,
  findSearchSubscription as lookupSearchSubscription,
  isProductSubscribed as productIsSubscribed,
  makeProductSubscription,
  makeSearchSubscription,
  migrateProductSubscriptionAliases,
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
  migrateSavedRateProductAliases,
  toggleSavedRateRefs,
} from './savedRates';
import {
  normalizeTrackedRates,
  queueTrackedRatesSecureSave,
  setTrackedRateDate,
} from './trackedRates';

function persistTrackedRates(value: AppState['trackedRates']): void {
  void queueTrackedRatesSecureSave(value).catch((error) => {
      debugLog.error('tracked-rates', `secure metadata save failed: ${String((error as Error)?.message ?? error)}`);
  });
}

/** Pure persisted-state migration used by the dormant v3 bridge coordinator. */
export function migrateLegacyUserProductKeys(
  savedRates: AppState['savedRates'],
  subscriptions: AppState['subscriptions'],
  aliases: LegacyProductAliasMap,
) {
  const migratedSavedRates = migrateSavedRateProductAliases(savedRates, aliases);
  const migratedSubscriptions = migrateProductSubscriptionAliases(subscriptions, aliases);
  return {
    savedRates: migratedSavedRates,
    favorites: [...new Set(migratedSavedRates.map((ref) => ref.productKey))],
    subscriptions: migratedSubscriptions.subscriptions,
    droppedExactSubscriptionIds: migratedSubscriptions.droppedExactSubscriptionIds,
  };
}

function setPreferences(
  set: StoreSet,
  get: StoreGet,
  values: Partial<Prefs>,
): void {
  const current = get().prefs;
  const changed = new Set(
    (Object.keys(values) as (keyof Prefs)[]).filter(
      (key) => !Object.is(current[key], values[key]),
    ),
  );
  if (changed.size === 0) return;

  const interests = values.interests === undefined
    ? current.interests
    : normalizeInterests(values.interests);
  const requestedDefault = values.defaultSection ?? current.defaultSection;
  const prefs: Prefs = {
    ...current,
    ...values,
    interests,
    defaultSection: interests.includes(requestedDefault) ? requestedDefault : interests[0],
  };
  const partial: Partial<AppState> = { prefs };
  if (changed.has('interests')) {
    partial.activeSection = resolveInterestSection(interests, get().activeSection);
  }
  if (changed.has('enableDeepSearch') && !prefs.enableDeepSearch) {
    partial.searchIndex = null;
    partial.searchIndexStatus = 'idle';
    partial.searchIndexError = null;
  }
  if (changed.has('showHistoryRibbon')) {
    partial.historyBanksError = null;
  }
  set(partial);

  if (changed.has('enableDeepSearch') && prefs.enableDeepSearch) {
    void get().ensureSearchIndex();
    void get().ensureDetails();
  }
  if (
    changed.has('profileFilters') &&
    prefs.profileFilters.accountFeatures.length > 0
  ) {
    void get().ensureDetails();
  }
  if (changed.has('showHistoryRibbon') && prefs.showHistoryRibbon) {
    // Trends + product history screens expect assets immediately after the
    // toggle; do not wait for the next manual refresh.
    void get().ensureHistoryBanks();
    void get().ensureBankInsights();
  }
}

export function createUserActions(set: StoreSet, get: StoreGet) {
  return {
    getDetail(productKey: string) {
      return get().details?.products?.[productKey] ?? null;
    },

    toggleFavorite(key: string) {
      const favorites = get().favorites;
      const removing = favorites.includes(key);
      const savedRates = removing
        ? get().savedRates.filter((ref) => ref.productKey !== key)
        : [...get().savedRates, makeLegacySavedRateRef(key)];
      const trackedRates = normalizeTrackedRates(get().trackedRates, savedRates);
      set({
        favorites: removing ? favorites.filter((k) => k !== key) : [...favorites, key],
        savedRates,
        trackedRates,
      });
      persistTrackedRates(trackedRates);
      hapticSelection();
    },

    isFavorite(key: string) {
      return get().savedRates.some((ref) => ref.productKey === key);
    },

    toggleSavedRate(row: Parameters<AppState['toggleSavedRate']>[0], scope: Parameters<AppState['toggleSavedRate']>[1] = 'rate') {
      const savedRates = toggleSavedRateRefs(get().savedRates, row, scope);
      const trackedRates = normalizeTrackedRates(get().trackedRates, savedRates);
      set({
        savedRates,
        trackedRates,
        favorites: [...new Set(savedRates.map((item) => item.productKey))],
      });
      persistTrackedRates(trackedRates);
      hapticSelection();
    },

    removeSavedRate(id: string) {
      const savedRates = get().savedRates.filter((item) => item.id !== id);
      const trackedRates = normalizeTrackedRates(get().trackedRates, savedRates);
      set({
        savedRates,
        trackedRates,
        favorites: [...new Set(savedRates.map((item) => item.productKey))],
      });
      persistTrackedRates(trackedRates);
    },

    restoreSavedRate(ref: Parameters<AppState['restoreSavedRate']>[0], tracked?: Parameters<AppState['restoreSavedRate']>[1]) {
      if (get().savedRates.some((item) => item.id === ref.id)) return;
      const savedRates = [...get().savedRates, ref];
      const trackedRates = normalizeTrackedRates(
        tracked ? [...get().trackedRates, tracked] : get().trackedRates,
        savedRates,
      );
      set({
        savedRates,
        trackedRates,
        favorites: [...new Set(savedRates.map((item) => item.productKey))],
      });
      persistTrackedRates(trackedRates);
    },

    async setTrackedRateRelevantDate(id: string, relevantDate: string | null, kind: Parameters<AppState['setTrackedRateRelevantDate']>[2]) {
      const previous = get().trackedRates;
      const trackedRates = setTrackedRateDate(previous, id, relevantDate, kind);
      set({ trackedRates });
      try {
        await queueTrackedRatesSecureSave(trackedRates);
      } catch (error) {
        // Only undo this optimistic edit if no newer tracked-rate action has
        // replaced it while the native write was pending.
        if (get().trackedRates === trackedRates) set({ trackedRates: previous });
        throw error;
      }
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
      setPreferences(set, get, { [key]: value } as Partial<Prefs>);
    },

    setPrefs(values: Partial<Prefs>) {
      setPreferences(set, get, values);
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
        coreIntegrity: null,
        coreAssetState: {
          status: 'unavailable',
          data: null,
          reason: 'The local cache was cleared.',
        },
        details: null,
        searchIndex: null,
        searchIndexStatus: 'idle',
        searchIndexError: null,
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
    | 'restoreSavedRate'
    | 'setTrackedRateRelevantDate'
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
    | 'setPrefs'
    | 'setActiveSection'
    | 'completeOnboarding'
    | 'clearCache'
    | 'clearRefreshOutcome'
  >;
}
