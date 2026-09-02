import { makeHealthyDataFixture } from '../__fixtures__/appHealth';
import {
  AppHealthNetworkPolicy,
  AppHealthNetworkPolicyError,
  appHealthNetworkCheck,
  executeAppHealthRequest,
} from '../src/lib/appHealth/networkPolicy';

describe('app-health network policy', () => {
  it('reports a clean local session only when no transport boundary was crossed', () => {
    const { contract } = makeHealthyDataFixture();
    const policy = new AppHealthNetworkPolicy();
    const handle = policy.begin({ mode: 'local', contract });

    expect(appHealthNetworkCheck(policy.end(handle)!)).toMatchObject({
      status: 'pass',
      metrics: { transportCalls: 0, policyViolations: 0 },
    });
  });

  it('proves local mode does not invoke a transport', async () => {
    const { contract } = makeHealthyDataFixture();
    const policy = new AppHealthNetworkPolicy();
    const handle = policy.begin({ mode: 'local', contract });
    const transport = jest.fn(async () => 'should-not-run');

    await expect(
      executeAppHealthRequest(
        policy,
        handle,
        contract.manifestUrl,
        'manifest',
        transport,
      ),
    ).rejects.toBeInstanceOf(AppHealthNetworkPolicyError);

    expect(transport).not.toHaveBeenCalled();
    const snapshot = policy.end(handle)!;
    expect(snapshot).toMatchObject({
      mode: 'local',
      blockedAttempts: 1,
      authorizedAttempts: 0,
      transportCalls: 0,
      policyViolations: 0,
    });
    expect(appHealthNetworkCheck(snapshot).status).toBe('warn');
  });

  it('allows only exact live-source endpoints and manifest-declared assets', async () => {
    const { contract, snapshot } = makeHealthyDataFixture();
    const coreUrl = snapshot.manifest!.files.core.url;
    const datedManifestUrl = `https://github.com/${contract.repo}/releases/download/${contract.datedTagPrefix}2026-09-01/manifest.json`;
    const policy = new AppHealthNetworkPolicy();
    const handle = policy.begin({
      mode: 'live-source',
      contract,
      declaredAssetUrls: [coreUrl, 'https://example.com/not-trusted.json'],
      declaredManifestUrls: [datedManifestUrl, 'https://example.com/not-trusted.json'],
    });
    const transport = jest.fn(async () => 'ok');

    await expect(
      executeAppHealthRequest(
        policy,
        handle,
        `${contract.manifestUrl}?_=${Date.now()}`,
        'manifest',
        transport,
      ),
    ).resolves.toBe('ok');
    await expect(
      executeAppHealthRequest(policy, handle, coreUrl, 'asset', transport),
    ).resolves.toBe('ok');
    await expect(
      executeAppHealthRequest(policy, handle, datedManifestUrl, 'manifest', transport),
    ).resolves.toBe('ok');

    expect(policy.authorize(handle, contract.manifestUrl, 'asset').allowed).toBe(false);
    expect(
      policy.authorize(
        handle,
        `https://github.com/${contract.repo}/releases/download/other/private.json`,
        'asset',
      ).allowed,
    ).toBe(false);
    expect(policy.authorize(handle, `${contract.manifestUrl}?token=secret`, 'manifest').allowed).toBe(false);
    expect(transport).toHaveBeenCalledTimes(3);

    const result = policy.end(handle)!;
    expect(result.transportCalls).toBe(3);
    expect(result.blockedAttempts).toBe(3);
    expect(appHealthNetworkCheck(result).status).toBe('warn');
  });

  it('rejects nested sessions and stale handles', () => {
    const { contract } = makeHealthyDataFixture();
    const policy = new AppHealthNetworkPolicy();
    const first = policy.begin({ mode: 'local', contract });
    expect(() => policy.begin({ mode: 'live-source', contract })).toThrow(/already active/i);
    expect(policy.end(first)).not.toBeNull();

    const second = policy.begin({ mode: 'live-source', contract });
    expect(policy.authorize(first, contract.manifestUrl, 'manifest')).toEqual({
      allowed: false,
      reason: 'inactive-session',
    });
    expect(policy.end(second)).not.toBeNull();
  });

  it('fails health when transport is recorded without an authorization credit', () => {
    const { contract } = makeHealthyDataFixture();
    const policy = new AppHealthNetworkPolicy();
    const handle = policy.begin({ mode: 'live-source', contract });

    policy.recordTransport(handle, { allowed: true, reason: 'allowlisted' });
    const snapshot = policy.end(handle)!;

    expect(snapshot.policyViolations).toBe(1);
    expect(appHealthNetworkCheck(snapshot).status).toBe('fail');
  });
});
