import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { PerformanceAuditOverlay } from '../src/components/PerformanceAuditOverlay';
import { getPerformanceAuditState, markPerformanceAuditRunning, pausePerformanceAudit, requestPerformanceAudit, resetPerformanceAuditForTests, resumePerformanceAudit } from '../src/lib/performanceAudit';

jest.mock('../modules/audit-screen-awake', () => ({ AuditScreenAwake: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: { border: '#000', chip: '#000', primary: '#000' }, radius: { pill: 4 } }) }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Card: 'Card', Row: 'Row', Button: 'Button' }));

type TestNode = { type: unknown; children: unknown[]; props: { title?: string; onPress: () => void } };
type Renderer = ReactTestRenderer & { root: {
  findAll: (predicate: (node: TestNode) => boolean) => TestNode[];
  find: (predicate: (node: TestNode) => boolean) => TestNode;
} };

function texts(tree: Renderer): string[] {
  return tree.root.findAll(node => node.type === 'AppText').map(node => node.children.join(''));
}

test('shows elapsed time and pauses and resumes the run', async () => {
  resetPerformanceAuditForTests();
  requestPerformanceAudit();
  markPerformanceAuditRunning(10);
  let tree!: Renderer;
  await act(async () => { tree = TestRenderer.create(<PerformanceAuditOverlay state={getPerformanceAuditState()} />) as Renderer; });
  expect(texts(tree).some(text => /^Elapsed: \d\d:\d\d$/.test(text))).toBe(true);
  const press = (title: string) => tree.root.find(node => node.type === 'Button' && node.props.title === title).props.onPress();
  await act(async () => { press('Pause'); });
  expect(getPerformanceAuditState().paused).toBe(true);
  await act(async () => { tree.update(<PerformanceAuditOverlay state={getPerformanceAuditState()} />); });
  await act(async () => { press('Resume'); });
  expect(getPerformanceAuditState().paused).toBe(false);
});

test('a manual pause survives a system foreground resume', () => {
  resetPerformanceAuditForTests();
  requestPerformanceAudit();
  markPerformanceAuditRunning(10);
  pausePerformanceAudit();
  resumePerformanceAudit('system');
  expect(getPerformanceAuditState().paused).toBe(true);
  resumePerformanceAudit();
  expect(getPerformanceAuditState().paused).toBe(false);
  pausePerformanceAudit('system');
  resumePerformanceAudit('system');
  expect(getPerformanceAuditState().paused).toBe(false);
});
