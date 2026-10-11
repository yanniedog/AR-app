import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import type { DetailsPayload } from '../src/types';

const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => { mockStorage.set(key, value); }),
}));
const details: DetailsPayload = { schema_version: 1, run_date: '2026-10-12', products:
  Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`product-${i}`, {
    links: { overview: `https://bank.com.au/product/${i}` },
  }])) };
const request = { url: 'https://bank.com.au/product/0', purpose: 'lender_source' as const, label: 'Product overview' };
const inputs = { details, appBuild: 'test:123', revision: 'publication-a', platform: 'android', stopped: () => false };

describe('passive external link preloading', () => {
  it('checks exact OS destinations without transport, checkpoints compactly, resumes after restart, and refuses stale revisions', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(100_000);
    const handler = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    const network = jest.spyOn(globalThis, 'fetch');
    const module = jest.requireActual<typeof import('../src/lib/passiveAuditLinks')>('../src/lib/passiveAuditLinks');
    await module.preloadPassiveLinks(inputs);
    expect(module.passiveLinkProgress()).toEqual({ completed: 8, total: 25 });
    expect(handler).toHaveBeenCalledWith(request.url);
    expect(network).not.toHaveBeenCalled();
    expect(module.preloadedPassiveLink(request, inputs.appBuild, inputs.revision)?.result).toMatchObject({
      validation: { status: 'pass' }, handler: { status: 'pass' }, reachability: { attempted: false },
    });
    expect(module.preloadedPassiveLink(request, inputs.appBuild, 'publication-b')).toBeNull();
    expect(module.preloadedPassiveLink(request, 'new-build', inputs.revision)).toBeNull();
    expect(module.preloadedPassiveLink({ ...request, url: request.url + '?different=1' }, inputs.appBuild, inputs.revision)).toBeNull();
    const writes = (AsyncStorage.setItem as jest.Mock).mock.calls.length;
    await module.preloadPassiveLinks(inputs);
    expect(module.passiveLinkProgress().completed).toBe(16);
    expect((AsyncStorage.setItem as jest.Mock).mock.calls.length).toBe(writes);
    await module.flushPassiveLinks();
    const saved = mockStorage.get('ar-passive-links-v1')!;
    expect(saved.length).toBeLessThan(900 * 1024);
    expect(saved).not.toContain('Approved, credential-free');
    const stored = JSON.parse(saved);
    expect(stored.cursor).toBe(16);
    expect(stored.entries[0]).toEqual(['pass', 100_000, 0, true]);
    jest.resetModules();
    const cold = jest.requireActual<typeof import('../src/lib/passiveAuditLinks')>('../src/lib/passiveAuditLinks');
    await cold.preloadPassiveLinks({ ...inputs, details: null, revision: null, platform: 'web' });
    expect(cold.passiveLinkProgress().completed).toBe(24);
    expect(cold.preloadedPassiveLink(request, inputs.appBuild, inputs.revision)?.result.handler.status).toBe('pass');
    now.mockReturnValue(100_000 + 6 * 60 * 60 * 1000);
    expect(cold.preloadedPassiveLink(request, inputs.appBuild, inputs.revision)).toBeNull();
    now.mockRestore(); handler.mockRestore(); network.mockRestore();
  });

  it('does not start work when the manual audit has paused it', async () => {
    const module = jest.requireActual<typeof import('../src/lib/passiveAuditLinks')>('../src/lib/passiveAuditLinks');
    const progress = module.passiveLinkProgress();
    await module.preloadPassiveLinks({ ...inputs, stopped: () => true });
    expect(module.passiveLinkProgress()).toEqual(progress);
  });
});
