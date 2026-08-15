import {
  APP_DESTINATION_GROUPS,
  destinationSectionFromParam,
  destinationHref,
  destinationIsActive,
} from '../src/lib/appDestinations';

describe('app destination registry', () => {
  it('keeps the drawer to the six deliberate secondary destinations', () => {
    const destinations = APP_DESTINATION_GROUPS.flatMap((group) => group.destinations);
    expect(new Set(destinations.map((destination) => destination.id)).size).toBe(destinations.length);
    expect(destinations.map((destination) => destination.id)).toEqual([
      'search',
      'banks',
      'scenario',
      'market',
      'settings',
      'about',
    ]);
  });

  it('builds contextual destinations with the active product category', () => {
    const search = APP_DESTINATION_GROUPS.flatMap((group) => group.destinations)
      .find((destination) => destination.id === 'search');
    expect(search).toBeDefined();
    expect(destinationHref(search!, 'Savings')).toEqual({
      pathname: '/search',
      params: { section: 'Savings' },
    });
    const scenario = APP_DESTINATION_GROUPS.flatMap((group) => group.destinations)
      .find((destination) => destination.id === 'scenario');
    expect(destinationHref(scenario!, 'Savings')).toEqual({
      pathname: '/calculator',
      params: { section: 'Savings' },
    });
  });

  it('maps focused routes back to their menu destination', () => {
    expect(destinationIsActive('banks', '/bank/Example')).toBe(true);
    expect(destinationIsActive('market', '/(tabs)/trends')).toBe(true);
    expect(destinationIsActive('market', '/rba')).toBe(true);
    expect(destinationIsActive('scenario', '/projections')).toBe(true);
    expect(destinationIsActive('search', '/compare')).toBe(true);
    expect(destinationIsActive('about', '/about')).toBe(true);
    expect(destinationIsActive('search', '/browse')).toBe(false);
  });

  it('resolves visible category route parameters in key and slug form', () => {
    expect(destinationSectionFromParam('Savings')).toBe('Savings');
    expect(destinationSectionFromParam(['term-deposits'])).toBe('TD');
    expect(destinationSectionFromParam('not-a-section')).toBeUndefined();
  });
});
