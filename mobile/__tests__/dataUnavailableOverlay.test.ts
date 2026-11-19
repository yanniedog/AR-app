jest.mock('expo-router', () => ({ usePathname: () => '/' }));
jest.mock('../src/components/AppNavigationMenu', () => ({ NavigationMenuButton: 'NavigationMenuButton' }));
jest.mock('../src/components/DataUnavailableScreen', () => ({ DataUnavailableScreen: 'DataUnavailableScreen' }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: { bg: '#fff' } }) }));

// eslint-disable-next-line import/first -- module import must follow jest mocks
import { isDataIndependentRoute } from '../src/components/DataUnavailableOverlay';

test.each(['/settings', '/about', '/debug-log', '/terms', '/third-party-notices', '/Settings?x=1'])('%s stays reachable without data', (path) => {
  expect(isDataIndependentRoute(path)).toBe(true);
});

test.each(['/', '/browse', '/watchlist', '/market', '/product/abc', '/settings-extra', '/profile'])('%s shows the unavailable state', (path) => {
  expect(isDataIndependentRoute(path)).toBe(false);
});
