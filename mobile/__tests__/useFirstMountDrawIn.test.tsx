import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { cancelAnimation } from 'react-native-reanimated';

import { useFirstMountDrawIn } from '../src/hooks/useFirstMountDrawIn';

jest.mock('react-native-reanimated', () => ({
  Easing: { out: (fn: unknown) => fn, cubic: () => 0 },
  cancelAnimation: jest.fn(),
  useSharedValue: (value: number) => ({ value }),
  withTiming: (value: number) => value,
}));

function Probe() {
  useFirstMountDrawIn(false, 800);
  return null;
}

it('stops a running draw-in when its screen unmounts', () => {
  let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<Probe />); });
  expect(cancelAnimation).not.toHaveBeenCalled();
  act(() => { tree.unmount(); });
  expect(cancelAnimation).toHaveBeenCalledTimes(1);
});
