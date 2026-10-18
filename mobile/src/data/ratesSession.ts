import { create } from 'zustand';
import { SECTION_ORDER } from '../constants';
import type { SectionKey } from '../types';
import { EMPTY_FILTERS, type Filters, type SortKey } from './selectors';
import type { Prefs } from './storeTypes';
import { PROFILE_GROUPS, profileFeaturesForSection } from './profile';

export type RateAvailability = 'listed' | 'unlisted';
export interface RatesSectionState {
  query: string;
  path: string[];
  hierarchyScoped: boolean;
  sort: SortKey;
  filters: Filters;
  includeNonStandardOverride: boolean | null;
  availability: RateAvailability;
  selectMode: boolean;
  selected: string[];
  scrollOffset: number;
  page: number;
  preferenceKey: string;
  intentError: string | null;
}
export interface RatesSessionSnapshot {
  initialized: boolean;
  section: SectionKey;
  sections: Record<SectionKey, RatesSectionState>;
}
const emptySection = (): RatesSectionState => ({
  query: '', path: [], hierarchyScoped: false, sort: 'rate',
  filters: { ...EMPTY_FILTERS }, includeNonStandardOverride: null,
  availability: 'listed', selectMode: false, selected: [], scrollOffset: 0, page: 1, preferenceKey: '', intentError: null,
});
const initial = (): RatesSessionSnapshot => ({ initialized: false, section: 'Mortgage',
  sections: { Mortgage: emptySection(), Savings: emptySection(), TD: emptySection() } });
/** Ephemeral task state: never persisted, logged or sent to a provider. */
export const useRatesSession = create<RatesSessionSnapshot>(() => initial());
let restoreRevision = 0;
/** Explicit snapshot restoration can change scroll on the same data/page. */
export function getRatesSessionRestoreRevision(): number { return restoreRevision; }
function preferenceKey(prefs: Prefs, section: SectionKey): string {
  return JSON.stringify([prefs.includeNonStandard, prefs.ratesPageSize, section === 'Mortgage' ? prefs.mortgageRateMetric : prefs.depositRankMetric,
    PROFILE_GROUPS.filter(group => group.section === section).map(group => prefs.profileFilters[group.key]),
    profileFeaturesForSection(prefs.profileFilters, section)]);
}
export function initializeRatesSession(prefs: Prefs, section: SectionKey): void {
  if (useRatesSession.getState().initialized) return;
  const sections = Object.fromEntries(SECTION_ORDER.map(key => [key, {
    // Saved requirements already apply globally through mandatory eligibility.
    // Copying them here creates stale duplicates that survive profile edits.
    ...emptySection(), preferenceKey: preferenceKey(prefs, key),
  }])) as RatesSessionSnapshot['sections'];
  useRatesSession.setState({ initialized: true, section, sections });
}
/** Saved scope/ranking changes reset affected pages without altering temporary choices. */
export function syncRatesPreferences(prefs: Prefs): void {
  const current = useRatesSession.getState();
  if (!current.initialized) return;
  const sections = { ...current.sections };
  let changed = false;
  for (const section of SECTION_ORDER) {
    const key = preferenceKey(prefs, section);
    if (sections[section].preferenceKey === key) continue;
    sections[section] = { ...sections[section], preferenceKey: key, page: 1, scrollOffset: 0 };
    changed = true;
  }
  if (changed) useRatesSession.setState({ sections });
}
export function changeRatesSection(section: SectionKey): void {
  useRatesSession.setState({ section });
}
export function updateRatesSection(section: SectionKey,
  update: Partial<RatesSectionState> | ((current: RatesSectionState) => Partial<RatesSectionState>),
  resetOffset = false): void {
  const current = useRatesSession.getState();
  const value = current.sections[section];
  const patch = typeof update === 'function' ? update(value) : update;
  const resultKeys = ['query', 'path', 'hierarchyScoped', 'sort', 'filters', 'availability',
    'includeNonStandardOverride', 'intentError'] as const;
  const changed = resultKeys.some(key => key in patch && JSON.stringify(value[key]) !== JSON.stringify(patch[key]));
  const page = changed ? 1 : patch.page ?? value.page;
  useRatesSession.setState({ sections: { ...current.sections,
    [section]: { ...value, ...patch, page, ...(resetOffset || page !== value.page ? { scrollOffset: 0 } : {}) } } });
}
/** Native scroll events update the owner without waking every result subscriber. */
export function recordRatesScroll(section: SectionKey, offset: number): void {
  if (!Number.isFinite(offset) || offset < 0) return;
  useRatesSession.getState().sections[section].scrollOffset = offset;
}
export function captureRatesSession(): RatesSessionSnapshot {
  return JSON.parse(JSON.stringify(useRatesSession.getState())) as RatesSessionSnapshot;
}
/** Restoring wakes mounted subscribers; audit cleanup restores this before navigation. */
export function restoreRatesSession(snapshot: RatesSessionSnapshot): void {
  restoreRevision++;
  useRatesSession.setState(JSON.parse(JSON.stringify(snapshot)) as RatesSessionSnapshot, true);
}
