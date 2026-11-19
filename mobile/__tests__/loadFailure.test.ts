import { autoRetryDelayMs, classifyLoadFailure, failureMeansOffline, isRetryableTransportError, PayloadTransportError } from '../src/data/loadFailure';
import { MissingPublicPayloadError } from '../src/lib/automaticDataAccess';
import { uiLoadFailureStatus } from '../src/lib/uiCopy';

const at = '2026-11-19T00:00:00.000Z';

test.each<[unknown, boolean, string, number | null]>([
  [new PayloadTransportError('network'), false, 'network', null],
  [new PayloadTransportError('timeout'), false, 'timeout', null],
  [new PayloadTransportError('http', 500), false, 'server', 500],
  [new PayloadTransportError('http', 404), false, 'server', 404],
  [new PayloadTransportError('http', 404), true, 'pending', null],
  [new MissingPublicPayloadError('https://example.test/x'), true, 'pending', null],
  [new Error("today's ingest (2026-11-19) is still uploading; try again shortly"), true, 'pending', null],
  [new Error('cannot verify ingest finalisation for 2026-11-19; try again shortly'), true, 'pending', null],
  [new Error('Revision index unavailable; update pending'), true, 'pending', null],
  [new Error('No selected payload revision for 2026-11-19'), true, 'pending', null],
  [new Error('payload requires app >= 9.0.0 (have 1.0.0); update the app'), true, 'update', null],
  [new Error('payload schema v9 unsupported (app supports v1); update the app'), true, 'update', null],
  [new Error('network timeout'), true, 'timeout', null],
  [new Error('asset HTTP 502'), true, 'server', 502],
  [new Error('asset sha256 mismatch'), true, 'error', null],
])('classifies %s (cold=%s) as %s', (err, coldStart, kind, httpStatus) => {
  expect(classifyLoadFailure(err, at, { coldStart })).toEqual({ kind, httpStatus, at });
});

test('only connectivity classes mean offline', () => {
  expect(failureMeansOffline({ kind: 'network', httpStatus: null, at })).toBe(true);
  expect(failureMeansOffline({ kind: 'timeout', httpStatus: null, at })).toBe(true);
  expect(failureMeansOffline({ kind: 'server', httpStatus: 500, at })).toBe(false);
  expect(failureMeansOffline({ kind: 'pending', httpStatus: null, at })).toBe(false);
});

test('transient transport classes are retryable', () => {
  expect(isRetryableTransportError(new PayloadTransportError('network'))).toBe(true);
  expect(isRetryableTransportError(new PayloadTransportError('timeout'))).toBe(true);
  expect(isRetryableTransportError(new PayloadTransportError('http', 500))).toBe(true);
  expect(isRetryableTransportError(new PayloadTransportError('http', 429))).toBe(true);
  expect(isRetryableTransportError(new PayloadTransportError('http', 404))).toBe(false);
  expect(isRetryableTransportError(new Error('network error'))).toBe(false);
});

test('automatic retry schedule is 2, 5, 15, 30 then 60 s', () => {
  expect([0, 1, 2, 3, 4, 5, 9].map(autoRetryDelayMs)).toEqual([2000, 5000, 15000, 30000, 60000, 60000, 60000]);
});

test('status labels are reviewed labels with numeric HTTP facts', () => {
  expect(uiLoadFailureStatus({ kind: 'server', httpStatus: 503 })).toBe('Server error 503');
  expect(uiLoadFailureStatus({ kind: 'server', httpStatus: 9999 })).toBe('Server error');
  expect(uiLoadFailureStatus({ kind: 'pending', httpStatus: null })).toBe('Publishing pending');
  expect(uiLoadFailureStatus(null)).toBe('Unknown');
});
