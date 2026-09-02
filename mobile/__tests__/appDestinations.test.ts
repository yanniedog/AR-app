import {
  APP_DESTINATION_GROUPS,
  destinationSectionFromParam,
  destinationHref,
  destinationIsActive,
} from '../src/lib/appDestinations';

describe('app destination registry', () => {
  it('keeps the utility menu to account and app destinations', () => {
    const destinations = APP_DESTINATION_GROUPS.flatMap((group) => group.destinations);
    expect(new Set(destinations.map((destination) => destination.id)).size).toBe(destinations.length);
    expect(destinations.map((destination) => destination.id)).toEqual([
      'profile',
      'settings',
      'about',
    ]);
  });

  it('builds stable utility destinations', () => {
    const destinations = APP_DESTINATION_GROUPS.flatMap((group) => group.destinations);
    expect(destinationHref(destinations[0], 'Savings')).toBe('/profile');
    expect(destinationHref(destinations[1], 'Savings')).toBe('/settings');
    expect(destinationHref(destinations[2], 'Savings')).toBe('/about');
  });

  it('maps focused routes back to their menu destination', () => {
    expect(destinationIsActive('profile', '/profile')).toBe(true);
    expect(destinationIsActive('settings', '/settings')).toBe(true);
    expect(destinationIsActive('about', '/about')).toBe(true);
    expect(destinationIsActive('about', '/debug-log')).toBe(true);
    expect(destinationIsActive('profile', '/browse')).toBe(false);
  });

  it('resolves visible category route parameters in key and slug form', () => {
    expect(destinationSectionFromParam('Savings')).toBe('Savings');
    expect(destinationSectionFromParam(['term-deposits'])).toBe('TD');
    expect(destinationSectionFromParam('not-a-section')).toBeUndefined();
  });
});
