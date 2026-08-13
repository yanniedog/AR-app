import {
  APP_DESTINATION_GROUPS,
  destinationHref,
  destinationIsActive,
} from '../src/lib/appDestinations';

describe('app destination registry', () => {
  it('has stable unique destinations covering the app', () => {
    const destinations = APP_DESTINATION_GROUPS.flatMap((group) => group.destinations);
    expect(new Set(destinations.map((destination) => destination.id)).size).toBe(destinations.length);
    expect(destinations.map((destination) => destination.id)).toEqual(expect.arrayContaining([
      'today',
      'explore',
      'home-loans',
      'savings',
      'term-deposits',
      'search',
      'compare',
      'saved',
      'scenario',
      'projections',
      'changes',
      'bank-response',
      'market',
      'settings',
      'about',
    ]));
  });

  it('builds contextual destinations with the active product category', () => {
    const search = APP_DESTINATION_GROUPS.flatMap((group) => group.destinations)
      .find((destination) => destination.id === 'search');
    expect(search).toBeDefined();
    expect(destinationHref(search!, 'Savings')).toEqual({
      pathname: '/search',
      params: { section: 'Savings' },
    });
  });

  it('maps focused routes back to their menu destination', () => {
    expect(destinationIsActive('banks', '/bank/Example')).toBe(true);
    expect(destinationIsActive('market', '/(tabs)/trends')).toBe(true);
    expect(destinationIsActive('about', '/about')).toBe(true);
    expect(destinationIsActive('today', '/browse')).toBe(false);
  });
});
