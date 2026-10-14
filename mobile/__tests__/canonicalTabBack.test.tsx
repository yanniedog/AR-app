import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { CommonActions, TabRouter } from '@react-navigation/routers';
import TabsLayout from '../app/(tabs)/_layout';

jest.mock('expo-router', () => {
  const React = jest.requireActual('react');
  return { usePathname: () => '/browse', Tabs: Object.assign((props: object) => React.createElement('Tabs', props), { Screen: 'TabScreen' }) };
});
jest.mock('../src/components/AppUpdateBanner', () => ({ useAppUpdateBannerVisible: () => false }));
jest.mock('../src/components/AppNavigationMenu', () => ({ NavigationMenuButton: 'NavigationMenuButton' }));
jest.mock('../src/components/feedback', () => ({ RefreshOutcomeSnackbar: 'RefreshOutcomeSnackbar' }));
jest.mock('../src/data/store', () => ({ useStore: (selector: (state: { hydrated: boolean }) => unknown) => selector({ hydrated: true }) }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ ledger: { raised: '#fff', rule: '#ddd' }, colors: { text: '#111' } }) }));
jest.mock('../src/components/icons/LedgerIcon', () => ({ LedgerIcon: 'LedgerIcon' }));

function config() {
  let tree: any; act(() => { tree = TestRenderer.create(<TabsLayout />); });
  const props = tree.root.findByType('Tabs').props;
  const routeNames = React.Children.toArray(props.children).map(child => (child as React.ReactElement<{ name: string }>).props.name);
  act(() => tree.unmount());
  return { props, options: { routeNames, routeParamList: Object.fromEntries(routeNames.map(name => [name, undefined])), routeGetIdList: {} } };
}
test('the actual prior firstRoute behavior reaches hidden index from Rates', () => {
  const { options } = config(); const router = TabRouter({});
  let state = router.getInitialState(options);
  state = router.getRehydratedState(router.getStateForAction(state, CommonActions.navigate('browse'), options)!, options);
  const back = router.getRehydratedState(router.getStateForAction(state, CommonActions.goBack(), options)!, options);
  expect(back.routes[back.index].name).toBe('index');
});
test.each(['watchlist', 'market', 'index', 'tools', 'trends'])('configured native Back returns %s to canonical Rates and never to a hidden tab', name => {
  const { props, options } = config();
  expect(props.initialRouteName).toBe('browse'); expect(props.backBehavior).toBe('initialRoute');
  const router = TabRouter({ initialRouteName: props.initialRouteName, backBehavior: props.backBehavior });
  let state = router.getInitialState(options); expect(state.routes[state.index].name).toBe('browse');
  state = router.getRehydratedState(router.getStateForAction(state, CommonActions.navigate(name), options)!, options);
  const back = router.getRehydratedState(router.getStateForAction(state, CommonActions.goBack(), options)!, options);
  expect(back.routes[back.index].name).toBe('browse');
  expect(router.getStateForAction(back, CommonActions.goBack(), options)).toBeNull();
});
