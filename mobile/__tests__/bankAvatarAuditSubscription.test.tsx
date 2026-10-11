import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { BankAvatar } from '../src/components/BankAvatar';
import {
  markPerformanceAuditCancelled,
  requestPerformanceAudit,
  resetPerformanceAuditForTests,
  updatePerformanceAuditProgress,
} from '../src/lib/performanceAudit';

const mockRender = jest.fn();
const mockSources = jest.fn((..._args: unknown[]) => []);
jest.mock('../src/data/store', () => ({ useStore: (selector: (state: unknown) => unknown) => selector({ core: null }) }));
jest.mock('../src/data/bankBrand', () => ({
  resolveBankLogoSourcesForRuntime: (...args: unknown[]) => mockSources(...args),
  resolveBrandShort: () => 'BANK',
  isSvgLogoSource: () => false,
}));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => {
  mockRender();
  return { colors: { chipText: '#123456' } };
} }));

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
