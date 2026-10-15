import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Image, View } from 'react-native';
import { BankAvatar } from '../src/components/BankAvatar';
import {
  markPerformanceAuditCancelled,
  requestPerformanceAudit,
  resetPerformanceAuditForTests,
  updatePerformanceAuditProgress,
} from '../src/lib/performanceAudit';

type Tree = ReactTestRenderer & { root: {
  findByType: (type: unknown) => { props: Record<string, any> };
  findAllByType: (type: unknown) => { props: Record<string, any> }[];
} };

const mockRender = jest.fn();
const mockSources = jest.fn((..._args: unknown[]): (string | number)[] => []);
let mockDark = false;
jest.mock('../src/data/store', () => ({ useStore: (selector: (state: unknown) => unknown) => selector({ core: null }) }));
jest.mock('../src/data/bankBrand', () => ({
  resolveBankLogoSourcesForRuntime: (...args: unknown[]) => mockSources(...args),
  resolveBrandShort: () => 'BANK',
  isSvgLogoSource: (source: string | number) => typeof source === 'string' && source.endsWith('.svg'),
}));
jest.mock('react-native-svg', () => ({ SvgUri: 'SvgUri' }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => {
  mockRender();
  return { dark: mockDark, colors: { chipText: mockDark ? '#abcdef' : '#123456' } };
} }));

beforeEach(() => {
  mockSources.mockReset().mockReturnValue([]);
  mockDark = false;
});

it('does not rerender bank logos for every audit progress event but reacts to network ownership', () => {
  resetPerformanceAuditForTests();
  let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<BankAvatar provider="Example Bank" />); });
  try {
    act(() => { requestPerformanceAudit(); });
    const renders = mockRender.mock.calls.length;
    expect(mockSources).toHaveBeenLastCalledWith('Example Bank', undefined, undefined, true);
    for (let check = 1; check <= 320; check += 1) {
      act(() => { updatePerformanceAuditProgress(check, 320, `Check ${check}`); });
    }
    expect(mockRender).toHaveBeenCalledTimes(renders);
    act(() => { markPerformanceAuditCancelled(); });
    expect(mockSources).toHaveBeenLastCalledWith('Example Bank', undefined, undefined, false);
  } finally {
    act(() => { tree.unmount(); });
    resetPerformanceAuditForTests();
  }
});

it.each([false, true])('keeps original raster/SVG artwork on a white plate in dark=%s while preserving load and fallback evidence', dark => {
  mockDark = dark;
  const svg = 'https://example.org/bank.svg';
  mockSources.mockReturnValue([123, svg]);
  const onAssetPending = jest.fn();
  const onAssetTerminal = jest.fn();
  const onRenderStateChange = jest.fn();
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<BankAvatar provider="Example Bank" size={32}
    renderStateId="rate:42" onAssetPending={onAssetPending} onAssetTerminal={onAssetTerminal}
    onRenderStateChange={onRenderStateChange} />) as Tree; });
  try {
    const raster = tree.root.findByType(Image);
    expect(tree.root.findByType(View).props.style).toMatchObject({
      width: 32, height: 32, borderRadius: 8, backgroundColor: '#ffffff',
    });
    expect(raster.props.source).toBe(123);
    expect(raster.props.resizeMode).toBe('contain');
    expect(raster.props.style).toEqual({ width: 32 * 0.88, height: 32 * 0.88 });
    expect(raster.props.style.tintColor).toBeUndefined();
    expect(onAssetPending).toHaveBeenLastCalledWith('Example Bank');
    expect(onRenderStateChange).toHaveBeenLastCalledWith('rate:42', 'pending');
    act(() => raster.props.onLoad());
    expect(onAssetTerminal).toHaveBeenLastCalledWith({ provider: 'Example Bank', status: 'loaded' });
    expect(onRenderStateChange).toHaveBeenLastCalledWith('rate:42', 'decoded');
    act(() => raster.props.onError());
    const vector = tree.root.findByType('SvgUri' as never);
    expect(vector.props.uri).toBe(svg);
    expect(vector.props.width).toBe(32 * 0.88);
    expect(vector.props.height).toBe(32 * 0.88);
    expect(tree.root.findByType(View).props.style.backgroundColor).toBe('#ffffff');
    act(() => vector.props.onError());
    expect(tree.root.findAllByType(Image)).toHaveLength(0);
    expect(tree.root.findAllByType('SvgUri' as never)).toHaveLength(0);
    expect(tree.root.findByType(View).props.style).toMatchObject({
      width: 32, height: 32, borderRadius: 8, backgroundColor: dark ? '#abcdef' : '#123456',
    });
    expect(onAssetTerminal).toHaveBeenLastCalledWith({ provider: 'Example Bank', status: 'fallback' });
    expect(onRenderStateChange).toHaveBeenLastCalledWith('rate:42', 'initials');
  } finally { act(() => tree.unmount()); }
  expect(onRenderStateChange).toHaveBeenLastCalledWith('rate:42', 'unmounted');
});
