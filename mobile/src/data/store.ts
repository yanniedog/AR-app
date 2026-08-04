import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { create } from 'zustand';

import { DEFAULT_INTERESTS, normalizeInterests, resolveInterestSection } from './interests';
import { normalizeProfileFilters } from './profile';
import { normalizeCalcInputs } from './calc';
import { migrateLegacyCalculatorInputs } from './userRateScenario';
import { shouldWarmDetails } from './optionalPrefs';
import { BACKGROUND_TASK } from './notifications';
import { effectiveDeepSearch } from '../lib/proAccess';
import { bootstrapInitialState, createBootstrapActions } from './storeBootstrap';
import { createRefreshActions } from './storeRefresh';
import { createEnsureActions } from './storeEnsure';
import { createUserActions } from './storeUser';
import { DEFAULT_PREFS, type AppState } from './storeTypes';
import type { SectionKey } from '../types';

// Expo/Metro emits Zustand's ESM middleware `import.meta.env` checks into a
// classic web script. Use the package's CommonJS condition until upstream's
// React Native Web build no longer requires this compatibility path.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createJSONStorage, persist } = require('zustand/middleware') as typeof import('zustand/middleware');

export { shouldWarmDetails } from './optionalPrefs';
export type { Prefs, Status } from './storeTypes';
export { DEFAULT_PREFS } from './storeTypes';

type StoreApi = {
  persist?: { rehydrate?: () => void | Promise<void> };
  getState: () => AppState;
};

const storeRef: { current: StoreApi | null } = { current: null };

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...bootstrapInitialState,
      ...createBootstrapActions(set, get, () => storeRef.current!),
      ...createRefreshActions(set, get),
      ...createEnsureActions(set, get),
      ...createUserActions(set, get),
    }),
    {
      name: 'ar-rates',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        prefs: Object.fromEntries(
          Object.entries(s.prefs).filter(([key]) =>
            key !== 'calc' && key !== 'diagnosticsEnabled' && key !== 'rateIntelligencePro'),
        ) as AppState['prefs'],
        favorites: s.favorites,
        subscriptions: s.subscriptions,
        activeSection: s.activeSection,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<AppState> | undefined;
        const persistedPrefs = p?.prefs as Partial<AppState['prefs']> | undefined;
        const hasCurrentPrivacyChoice = persistedPrefs?.privacyChoiceVersion === 1;
        const prefs = {
          ...DEFAULT_PREFS,
          ...persistedPrefs,
          // The old combined diagnostics flag was on by default and was not
          // informed, granular consent. Never migrate it to either collector.
          crashReportsEnabled:
            hasCurrentPrivacyChoice && persistedPrefs?.crashReportsEnabled === true,
          sessionReplayEnabled:
            hasCurrentPrivacyChoice && persistedPrefs?.sessionReplayEnabled === true,
          privacyChoiceVersion: hasCurrentPrivacyChoice ? 1 : 0,
          diagnosticsEnabled: false,
          apkUpdatesWifiOnly: persistedPrefs?.apkUpdatesWifiOnly !== false,
          interests: normalizeInterests(persistedPrefs?.interests ?? DEFAULT_INTERESTS),
          profileFilters: normalizeProfileFilters(persistedPrefs?.profileFilters),
          calc: normalizeCalcInputs(persistedPrefs?.calc),
        };
        const persistedActiveSection = p?.activeSection;
        const isValidActiveSection =
          typeof persistedActiveSection === 'string' &&
          prefs.interests.includes(persistedActiveSection as SectionKey);
        const activeSection = isValidActiveSection
          ? (persistedActiveSection as SectionKey)
          : resolveInterestSection(prefs.interests, prefs.defaultSection);
        return {
          ...current,
          ...p,
          prefs,
          activeSection,
        };
      },
      onRehydrateStorage: () => () => {
        const legacyCalc = useStore.getState().prefs.calc;
        void migrateLegacyCalculatorInputs(legacyCalc);
        useStore.setState({ hydrated: true });
      },
    },
  ),
);

storeRef.current = useStore;

try {
  if (typeof TaskManager.isTaskDefined === 'function' && !TaskManager.isTaskDefined(BACKGROUND_TASK)) {
    TaskManager.defineTask(BACKGROUND_TASK, async () => {
      try {
        try {
          await useStore.persist?.rehydrate?.();
        } catch {
          // proceed with defaults if rehydrate fails
        }
        await useStore.getState().ensureCoreLoaded();
        const state = useStore.getState();
        if (shouldWarmDetails(state.prefs, state.subscriptions)) {
          await state.ensureDetails();
        }
        if (effectiveDeepSearch(state.prefs)) await state.ensureSearchIndex();
        const changed = await useStore.getState().refresh({});
        return changed
          ? BackgroundFetch.BackgroundFetchResult.NewData
          : BackgroundFetch.BackgroundFetchResult.NoData;
      } catch {
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });
  }
} catch {
  // TaskManager unavailable (e.g. web / test env) — background refresh is optional.
}
