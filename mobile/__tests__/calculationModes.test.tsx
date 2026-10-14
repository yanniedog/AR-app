import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';
import type { SectionKey } from '../src/types';

const mockParams: Record<string, string | string[]> = {};
type ModeRenderer = ReactTestRenderer & { root: { findByProps(props: Record<string, unknown>): { props: { onChange(mode: string): void } } } };
const mockRouter = router as unknown as { setParams: jest.Mock };
let mockActiveSection: SectionKey = 'Mortgage';
jest.mock('expo-router', () => ({ router: { setParams: jest.fn() }, useLocalSearchParams: () => mockParams,
  Stack: { Screen: () => null } }));
jest.mock('../src/data/store', () => ({ useStore: (selector: (state: unknown) => unknown) => selector({ activeSection: mockActiveSection }) }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: { bg: '#fff' } }) }));
jest.mock('../src/components/controls', () => ({ SegmentedControl: (props: Record<string, unknown>) => require('react').createElement('ModeControl', props) }));
jest.mock('../src/components/calculation/RateCheckWorkspace', () => ({ RateCheckWorkspace: () => null }));
jest.mock('../src/components/calculation/ProjectionWorkspace', () => ({ ProjectionWorkspace: () => null }));

// eslint-disable-next-line import/first -- route follows its native/store mocks
import Calculate from '../app/calculator';

beforeEach(() => { Object.keys(mockParams).forEach(key => delete mockParams[key]); mockRouter.setParams.mockClear(); });
test.each(['Mortgage', 'Savings', 'TD'] as const)('keeps the current %s family when a generic calculation changes mode', section => {
  mockActiveSection = section;
  let tree!: ModeRenderer;
  act(() => { tree = TestRenderer.create(<Calculate />) as ModeRenderer; });
  act(() => tree.root.findByProps({ value: 'check' }).props.onChange('project'));
  expect(mockRouter.setParams).toHaveBeenLastCalledWith({ mode: 'project', section });
  act(() => tree.unmount());
});
test('keeps the explicit target family and tier when switching modes', () => {
  mockActiveSection = 'Mortgage';
  Object.assign(mockParams, { section: 'Savings', target: 'opaque%key,with/slash', ri: '7', mode: 'project' });
  let tree!: ModeRenderer;
  act(() => { tree = TestRenderer.create(<Calculate />) as ModeRenderer; });
  act(() => tree.root.findByProps({ value: 'project' }).props.onChange('check'));
  expect(mockRouter.setParams).toHaveBeenLastCalledWith({ mode: 'check', section: 'Savings' });
  expect(mockParams).toMatchObject({ target: 'opaque%key,with/slash', ri: '7' });
  act(() => tree.unmount());
});
