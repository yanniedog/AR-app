import { DEFAULT_PREFS, useStore } from '../src/data/store';
import {
  DEFAULT_INTERESTS,
  moveInterest,
  normalizeInterests,
  orderedInterestSections,
  resolveInterestSection,
  sectionSegmentOptions,
  toggleInterest,
} from '../src/data/interests';

describe('interests helpers', () => {
  it('normalizes unknown and duplicate keys', () => {
    expect(normalizeInterests(['Savings', 'Savings', 'TD' as never, 'Mortgage'])).toEqual([
      'Savings',
      'TD',
      'Mortgage',
    ]);
    expect(normalizeInterests([])).toEqual(DEFAULT_INTERESTS);
  });

  it('always offers every family, preserving optional interest values', () => {
    expect(sectionSegmentOptions(['TD', 'Mortgage'])).toEqual([
      { value: 'Mortgage', label: 'Home loans' },
      { value: 'Savings', label: 'Savings' },
      { value: 'TD', label: 'Term deposits' },
    ]);
  });

  it('toggles and reorders interests', () => {
    expect(toggleInterest(['Mortgage', 'Savings'], 'TD')).toEqual(['Mortgage', 'Savings', 'TD']);
    expect(toggleInterest(['Mortgage'], 'Mortgage')).toEqual(['Mortgage']);
    expect(moveInterest(['Mortgage', 'Savings', 'TD'], 'TD', 'up')).toEqual([
      'Mortgage',
      'TD',
      'Savings',
    ]);
  });

  it('resolves any valid preferred section', () => {
    expect(resolveInterestSection(['Savings', 'Mortgage'], 'Mortgage')).toBe('Mortgage');
    expect(resolveInterestSection(['Savings', 'Mortgage'], 'TD')).toBe('TD');
  });

  it('orders sections for trends snapshot', () => {
    expect(orderedInterestSections(['TD', 'Mortgage'])).toEqual(['TD', 'Mortgage']);
  });
});

describe('store interests prefs', () => {
  beforeEach(() => {
    useStore.setState({ prefs: { ...DEFAULT_PREFS }, hydrated: true });
  });

  it('preserves an available default and active family when optional interests change', () => {
    useStore.setState({ activeSection: 'TD' });
    useStore.getState().setPref('defaultSection', 'TD');
    useStore.getState().setPref('interests', ['Mortgage', 'Savings']);
    expect(useStore.getState().prefs.defaultSection).toBe('TD');
    expect(useStore.getState().prefs.interests).toEqual(['Mortgage', 'Savings']);
    expect(useStore.getState().activeSection).toBe('TD');
  });

  it('allows a default outside optional interests', () => {
    useStore.getState().setPref('interests', ['Savings']);
    useStore.getState().setPref('defaultSection', 'Mortgage');
    expect(useStore.getState().prefs.defaultSection).toBe('Mortgage');
  });

  it('preserves the interests reference for unrelated preference updates', () => {
    const interests = useStore.getState().prefs.interests;

    useStore.getState().setPref('themeMode', 'dark');

    expect(useStore.getState().prefs.interests).toBe(interests);
  });

  it('restores multiple preferences in one normalized store update', () => {
    useStore.setState({ activeSection: 'TD' });
    let updates = 0;
    const unsubscribe = useStore.subscribe(() => {
      updates += 1;
    });

    useStore.getState().setPrefs({
      interests: ['Savings'],
      defaultSection: 'Mortgage',
      themeMode: 'dark',
      includeNonStandard: true,
    });
    unsubscribe();

    expect(updates).toBe(1);
    expect(useStore.getState()).toMatchObject({
      activeSection: 'TD',
      prefs: {
        interests: ['Savings'],
        defaultSection: 'Mortgage',
        themeMode: 'dark',
        includeNonStandard: true,
      },
    });
  });

  it('normalizes optional interests without granting notification or diagnostics consent', () => {
    useStore.getState().setPrefs({ interests: ['TD', 'TD', 'Savings'], defaultSection: 'TD' });
    expect(useStore.getState().prefs.interests).toEqual(['TD', 'Savings']);
    expect(useStore.getState().prefs.defaultSection).toBe('TD');
  });
});
