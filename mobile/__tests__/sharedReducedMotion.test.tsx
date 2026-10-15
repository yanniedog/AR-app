import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { AccessibilityInfo } from 'react-native';

import { useReducedMotion } from '../src/hooks/useReducedMotion';

test('shares one native listener and a newer event wins over an initial preference read', async () => {
  let resolve!: (value: boolean) => void;
  const read = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise<boolean>((done) => { resolve = done; }));
  const remove = jest.fn();
  let changed!: (value: boolean) => void;
  const listen = jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((_event: 'reduceMotionChanged', callback: (value: boolean) => void) => {
    changed = callback;
    return { remove };
  }) as unknown as typeof AccessibilityInfo.addEventListener);
  const observed = new Map<string, boolean | null>();
  function Consumer({ name }: { name: string }) { observed.set(name, useReducedMotion()); return null; }
  let first!: ReactTestRenderer;
  let second!: ReactTestRenderer;
  act(() => { first = TestRenderer.create(<Consumer name="first" />); second = TestRenderer.create(<Consumer name="second" />); });
  try {
    expect(read).toHaveBeenCalledTimes(1);
    expect(listen).toHaveBeenCalledTimes(1);
    expect(observed.get('first')).toBeNull();
    act(() => changed(true));
    await act(async () => { resolve(false); });
    expect(observed.get('first')).toBe(true);
    expect(observed.get('second')).toBe(true);
    act(() => first.unmount());
    expect(remove).not.toHaveBeenCalled();
    act(() => second.unmount());
    expect(remove).toHaveBeenCalledTimes(1);
  } finally {
    act(() => { first.unmount(); second.unmount(); });
    jest.restoreAllMocks();
  }
});
