import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';

import { NavigatorSafeArea } from '../src/components/NavigatorSafeArea';

it('consumes only the navigator top inset while fixed shell controls retain all window insets', () => {
  const windowInsets = { top: 24, right: 7, bottom: 16, left: 3 };
  const observed: Record<string, typeof windowInsets> = {};
  function Consumer({ id }: { id: string }) {
    observed[id] = useSafeAreaInsets();
    return <View />;
  }
  function Shell({ consumed }: { consumed: boolean }) {
    return <SafeAreaInsetsContext.Provider value={windowInsets}>
      <Consumer id="breadcrumb" />
      <NavigatorSafeArea topInsetConsumed={consumed}><Consumer id="navigator" /></NavigatorSafeArea>
      <Consumer id="tabBar" />
    </SafeAreaInsetsContext.Provider>;
  }
  let tree: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<Shell consumed />); });
  expect(observed.breadcrumb).toEqual(windowInsets);
  expect(observed.tabBar).toEqual(windowInsets);
  expect(observed.navigator).toEqual({ ...windowInsets, top: 0 });
  act(() => tree.update(<Shell consumed={false} />));
  expect(observed.navigator).toEqual(windowInsets);
  act(() => tree.unmount());
});
