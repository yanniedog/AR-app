import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { DebugLogUploadStatus } from '../src/components/DebugLogUploadStatus';

let mockSnapshot: Record<string, unknown>;
type Tree = ReactTestRenderer & { root: {
  findByType(type: string): { props: Record<string, unknown> };
  findAllByType(type: string): { props: Record<string, unknown> }[];
} };
jest.mock('../src/lib/debugLogSharing', () => ({
  getDebugLogUploadSnapshot: () => mockSnapshot,
  subscribeDebugLogUpload: () => () => {},
  retryDebugLogUpload: jest.fn(),
}));
jest.mock('../src/components/AuditOutcomeSymbols', () => ({ AuditDeliverySymbol: 'AuditDeliverySymbol' }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Card: 'Card' }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

test.each([
  ['restored verified receipt', true, null, false, 'verified', 'Uploaded'],
  ['verified delivery with clipboard error', true, 'Clipboard unavailable', false, 'verified', 'Copy failed'],
  ['uncertain public delivery', false, 'Response unavailable', true, 'uncertain', 'Upload uncertain'],
])('%s keeps truthful delivery and error labels', (_name, verified, error, mayHaveUploaded, outcome, label) => {
  mockSnapshot = { sessionId: 'report', phase: 'failed', verified, error, mayHaveUploaded, url: 'https://example.test/report' };
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<DebugLogUploadStatus sessionId="report" />) as Tree; });
  try {
    expect(tree.root.findByType('AuditDeliverySymbol').props.outcome).toBe(outcome);
    expect(tree.root.findAllByType('AppText')[0].props.children).toBe(label);
  } finally { act(() => tree.unmount()); }
});

test.each(['idle', 'other-report'])('%s cannot borrow another report upload status', source => {
  mockSnapshot = { sessionId: source === 'idle' ? 'report' : source, phase: source === 'idle' ? 'idle' : 'copied',
    verified: true, error: null, mayHaveUploaded: false, url: 'https://example.test/other' };
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<DebugLogUploadStatus sessionId="report" />) as Tree; });
  try {
    expect(tree.root.findByType('AuditDeliverySymbol').props.outcome).toBe('local');
    expect(tree.root.findAllByType('AppText')).toHaveLength(0);
  } finally { act(() => tree.unmount()); }
});
