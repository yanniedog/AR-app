import { downloadSearchIndex } from '../src/data/payload';
import { payloadDownloadTimeoutMs } from '../src/data/payloadNetworkBudget';

let mockGuard = false;
jest.mock('../src/lib/appHealthTransportGuard', () => ({ hasAppHealthFetchGuard: () => mockGuard }));
jest.mock('../src/lib/yieldToUi', () => ({ yieldToUi: jest.fn(async () => undefined), parseJsonHeavy: jest.fn(async text => JSON.parse(text)) }));
const url = 'https://example.test/deadline-control.json';
const bytes = 5102102;

test('measured expanded details receive connection startup plus a0.5Mbps allowance', () => {
  expect(payloadDownloadTimeoutMs(bytes)).toBe(96634);
  expect(payloadDownloadTimeoutMs(bytes)).toBeGreaterThan(bytes * 8 / 500000 * 1000);
  expect(payloadDownloadTimeoutMs(1)).toBe(30000);
  expect(payloadDownloadTimeoutMs(64 * 1024 * 1024)).toBe(180000);
});

test.each([undefined, null, 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '5102102'])('malformed/unknown size %s keeps finite floor', value => {
  expect(payloadDownloadTimeoutMs(value)).toBe(30000);
});

test('XHR uses the same size deadline and caller abort still rejects immediately', async () => {
  const previous = globalThis.XMLHttpRequest;
  const xhr = { open: jest.fn(), send: jest.fn(), abort: jest.fn(), timeout: 0 };
  Object.defineProperty(globalThis, 'XMLHttpRequest', { configurable: true, value: jest.fn(() => xhr) });
  const controller = new AbortController();
  try {
    const pending = downloadSearchIndex(url, undefined, { expectedBytes: bytes, signal: controller.signal });
    expect(xhr.timeout).toBe(payloadDownloadTimeoutMs(bytes));
    const rejected = expect(pending).rejects.toThrow('cancelled');
    controller.abort();
    await rejected;
    expect(xhr.abort).toHaveBeenCalledTimes(1);
  } finally {
    Object.defineProperty(globalThis, 'XMLHttpRequest', { configurable: true, value: previous });
  }
});

test.each(['deadline', 'caller'] as const)('guarded fetch respects %s cancellation with size-aware deadline', async cause => {
  const previous = globalThis.fetch;
  jest.useFakeTimers(); mockGuard = true;
  let signal: AbortSignal | undefined;
  globalThis.fetch = jest.fn((_url, opts) => {
    signal = opts?.signal as AbortSignal;
    return new Promise((_resolve, reject) => signal!.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  }) as unknown as typeof fetch;
  const caller = new AbortController();
  try {
    const rejected = expect(downloadSearchIndex(url, undefined, { expectedBytes: bytes, signal: caller.signal })).rejects.toThrow('aborted');
    jest.advanceTimersByTime(30000);
    expect(signal?.aborted).toBe(false);
    if (cause === 'caller') caller.abort();
    else jest.advanceTimersByTime(payloadDownloadTimeoutMs(bytes) - 30000);
    expect(signal?.aborted).toBe(true);
    await rejected;
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    mockGuard = false; globalThis.fetch = previous; jest.useRealTimers();
  }
});

test('already-aborted request starts neither transport', async () => {
  const controller = new AbortController(); controller.abort();
  await expect(downloadSearchIndex(url, undefined, { expectedBytes: bytes, signal: controller.signal })).rejects.toThrow('cancelled');
});
