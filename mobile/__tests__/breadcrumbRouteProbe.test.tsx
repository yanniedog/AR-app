import React, { useState } from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { BreadcrumbRouteProbe } from '../src/components/BreadcrumbRouteProbe';

let mockPath = '/market';
jest.mock('expo-router', () => ({ usePathname: () => mockPath }));

test('phone route changes never flip navigator breadcrumb state, while resizing enables the current route', () => {
  const changes = jest.fn();
  function Navigator({ wide }: { wide: boolean }) {
    const [visible, setVisible] = useState(false);
    return <BreadcrumbRouteProbe hydrated enabled={wide} onChange={next => {
      if (visible !== next) changes(next);
      setVisible(next);
    }} />;
  }
  let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<Navigator wide={false} />); });
  try {
    for (const path of ['/bank/Bank', '/market', '/rba-response', '/browse', '/product/loan']) {
      mockPath = path;
      act(() => tree.update(<Navigator wide={false} />));
    }
    expect(changes).not.toHaveBeenCalled();
    act(() => tree.update(<Navigator wide />));
    expect(changes.mock.calls).toEqual([[true]]);
    mockPath = '/bank/Bank';
    act(() => tree.update(<Navigator wide />));
    expect(changes).toHaveBeenCalledTimes(1);
    act(() => tree.update(<Navigator wide={false} />));
    expect(changes.mock.calls).toEqual([[true], [false]]);
  } finally { act(() => tree.unmount()); }
});
