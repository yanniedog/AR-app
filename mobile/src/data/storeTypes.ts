import { RATE_MOVE_BPS_THRESHOLD } from '../config';
import type {
  CorePayload,
  DetailsPayload,
  Manifest,
  PayloadSource,
  ProductDetail,
  RateRow,
  SectionKey,
} from '../types';
import type { PayloadProgressSnapshot } from './downloadProgress';
import type { FilterSnapshot, Subscription } from './subscriptions';
import type { SearchIndexPayload } from './detailSearch';
import type { BankInsightsPayload } from './bankInsights';
import type { BankSpreadHistoryPayload } from './bankSpreadHistory';
import type { RbaCalendar } from './rbaCalendar';
import type { HistoryBanksPayload } from './historyPayload';
import type { ProductHistoryPayload, ProductHistoryPurpose } from './productHistory';
import { DEFAULT_INTERESTS } from './interests';
import { EMPTY_PROFILE, type ProfileFilters } from './profile';
import { EMPTY_CALC, type CalcInputs } from './calc';
import type { ThemeMode } from '../theme/theme';
import type { RefreshOutcomeKind } from '../components/bannerState';
import type { SavedRateRef } from './savedRates';
import type { TrackedRate, TrackedRateDateKind } from './trackedRates';
import type { SortKey } from './selectors';
import type { AssetState } from './assetState';
import type { CoreIntegrityContext } from './sectionIntegrity';

export interface Prefs {
  themeMode: ThemeMode;
  defaultSection: SectionKey;
  notificationsEnabled: boolean;
  /** Firebase Crashlytics collection. Preselected, but dormant until the privacy choice is confirmed. */
  crashReportsEnabled: boolean;
  /** Legacy persisted replay choice; runtime collection is permanently disabled. */
  sessionReplayEnabled: boolean;
  /** Consent-copy version accepted by the user (0 means no current consent). */
  privacyChoiceVersion: number;
  /** @deprecated Legacy combined toggle, retained only so old persisted state can be migrated. */
  diagnosticsEnabled?: boolean;
  wifiOnly: boolean;
  /** APK downloads are Wi-Fi only by default, independent of daily rates refreshes. */
  apkUpdatesWifiOnly: boolean;
  /** Explicit standing consent to download verified APK updates after an automatic check. */
  apkUpdatesAutoDownload: boolean;
  includeNonStandard: boolean;
  /** How savings & term-deposit lists rank: 'base' ongoing rate (default, honest)
   *  vs 'max' headline/bonus rate. Mirrors RankMetric in data/selectors. */
  depositRankMetric: 'base' | 'max';
  /** How home-loan lists rank when sorting by rate: advertised headline vs
   *  fee-inclusive comparison rate. Mirrors MortgageRateMetric in data/selectors. */
  mortgageRateMetric: 'headline' | 'comparison';
  /** Marks the one-time comparison-rate default migration. */
  mortgageRatePreferenceVersion: number;
  /** Fulltext search across product info (off by default). */
  enableDeepSearch: boolean;
  /** Section market-history charts in Outlook (off by default). */
  showHistoryRibbon: boolean;
  /** Rate Intelligence Pro — local stub until store IAP is wired. */
  rateIntelligencePro: boolean;
  onboarded: boolean;
  interests: SectionKey[];
  rateMoveThresholdBps: number;
  /** APK build_number whose update banner the user dismissed (null = none). */
  dismissedUpdateBuild: string | null;
  /** Require fingerprint/Face ID (with device-credential fallback) on app start. */
  appLockEnabled: boolean;
  /** Saved product profile — default filters applied across the app. */
  profileFilters: ProfileFilters;
  /** Persisted mortgage/savings calculator inputs (so the calc remembers your situation). */
  calc: CalcInputs;
}

export const CURRENT_PRIVACY_CHOICE_VERSION = 2;
export const CURRENT_MORTGAGE_RATE_PREFERENCE_VERSION = 1;

