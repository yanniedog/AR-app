import React from 'react';
import { StyleSheet, type ViewProps } from 'react-native';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { LedgerAction } from '../src/components/ledger/LedgerAction';
import { LedgerText } from '../src/components/ledger/LedgerText';

type ViewNode = { type: unknown; props: ViewProps };
type Renderer = ReactTestRenderer & {
  root: { findByType: (type: typeof LedgerText) => { parent: ViewNode } };
};

test('retains the native action label wrapper when RBA refresh settles', async () => {
  let tree!: Renderer;
  const labelLayer = (opacity: number) => {
    const layer = tree.root.findByType(LedgerText).parent;
    expect(layer.type).toBe('View');
    expect(StyleSheet.flatten(layer.props.style)?.opacity).toBe(opacity);
    return layer;
  };

  await act(async () => {
    tree = TestRenderer.create(<LedgerAction label="Refreshing outlook" variant="quiet" loading />) as Renderer;
  });
  try {
    const layer = labelLayer(0);
    expect(layer.props.collapsable).toBe(false);

    await act(async () => {
      tree.update(<LedgerAction label="Refresh outlook" variant="quiet" />);
    });
    expect(labelLayer(1)).toBe(layer);
    expect(layer.props.collapsable).toBe(false);
  } finally {
    await act(async () => tree.unmount());
  }
});
