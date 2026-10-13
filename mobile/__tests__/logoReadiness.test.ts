import React, { useEffect } from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { useLogoReadiness } from '../src/hooks/useLogoReadiness';
import {
  applyLogoRenderState,
  summarizeLogoRenderStates,
} from '../src/lib/logoReadiness';

describe('logo readiness', () => {
  test('repeated identical image notifications do not commit the containing screen again', () => {
    type Api = ReturnType<typeof useLogoReadiness>;
    let latest: Api | null = null;
    const committed = jest.fn();
    function Probe() {
      const readiness = useLogoReadiness('same-publication', ['header']);
      useEffect(() => { latest = readiness; committed(); });
      return null;
    }
    let tree!: ReactTestRenderer;
    act(() => { tree = TestRenderer.create(React.createElement(Probe)); });
    const api = () => latest as unknown as Api;
    try {
      act(() => api().onLogoRenderStateChange('header', 'decoded'));
      const count = committed.mock.calls.length;
      act(() => api().onLogoRenderStateChange('header', 'decoded'));
      act(() => api().onLogoRenderStateChange('not-mounted', 'unmounted'));
      expect(committed).toHaveBeenCalledTimes(count);
      expect(api()).toMatchObject({ ready: true, terminalCount: 1 });
      act(() => api().onLogoRenderStateChange('header', 'pending'));
      expect(api()).toMatchObject({ ready: false, terminalCount: 0 });
      act(() => api().onLogoRenderStateChange('header', 'initials'));
      expect(api()).toMatchObject({ ready: true, fallbackCount: 1 });
    } finally { act(() => tree.unmount()); }
  });

  test('is ready only after every expected rendered logo reaches a terminal state', () => {
    let states = new Map();
    states = applyLogoRenderState(states, 'row:1', 'pending');
    states = applyLogoRenderState(states, 'row:2', 'pending');
    expect(summarizeLogoRenderStates(states)).toEqual({
      expectedCount: 2,
      terminalCount: 0,
      decodedCount: 0,
      fallbackCount: 0,
      ready: false,
    });
    states = applyLogoRenderState(states, 'row:1', 'decoded');
    states = applyLogoRenderState(states, 'row:2', 'initials');
    expect(summarizeLogoRenderStates(states)).toEqual({
      expectedCount: 2,
      terminalCount: 2,
      decodedCount: 1,
      fallbackCount: 1,
      ready: true,
    });
  });

  test('tracks only currently mounted virtualized rows plus fixed header logos', () => {
    let states = applyLogoRenderState(new Map(), 'visible:1', 'decoded');
    expect(summarizeLogoRenderStates(states, ['header'])).toEqual({
      expectedCount: 2,
      terminalCount: 1,
      decodedCount: 1,
      fallbackCount: 0,
      ready: false,
    });
    states = applyLogoRenderState(states, 'header', 'initials');
    states = applyLogoRenderState(states, 'visible:1', 'unmounted');
    expect(summarizeLogoRenderStates(states, ['header'])).toEqual({
      expectedCount: 1,
      terminalCount: 1,
      decodedCount: 0,
      fallbackCount: 1,
      ready: true,
    });
  });

  test('re-emits a mounted terminal logo when its audit scope changes', () => {
    type Api = ReturnType<typeof useLogoReadiness>;
    const latest: { current: Api | null } = { current: null };

    function Probe({ scope }: { scope: string }) {
      const readiness = useLogoReadiness(scope, ['fixed-logo']);
      useEffect(() => {
        latest.current = readiness;
      });
      return null;
    }

    let tree: ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(React.createElement(Probe, { scope: 'first' }));
    });
    const firstCallback = latest.current?.onLogoRenderStateChange;
    act(() => {
      firstCallback?.('fixed-logo', 'decoded');
    });
    expect(latest.current).toMatchObject({ ready: true, terminalCount: 1 });

    act(() => {
      tree!.update(React.createElement(Probe, { scope: 'second' }));
    });
    expect(latest.current).toMatchObject({ ready: false, terminalCount: 0 });
    expect(latest.current?.onLogoRenderStateChange).not.toBe(firstCallback);

    act(() => {
      latest.current?.onLogoRenderStateChange('fixed-logo', 'decoded');
    });
    expect(latest.current).toMatchObject({ ready: true, terminalCount: 1 });

    act(() => tree!.unmount());
  });
});
