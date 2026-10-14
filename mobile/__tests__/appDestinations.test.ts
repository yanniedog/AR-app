import { APP_DESTINATION_GROUPS, destinationSectionFromParam, destinationHref, destinationIsActive } from '../src/lib/appDestinations';
const destinations = APP_DESTINATION_GROUPS.flatMap(group => group.destinations);
it('limits Account to three distinct preferences destinations', () => {
  expect(APP_DESTINATION_GROUPS.map(group => group.id)).toEqual(['account']);
  expect(destinations.map(item => item.id)).toEqual(['profile', 'settings', 'about']);
  expect(new Set(destinations.map(item => item.path)).size).toBe(3);
  for (const destination of destinations) {
    expect(destinationHref(destination)).toBe(destination.path);
    expect(destinationIsActive(destination.id, destination.path + '?source=account')).toBe(true);
  }
});
it('does not select About for diagnostics or a similar prefix', () => {
  for (const path of ['/debug-log', '/about-other', '/terms']) expect(destinationIsActive('about', path)).toBe(false);
});
it('accepts first repeated section keys/slugs without treating unknown values as a family', () => {
  expect(destinationSectionFromParam('Savings')).toBe('Savings');
  expect(destinationSectionFromParam(['term-deposits', 'Mortgage'])).toBe('TD');
  expect(destinationSectionFromParam('not-a-section')).toBeUndefined();
});
