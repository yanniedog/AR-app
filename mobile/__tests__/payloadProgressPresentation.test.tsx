import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { PayloadProgressBar } from '../src/components/feedbackProgress';
import { OfflineBanner } from '../src/components/feedbackBanner';
import { buildPayloadProgressViewModel, type PayloadProgressSnapshot } from '../src/data/downloadProgress';
import { uiDate, uiJoin } from '../src/lib/uiCopy';

let mockState: any;
jest.mock('../src/data/store', () => ({ useStore: (selector: any) => selector(mockState) }));
jest.mock('../src/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => jest.requireActual('../src/theme/theme').lightTheme }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Row: 'Row' }));
jest.mock('../src/components/icons/LedgerIcon', () => ({ LedgerIcon: 'LedgerIcon' }));
jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual('react');
  const fade = { duration: () => undefined };
  return { __esModule: true, default: { View: 'ReanimatedView' }, FadeIn: fade, FadeOut: fade,
    useSharedValue: (value: unknown) => React.useRef({ value }).current,
    useAnimatedStyle: (callback: () => unknown) => callback(), withTiming: (value: unknown) => value };
});

const NOW = Date.UTC(2026, 9, 15, 2);
const caption = uiJoin('Loading', ' · ', 'Observed', ': ', uiDate('2026-10-15'));
const progress = (phase: PayloadProgressSnapshot['phase']): PayloadProgressSnapshot => ({
  phase, fileName: phase === 'finalize' ? 'dates-index.json' : 'core.gz',
  bytesReceived: phase === 'finalize' ? 0 : 512_000,
  totalBytes: phase === 'finalize' ? null : 1_024_000,
  startedAt: NOW - 1000, phaseComplete: false,
});
beforeEach(() => { jest.spyOn(Date, 'now').mockReturnValue(NOW); });
afterEach(() => { jest.restoreAllMocks(); });

test.each(['finalize', 'download'] as const)('ordinary %s progress contains only the actual status, date, phase and percentage', (phase) => {
  const snapshot = Object.freeze(progress(phase));
  const before = JSON.stringify(snapshot);
  const vm = buildPayloadProgressViewModel(snapshot, NOW);
  let tree: any; act(() => { tree = TestRenderer.create(<PayloadProgressBar progress={snapshot} caption={caption} />); });
  try {
    const labels = tree.root.findAllByType('AppText' as any).map((node: any) => React.Children.toArray(node.props.children).join(''));
    expect(labels).toEqual([caption, phase === 'finalize' ? 'Pending' : 'Downloading', `${vm.overallPercent}%…`]);
    expect(tree.root.findByProps({ accessibilityRole: 'progressbar' }).props.accessibilityValue)
      .toEqual({ min: 0, max: 100, now: vm.overallPercent });
    const rendered = JSON.stringify(tree.toJSON());
    for (const technical of [snapshot.fileName, 'bytes', 'seconds', 'ETA']) expect(rendered).not.toContain(technical);
    expect(JSON.stringify(snapshot)).toBe(before);
    // The existing diagnostic model retains the real source facts; stage markers
    // are never rendered as transfer-speed or remaining-time claims.
    expect(vm.fileName).toBe(snapshot.fileName);
    if (phase === 'finalize') expect(vm.detailLine).toBe('dates-index.json');
    else {
      expect(buildPayloadProgressViewModel({ ...snapshot, phaseComplete: undefined }, NOW).detailLine).toContain('ETA');
      expect(vm.rateText).not.toBe('—');
    }
  } finally { act(() => tree.unmount()); }
});

test('the mounted global loading banner preserves its actual observed date without transfer diagnostics', () => {
  mockState = { payloadProgress: progress('finalize'), refreshing: true,
    pendingIngestRunDate: null, core: { run_date: '2026-10-15' }, status: 'ready' };
  let tree: any; act(() => { tree = TestRenderer.create(<OfflineBanner source="remote" offline={false} />); });
  try {
    expect(tree.root.findByType(PayloadProgressBar).props.caption).toBe(caption);
    expect(tree.root.findByProps({ accessibilityRole: 'progressbar' }).props.accessibilityValue.now)
      .toBe(buildPayloadProgressViewModel(mockState.payloadProgress, NOW).overallPercent);
    expect(JSON.stringify(tree.toJSON())).not.toContain('dates-index.json');
  } finally { act(() => tree.unmount()); }
});
