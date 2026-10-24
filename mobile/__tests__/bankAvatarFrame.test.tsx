import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Image, Text, View } from 'react-native';
import { BankAvatar } from '../src/components/BankAvatar';

let mockSources: (string | number | { uri: string; width: number; height: number })[] = [];
jest.mock('../src/data/store', () => ({ useStore: (select: (state: unknown) => unknown) => select({ core: { brands: { Bank: { short: 'BK', color: '#123456' } } } }) }));
jest.mock('../src/data/bankBrand', () => ({ ...jest.requireActual('../src/data/bankBrand'), resolveBankLogoSourcesForRuntime: () => mockSources,
  isSvgLogoSource: (source: unknown) => typeof source === 'string' && source.endsWith('.svg') }));
jest.mock('react-native-svg', () => ({ SvgUri: 'SvgUri' }));
jest.mock('../src/lib/performanceAudit', () => ({ isPerformanceAuditActive: () => false, subscribePerformanceAudit: () => () => {} }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: { chipText: '#123456' } }) }));

test.each([[96, 50], [112, 66], [32, 106]])('raster and wide/square SVG marks contain inside a %ix%i frame without clipping or stretching', (width, height) => {
  for (const source of ['https://example.test/wide.png', 'https://example.test/square.svg']) {
    mockSources = [source]; let tree: any;
    act(() => { tree = TestRenderer.create(<BankAvatar provider="Bank" width={width} height={height} inset={0} />); });
    try {
      const frame = tree.root.findAllByType(View).find((node: any) => node.props.accessible);
      expect(frame.props.style).toMatchObject({ width, height }); expect(frame.props.style.overflow).toBeUndefined();
      if (source.endsWith('.svg')) expect(tree.root.findByType('SvgUri').props).toMatchObject({ width, height, preserveAspectRatio: 'xMidYMid meet' });
      else expect(tree.root.findByType(Image).props).toMatchObject({ resizeMode: 'contain', style: { width, height } });
    } finally { act(() => tree.unmount()); }
  }
});
test('fallback monograms stay inside the same frame and keep the provider accessible', () => {
  mockSources = []; let tree: any;
  act(() => { tree = TestRenderer.create(<BankAvatar provider="Bank" width={96} height={50} inset={0} />); });
  try {
    expect(tree.root.findAllByType(View).find((node: any) => node.props.accessible).props).toMatchObject({ accessibilityLabel: 'Bank', style: { width: 96, height: 50 } });
    expect(tree.root.findByType(Text).props).toMatchObject({ children: 'BK', accessible: false, allowFontScaling: false });
    expect(tree.root.findByType(Text).props.style.fontSize).toBeLessThan(50);
  } finally { act(() => tree.unmount()); }
});


test('passes bundled native IDs and web image objects directly to Image', () => {
  for (const bundled of [7, { uri: '/assets/bank.png', width: 256, height: 128 }]) {
    mockSources = [bundled]; let tree: any;
    act(() => { tree = TestRenderer.create(<BankAvatar provider="Bank" />); });
    try { expect(tree.root.findByType(Image).props.source).toBe(bundled); }
    finally { act(() => tree.unmount()); }
  }
});


test('a failed curated image ends at initials', () => {
  mockSources = [7]; let tree: any;
  act(() => { tree = TestRenderer.create(<BankAvatar provider="Bank" />); });
  try {
    act(() => tree.root.findByType(Image).props.onError());
    expect(tree.root.findAllByType(Image)).toHaveLength(0);
    expect(tree.root.findByType(Text).props.children).toBe('BK');
  } finally { act(() => tree.unmount()); }
});
