import React from 'react';
import { Platform } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { ConsumedInsetHeader } from '../src/components/ConsumedInsetHeader';
import { makeHealthyCore } from '../__fixtures__/appHealth';
import { uiLabel } from '../src/lib/uiCopy';

jest.mock('@react-navigation/elements', () => ({ Header: 'Header', HeaderBackButton: 'HeaderBackButton' }));
jest.mock('../src/components/AppNavigationMenu', () => ({ NavigationMenuButton: 'NavigationMenuButton' }));

test('a consumed top inset retains route share action and actual provider title', () => {
  const share = jest.fn();
  const headerRight = () => <button onClick={share}>Share</button>;
  let tree: any;
  act(() => { tree = TestRenderer.create(<ConsumedInsetHeader core={makeHealthyCore()} fallbackTitle={uiLabel('Product')}
    navigationOptions={{ title: 'Provider 1', headerRight }} back={{ title: 'Legacy title', href: '/rates' }} />); });
  const header = tree.root.findByType('Header');
  expect(header.props.title).toBe('Provider 1');
  header.props.headerRight().props.onClick();
  expect(share).toHaveBeenCalledTimes(1);
  expect(header.props.back).toEqual({ title: 'Back', href: '/rates' });
  act(() => tree.unmount());
});

test('route unavailable titles survive and unrelated titles fail closed', () => {
  let tree: any;
  const props = { core: makeHealthyCore(), fallbackTitle: uiLabel('Product'), back: { title: '', href: undefined } };
  act(() => { tree = TestRenderer.create(<ConsumedInsetHeader {...props} navigationOptions={{ title: 'Product rate unavailable', headerBackVisible: false }} />); });
  expect(tree.root.findByType('Header').props.title).toBe('Product rate unavailable');
  expect(tree.root.findByType('Header').props.back).toBeUndefined();
  expect(tree.root.findByType('Header').props.headerRight().type).toBe('NavigationMenuButton');
  act(() => tree.update(<ConsumedInsetHeader {...props} navigationOptions={{ title: 'A paragraph describing this app.' }} />));
  expect(tree.root.findByType('Header').props.title).toBe('Product');
  act(() => tree.unmount());
});

test('the Android fallback back button reserves a 48 dp target and keeps navigation', () => {
  const platform = jest.replaceProperty(Platform, 'OS', 'android');
  let tree: any;
  try {
    const props = { core: makeHealthyCore(), fallbackTitle: uiLabel('Product'), back: { title: 'Back', href: '/rates' } };
    act(() => { tree = TestRenderer.create(<ConsumedInsetHeader {...props} navigationOptions={{}} />); });
    const onPress = jest.fn();
    const button = tree.root.findByType('Header').props.headerLeft({ onPress, href: '/rates' });
    expect(button.type).toBe('HeaderBackButton');
    expect(button.props.style).toMatchObject({ minWidth: 48, minHeight: 48 });
    expect(button.props.href).toBe('/rates');
    button.props.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  } finally {
    act(() => tree?.unmount());
    platform.restore();
  }
});
