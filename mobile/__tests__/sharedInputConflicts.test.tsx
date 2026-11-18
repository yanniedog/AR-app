import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { SharedInputConflicts } from '../src/components/SharedInputConflicts';
import { normalizeUserRateScenario } from '../src/data/userRateScenarioModel';
import type { CustomerProfile } from '../src/data/customerProfile';

type Node = { props: { title: string; onPress: () => void } };
type Renderer = ReactTestRenderer & { root: { findAllByType(type: string): Node[] } };
let mockProfile: CustomerProfile;
const mockUpdate = jest.fn(async (change: (profile: CustomerProfile) => CustomerProfile) => { mockProfile = change(mockProfile); return true; });
jest.mock('../src/hooks/useCustomerProfile', () => ({ useCustomerProfile: () => ({ profile: mockProfile, busy: false, update: mockUpdate }) }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Row: 'Row' }));

test('Keep current displays the edited amount instead of a stale migration value', () => {
  mockProfile = { version: 1, revision: 1, answers: {}, definitions: {}, negotiatedTerms: [], legacyScenario: null,
    inputState: { version: 1, scenario: normalizeUserRateScenario({ mortgage: { mode: 'refi', loanBalance: '700000' } }),
      comparison: { lvr: '', facets: { loanPurposes: [], repaymentTypes: [] } }, legacyComparison: null,
      conflicts: [{ path: 'mortgage.loanBalance', current: '650000', incoming: '600000' }] } };
  let tree!: Renderer;
  act(() => { tree = TestRenderer.create(<SharedInputConflicts />) as Renderer; });
  try {
    const keep = tree.root.findAllByType('Button').find(node => node.props.title.startsWith('Keep current'))!;
    expect(keep.props.title).toContain('700');
    expect(keep.props.title).not.toContain('650');
    act(() => keep.props.onPress());
    expect(mockProfile.inputState?.scenario.mortgage.loanBalance).toBe('700000');
    expect(mockProfile.inputState?.conflicts).toHaveLength(0);
  } finally { act(() => tree.unmount()); }
});