export function migratedMortgageRatePreference(
  persisted?: Partial<Prefs>,
): Pick<Prefs, 'mortgageRateMetric' | 'mortgageRatePreferenceVersion'> {
  const migrated =
    persisted?.mortgageRatePreferenceVersion === CURRENT_MORTGAGE_RATE_PREFERENCE_VERSION;
  return {
    mortgageRateMetric:
      migrated && (persisted?.mortgageRateMetric === 'headline' || persisted.mortgageRateMetric === 'comparison')
        ? persisted.mortgageRateMetric
        : 'comparison',
    mortgageRatePreferenceVersion: CURRENT_MORTGAGE_RATE_PREFERENCE_VERSION,
  };
}

export const DEFAULT_PREFS: Prefs = {
  themeMode: 'system',
  defaultSection: 'Mortgage',
  notificationsEnabled: false,
  // Off until the consent banner records an explicit tap — nothing is collected
  // before the user has actually chosen.
  crashReportsEnabled: false,
  sessionReplayEnabled: false,
  privacyChoiceVersion: 0,
  diagnosticsEnabled: false,
  wifiOnly: false,
  apkUpdatesWifiOnly: true,
  apkUpdatesAutoDownload: false,
  includeNonStandard: false,
  depositRankMetric: 'base',
  mortgageRateMetric: 'comparison',
  mortgageRatePreferenceVersion: CURRENT_MORTGAGE_RATE_PREFERENCE_VERSION,
  // Both are free. Ship them on so charts, history, and fee/feature search are
  // discoverable without a trip to Settings.
  enableDeepSearch: true,
  showHistoryRibbon: true,
  rateIntelligencePro: false,
  onboarded: false,
  interests: [...DEFAULT_INTERESTS],
  rateMoveThresholdBps: RATE_MOVE_BPS_THRESHOLD,
  dismissedUpdateBuild: null,
  appLockEnabled: false,
  profileFilters: { ...EMPTY_PROFILE },
  calc: { ...EMPTY_CALC },
};

export type Status = 'idle' | 'loading' | 'ready' | 'error';
export type OptionalAssetLoadStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';

export interface AppState {
  status: Status;
  refreshing: boolean;
  /** Heavy optional-data and suitability warm work still awaited by refresh(). */
  postRefreshWarming: boolean;
  source: PayloadSource;
  manifest: Manifest | null;
  core: CorePayload | null;
  /** Explicit trust/provenance carried with the exact normalized core object. */
  coreIntegrity: CoreIntegrityContext | null;
  coreAssetState: AssetState<CoreIntegrityContext>;
  details: DetailsPayload | null;
  searchIndex: SearchIndexPayload | null;
  searchIndexStatus: OptionalAssetLoadStatus;
  /** Bounded user-facing reason; raw download errors stay in the local log. */
  searchIndexError: string | null;
  historyBanks: HistoryBanksPayload | null;
  /** Set when optional history payload download/parse fails (pref may stay on). */
  historyBanksError: string | null;
  /** Per-bank history + rate-move events (Pro bank intelligence). */
  bankInsights: BankInsightsPayload | null;
  bankInsightsError: string | null;
  bankSpreadHistory: BankSpreadHistoryPayload | null;
  bankSpreadHistoryError: string | null;
  /** RBA decision calendar + forward schedule for the countdown (in-memory only). */
  rbaCalendar: RbaCalendar | null;
  rbaCalendarSha: string | null;
  rbaCalendarError: string | null;
  /** Per-product representative rate over time (derived on-device from dated cores). */
  productHistory: ProductHistoryPayload | null;
  productHistoryError: string | null;
  detailsLoading: boolean;
  error: string | null;
  offline: boolean;
  lastCheckedAt: string | null;
  /** Live payload fetch metrics while upgrading from bundled sample. */
  payloadProgress: PayloadProgressSnapshot | null;
  /** Transient snackbar after refresh completes (success / failure / Wi-Fi skip). */
  refreshOutcome: RefreshOutcomeKind | null;
  /**
   * Rolling GH run_date that is still uploading. App keeps the last finalized
   * day fully usable until dates-index lists this date.
   */
  pendingIngestRunDate: string | null;
  /** True once persisted prefs/favorites have rehydrated from AsyncStorage. */
  hydrated: boolean;
  /** Last-selected product section; synced across Home and Browse. */
  activeSection: SectionKey;

