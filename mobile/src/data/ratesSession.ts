import { create } from 'zustand';
import { SECTION_ORDER } from '../constants';
import type { SectionKey } from '../types';
import { EMPTY_FILTERS, type Filters, type SortKey } from './selectors';
import { profileToFilters } from './profile';
import type { Prefs } from './storeTypes';

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
  availability: 'listed', selectMode: false, selected: [], scrollOffset: 0, intentError: null,
});
const initial = (): RatesSessionSnapshot => ({ initialized: false, section: 'Mortgage',
  sections: { Mortgage: emptySection(), Savings: emptySection(), TD: emptySection() } });
/** Ephemeral task state: never persisted, logged or sent to a provider. */
export const useRatesSession = create<RatesSessionSnapshot>(() => initial());
export function initializeRatesSession(prefs: Prefs, section: SectionKey): void {
  if (useRatesSession.getState().initialized) return;
  const sections = Object.fromEntries(SECTION_ORDER.map(key => [key, {
    ...emptySection(), filters: profileToFilters(prefs.profileFilters, key, { ...EMPTY_FILTERS }),
  }])) as RatesSessionSnapshot['sections'];
  useRatesSession.setState({ initialized: true, section, sections });
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
  useRatesSession.setState({ sections: { ...current.sections,
    [section]: { ...value, ...patch, ...(resetOffset ? { scrollOffset: 0 } : {}) } } });
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
  useRatesSession.setState(JSON.parse(JSON.stringify(snapshot)) as RatesSessionSnapshot, true);
}
