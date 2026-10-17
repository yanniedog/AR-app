import { makeHealthyDataFixture } from '../__fixtures__/appHealth';
import {
  AppHealthNetworkPolicy,
  AppHealthNetworkPolicyError,
  appHealthNetworkCheck,
  canonicalOfficialPublicDataUrl,
  executeAppHealthRequest,
} from '../src/lib/appHealth/networkPolicy';
import { ABS_HEADLINE_CPI_URL, OFFICIAL_PUBLIC_DATA_URLS } from '../src/data/officialEconomicSources';

describe('app-health network policy', () => {
  it('admits only compiled exact official data identities under their separate live purpose', async () => {
    const { contract } = makeHealthyDataFixture();
    const policy = new AppHealthNetworkPolicy();
    const handle = policy.begin({ mode: 'live-source', contract });
    const transport = jest.fn(async () => 'public CSV');
    for (const url of OFFICIAL_PUBLIC_DATA_URLS) {
      expect(canonicalOfficialPublicDataUrl(url)).toBe(url);
      await expect(executeAppHealthRequest(policy, handle, url, 'official-public-data', transport)).resolves.toBe('public CSV');
    }
    // The ABS query exception belongs only to this exact purpose and endpoint.
    expect(policy.authorize(handle, ABS_HEADLINE_CPI_URL, 'asset').allowed).toBe(false);
    for (const url of [ABS_HEADLINE_CPI_URL.replace('2015-01', '2000-01'),
      ABS_HEADLINE_CPI_URL.replace('startPeriod=2015-01&format=csv', 'format=csv&startPeriod=2015-01'),
      `${ABS_HEADLINE_CPI_URL}&_=1`, `${ABS_HEADLINE_CPI_URL}#fragment`,
      OFFICIAL_PUBLIC_DATA_URLS[0].replace('g1-data', 'g2-data'),
      OFFICIAL_PUBLIC_DATA_URLS[0].replace('www.rba.gov.au', 'other.rba.gov.au')]) {
      expect(canonicalOfficialPublicDataUrl(url)).toBeNull();
      expect(policy.authorize(handle, url, 'official-public-data').allowed).toBe(false);
    }
    expect(policy.end(handle)).toMatchObject({ transportCalls: 8, authorizedAttempts: 8, blockedAttempts: 7, policyViolations: 0 });
  });

  it('denies the exact official-data capability first in local mode', async () => {
    const { contract } = makeHealthyDataFixture();
    const policy = new AppHealthNetworkPolicy();
    const handle = policy.begin({ mode: 'local', contract });
    const transport = jest.fn();
    for (const url of OFFICIAL_PUBLIC_DATA_URLS) {
      expect(policy.authorize(handle, url, 'official-public-data')).toEqual({ allowed: false, reason: 'local-mode' });
      await expect(executeAppHealthRequest(policy, handle, url, 'official-public-data', transport)).rejects.toThrow('blocked');
    }
    expect(transport).not.toHaveBeenCalled();
    expect(policy.end(handle)).toMatchObject({ transportCalls: 0, authorizedAttempts: 0, blockedAttempts: 16, policyViolations: 0 });
  });

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
    expect(snapshot.violations).toEqual([{ reason: 'unattributed-transport' }]);
  });

  it('retains bounded detached local diagnostics without credentials, paths or query values', () => {
    const { contract } = makeHealthyDataFixture();
    const policy = new AppHealthNetworkPolicy();
    const handle = policy.begin({ mode: 'live-source', contract });
    for (let index = 0; index < 12; index += 1) {
      policy.recordPolicyViolation(handle, {
        purpose: 'asset', requestedUrl: `${contract.manifestUrl}?token=private-token`,
        finalUrl: 'https://user:password@blocked.example/account-123?token=secret#private',
        responseStatus: 302,
      });
    }
    const first = policy.snapshot(handle)!;
    expect(first.policyViolations).toBe(12);
    expect(first.violations).toHaveLength(8);
    expect(first.violations![0]).toMatchObject({
      reason: 'untrusted-final-url', purpose: 'asset', finalHost: 'blocked.example', responseStatus: 302,
    });
    (first.violations![0] as { finalHost: string }).finalHost = 'mutated.example';
    const actual = policy.end(handle)!;
    const check = appHealthNetworkCheck(actual);
    expect(check.status).toBe('fail');
    expect(actual.violations![0].finalHost).toBe('blocked.example');
    expect(check.metrics).not.toHaveProperty('networkViolations');
    const evidence = JSON.stringify(check.localEvidence);
    for (const value of ['private-token', 'password', 'account-123', 'secret', '#private', 'user:']) {
      expect(evidence).not.toContain(value);
    }
  });
});