  prefs: Prefs;
  /** Versioned saved variants. `favorites` is retained only for persisted-state compatibility. */
  savedRates: SavedRateRef[];
  /** Versioned local metadata for saved product/tier identities. */
  trackedRates: TrackedRate[];
  /** @deprecated Use savedRates. */
  favorites: string[];
  subscriptions: Subscription[];

  bootstrap: (opts?: { skipRefresh?: boolean }) => Promise<void>;
  retryDataLoad: () => Promise<void>;
  loadSampleFallback: () => Promise<void>;
  /** Load core/manifest from disk cache if not already in memory (used by the headless task). */
  ensureCoreLoaded: () => Promise<void>;
  refresh: (opts?: {
    manual?: boolean;
    repairCache?: boolean;
    /** Keep OS-scheduled work bounded: core install + notification diff only. */
    background?: boolean;
  }) => Promise<boolean>;
  ensureDetails: (opts?: {
    forProductView?: boolean;
    force?: boolean;
    abandonInFlight?: boolean;
  }) => Promise<void>;
  ensureSearchIndex: () => Promise<void>;
  ensureHistoryBanks: (opts?: { force?: boolean }) => Promise<void>;
  ensureBankInsights: (opts?: { force?: boolean }) => Promise<void>;
  ensureBankSpreadHistory: (opts?: { force?: boolean }) => Promise<void>;
  ensureRbaCalendar: () => Promise<void>;
  ensureProductHistory: (opts?: {
    force?: boolean;
    purpose?: ProductHistoryPurpose;
  }) => Promise<void>;
  retryHistoryBanks: () => Promise<void>;
  retryBankInsights: () => Promise<void>;
  retryBankSpreadHistory: () => Promise<void>;
  getDetail: (productKey: string) => ProductDetail | null;
  toggleFavorite: (key: string) => void;
  isFavorite: (key: string) => boolean;
  toggleSavedRate: (row: RateRow, scope?: SavedRateRef['scope']) => void;
  removeSavedRate: (id: string) => void;
  restoreSavedRate: (ref: SavedRateRef, tracked?: TrackedRate | null) => void;
  setTrackedRateRelevantDate: (
    id: string,
    relevantDate: string | null,
    kind: TrackedRateDateKind | null,
  ) => Promise<void>;
  isRateSaved: (productKey: string, rateIndex: number | null) => boolean;
  subscribeProduct: (productKey: string, rateIndex: number | null, labelRow: RateRow) => boolean;
  unsubscribeProduct: (productKey: string, rateIndex: number | null) => void;
  subscribeSearch: (input: {
    section: SectionKey;
    path: string[];
    hierarchyScoped: boolean;
    query: string;
    sort?: SortKey;
    filters: FilterSnapshot;
  }) => boolean;
  unsubscribeSearch: (id: string) => void;
  removeSubscription: (id: string) => void;
  restoreSubscription: (sub: Subscription) => void;
  isProductSubscribed: (productKey: string, rateIndex: number | null) => boolean;
  findSearchSubscription: (input: {
    section: SectionKey;
    path: string[];
    hierarchyScoped: boolean;
    query: string;
    sort?: SortKey;
    filters: FilterSnapshot;
  }) => Subscription | undefined;
  setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
  setPrefs: (values: Partial<Prefs>) => void;
  setActiveSection: (section: SectionKey) => void;
  completeOnboarding: (interests: SectionKey[], notifications: boolean) => void;
  clearCache: () => Promise<void>;
  clearRefreshOutcome: () => void;
}

export type StoreSet = (
  partial: Partial<AppState> | ((state: AppState) => Partial<AppState>),
) => void;
export type StoreGet = () => AppState;
