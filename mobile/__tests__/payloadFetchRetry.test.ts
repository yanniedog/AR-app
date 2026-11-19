import { downloadSearchIndex, PAYLOAD_FETCH_ATTEMPTS, payloadRetryBackoffMs, setPayloadRetrySleepForTests } from '../src/data/payload';
import { PayloadTransportError } from '../src/data/loadFailure';

jest.mock('../src/lib/appHealthTransportGuard', () => ({ hasAppHealthFetchGuard: () => false }));
jest.mock('../src/lib/yieldToUi', () => ({ yieldToUi: jest.fn(async () => undefined), parseJsonHeavy: jest.fn(async text => JSON.parse(text)) }));

type Outcome = { status: number } | 'network' | 'timeout';
const url = 'https://example.test/retry-control.json';
const body = new TextEncoder().encode(JSON.stringify({ run_date: '2026-11-19' }));
let previous: typeof XMLHttpRequest;
let sleeps: number[];

function installXhr(outcomes: Outcome[]) {
  const requests: string[] = [];
  Object.defineProperty(globalThis, 'XMLHttpRequest', {
    configurable: true,
    value: jest.fn(() => {
      const xhr = {
        open: jest.fn((_method: string, target: string) => requests.push(target)),
        setRequestHeader: jest.fn(), abort: jest.fn(), timeout: 0, status: 0,
        response: null as ArrayBuffer | null,
        onload: null as null | (() => void), onerror: null as null | (() => void),
        ontimeout: null as null | (() => void), onloadend: null as null | (() => void),
        send: jest.fn(() => {
          const outcome = outcomes.shift() ?? { status: 200 };
          queueMicrotask(() => {
            if (outcome === 'network') xhr.onerror?.();
            else if (outcome === 'timeout') xhr.ontimeout?.();
            else {
              xhr.status = outcome.status;
              xhr.response = outcome.status === 200 ? body.slice().buffer : null;
              xhr.onload?.();
            }
            xhr.onloadend?.();
          });
        }),
      };
      return xhr;
    }),
  });
  return requests;
}

beforeEach(() => {
  previous = globalThis.XMLHttpRequest;
  sleeps = [];
  setPayloadRetrySleepForTests(async (ms) => { sleeps.push(ms); });
});
afterEach(() => {
  setPayloadRetrySleepForTests(null);
  Object.defineProperty(globalThis, 'XMLHttpRequest', { configurable: true, value: previous });
});

test.each<[string, Outcome]>([
  ['network error', 'network'],
  ['timeout', 'timeout'],
  ['HTTP 503', { status: 503 }],
  ['HTTP 429', { status: 429 }],
])('retries a transient %s and then succeeds', async (_name, failure) => {
  const requests = installXhr([failure, failure]);
  const result = await downloadSearchIndex(url);
  expect(result.searchIndex).toEqual({ run_date: '2026-11-19' });
  expect(requests).toHaveLength(3);
  expect(sleeps).toHaveLength(2);
});

test('gives up after the bounded attempt count with a classified error', async () => {
  const requests = installXhr(['network', 'network', 'network', 'network']);
  const error = await downloadSearchIndex(url).catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(PayloadTransportError);
  expect((error as Error).message).toBe('network error');
  expect(requests).toHaveLength(PAYLOAD_FETCH_ATTEMPTS);
});

test.each([404, 400, 403])('does not retry HTTP %s', async (status) => {
  const requests = installXhr([{ status }]);
  await expect(downloadSearchIndex(url)).rejects.toThrow(`asset HTTP ${status}`);
  expect(requests).toHaveLength(1);
  expect(sleeps).toHaveLength(0);
});

test('backoff is exponential with bounded jitter', () => {
  expect(payloadRetryBackoffMs(0, () => 0)).toBe(250);
  expect(payloadRetryBackoffMs(0, () => 1)).toBe(750);
  expect(payloadRetryBackoffMs(1, () => 0.5)).toBe(1000);
  expect(payloadRetryBackoffMs(2, () => 0.5)).toBe(2000);
});
