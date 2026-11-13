import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { AuditBankResponseCoverage } from '../src/components/AuditBankResponseCoverage';
import type { AppHealthCheck } from '../src/lib/appHealth/types';
import type { BankResponseCoverageRow } from '../src/lib/appHealth/bankResponseCoverage';

jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Card: 'Card' }));
jest.mock('../src/components/settings/settingsUi', () => ({ InfoRow: 'InfoRow' }));

type Node = { type: unknown; props: Record<string, any>; findByProps: (props: Record<string, unknown>) => Node;
  findAll: (predicate: (node: Node) => boolean) => Node[] };
type Renderer = ReactTestRenderer & { root: Node };

it('bounds mounted evidence while keeping every one of 1320 rows reachable', () => {
  const rows: BankResponseCoverageRow[] = Array.from({ length: 1320 }, (_, index) => ({
    provider: `Bank ${index}`, section: 'Savings', decisionDate: '2026-11-03', windowEnd: '2026-11-13',
    sourceReason: 'no-recorded-move', displayReason: 'no-recorded-move', missingDays: 0,
    baselineAvailable: true, displayed: true, moveKnown: false, timingKnown: false, firstMoveVerified: false,
  }));
  const check = { metrics: {}, localEvidence: { bankResponseCoverage: { rows } } } as unknown as AppHealthCheck;
  let tree!: Renderer;
  act(() => { tree = TestRenderer.create(<AuditBankResponseCoverage check={check} />) as Renderer; });
  const press = (title: string) => act(() => tree.root.findByProps({ title }).props.onPress());
  const renderedRows = () => tree.root.findAll(node => node.type === 'AppText' &&
    typeof node.props.children === 'string' && /^Bank \d/.test(node.props.children));
  expect(renderedRows()).toHaveLength(0);
  press('Show');
  const seen = new Set<string>();
  for (let page = 0; page < 33; page += 1) {
    expect(renderedRows()).toHaveLength(40);
    renderedRows().forEach(node => seen.add(node.props.children));
    expect(tree.root.findByProps({ title: 'Previous' }).props.disabled).toBe(page === 0);
    expect(tree.root.findByProps({ title: 'Next' }).props.disabled).toBe(page === 32);
    if (page < 32) press('Next');
  }
  expect(seen.size).toBe(1320);
  expect(rows).toHaveLength(1320);
  press('Previous');
  expect(renderedRows()[0].props.children).toContain('Bank 1240');
  press('Hide');
  expect(renderedRows()).toHaveLength(0);
  press('Show');
  expect(renderedRows()[0].props.children).toContain('Bank 0');
  press('Next');
  act(() => { tree.update(<AuditBankResponseCoverage check={{ ...check, localEvidence: {
    bankResponseCoverage: { rows: rows.slice(0, 1) },
  } }} />); });
  expect(renderedRows()).toHaveLength(1);
  expect(tree.root.findByProps({ title: 'Next' }).props.disabled).toBe(true);
  act(() => tree.unmount());
});
