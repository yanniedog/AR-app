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

test.each([false, true])('an audit never borrows a retained recovery URL even when verified=%s', verified => {
  mockSnapshot = { sessionId: 'audit-b', phase: 'failed', verified, error: 'Recovery required',
    mayHaveUploaded: false, url: 'https://paste.c-net.org/audit-a', recoveryReceipt: {
      schemaVersion: 1, provider: 'paste.c-net.org', url: 'https://paste.c-net.org/audit-a',
      deleteKey: 'fixture-only', createdAt: '2026-10-15T19:00:00Z',
    } };
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<DebugLogUploadStatus sessionId="audit-b" />) as Tree; });
  try {
    expect(tree.root.findAllByType('AppText').some(node => node.props.children === mockSnapshot.url)).toBe(false);
    expect(tree.root.findAllByType('Button').find(node => node.props.title === 'Debug log')).toBeDefined();
    const retry = tree.root.findAllByType('Button').filter(node => node.props.title === (verified ? 'Copy link' : 'Retry verification'));
    expect(retry).toHaveLength(1);
    expect(retry[0].props.disabled).toBe(true);
    const recovery = tree.root.findAllByType('Button').find(node => node.props.title === 'Debug log')!;
    expect(recovery.props.disabled).not.toBe(true);
  } finally { act(() => tree.unmount()); }
});

test('an unverified URL stays hidden in its audit while generic debug recovery retains the address', () => {
  mockSnapshot = { sessionId: 'audit-b', phase: 'failed', verified: false, error: 'Verification failed',
    mayHaveUploaded: true, url: 'https://paste.c-net.org/unverified' };
  let scoped!: Tree, generic!: Tree;
  act(() => {
    scoped = TestRenderer.create(<DebugLogUploadStatus sessionId="audit-b" />) as Tree;
    generic = TestRenderer.create(<DebugLogUploadStatus />) as Tree;
  });
  try {
    expect(scoped.root.findAllByType('AppText').some(node => node.props.children === mockSnapshot.url)).toBe(false);
    expect(scoped.root.findAllByType('Button').some(node => node.props.title === 'Retry verification')).toBe(true);
    expect(generic.root.findAllByType('AppText').some(node => node.props.children === mockSnapshot.url)).toBe(true);
  } finally { act(() => { scoped.unmount(); generic.unmount(); }); }
});
