import { InteractionManager } from 'react-native';
import React, { useEffect } from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { useNavigationContentReady } from '../src/hooks/useNavigationContentReady';

function Probe({
  active,
  onReady,
}: {
  active: boolean;
  onReady: (ready: boolean) => void;
}) {
  const ready = useNavigationContentReady(active);
  useEffect(() => {
    onReady(ready);
  }, [onReady, ready]);
  return null;
}

describe('useNavigationContentReady', () => {
  let runSpy: jest.SpyInstance;

  beforeEach(() => {
    runSpy = jest
      .spyOn(InteractionManager, 'runAfterInteractions')
      .mockImplementation(((task?: unknown) => {
        if (typeof task === 'function') (task as () => void)();
        return { cancel: jest.fn(), then: jest.fn(), done: jest.fn() };
      }) as typeof InteractionManager.runAfterInteractions);
  });

  afterEach(() => {
    runSpy.mockRestore();
  });

  it('stays false until after interactions when active', () => {
    const seen: boolean[] = [];
    let tree!: ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <Probe active onReady={(ready) => { seen.push(ready); }} />,
      );
    });
    try {
      expect(seen[0]).toBe(false);
      expect(seen.at(-1)).toBe(true);
      expect(runSpy).toHaveBeenCalled();
    } finally {
      act(() => tree.unmount());
    }
  });

  it('resets when deactivated', () => {
    const seen: boolean[] = [];
    let tree!: ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <Probe active onReady={(ready) => { seen.push(ready); }} />,
      );
    });
    try {
      expect(seen.at(-1)).toBe(true);
      act(() => {
        tree.update(<Probe active={false} onReady={(ready) => { seen.push(ready); }} />);
      });
      expect(seen.at(-1)).toBe(false);
    } finally {
      act(() => tree.unmount());
    }
  });

  it('latches ready across deactivation when requested', () => {
    function LatchProbe({
      active,
      onReady,
    }: {
      active: boolean;
      onReady: (ready: boolean) => void;
    }) {
      const ready = useNavigationContentReady(active, { latchAfterReady: true });
      useEffect(() => {
        onReady(ready);
      }, [onReady, ready]);
      return null;
    }
    const seen: boolean[] = [];
    let tree!: ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <LatchProbe active onReady={(ready) => { seen.push(ready); }} />,
      );
    });
    try {
      expect(seen.at(-1)).toBe(true);
      act(() => {
        tree.update(<LatchProbe active={false} onReady={(ready) => { seen.push(ready); }} />);
      });
      expect(seen.at(-1)).toBe(true);
    } finally {
      act(() => tree.unmount());
    }
  });
});
