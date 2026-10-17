import { getLocalAppHealthAuditGeneration, installAppHealthTransportGuard, isLocalAppHealthAudit } from '../src/lib/appHealthTransportGuard';
import { createV1AppHealthSourceContract } from '../src/lib/appHealth/sourceContract';
import { automaticDataUrl } from '../src/lib/automaticDataAccess';
import { APK_MANIFEST_URL } from '../src/config';
import { ABS_HEADLINE_CPI_URL, OFFICIAL_PUBLIC_DATA_URLS } from '../src/data/officialEconomicSources';

function targetWithSpies() {
  const fetchSpy = jest.fn(async (input: RequestInfo | URL) => ({
    ok: true,
    redirected: false,
    url: typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url,
  })) as unknown as typeof fetch;
  class FakeXhr {
    open = jest.fn();
    send = jest.fn();
  }
  return {
    target: {
      fetch: fetchSpy,
      XMLHttpRequest: { prototype: FakeXhr.prototype },
    },
    fetchSpy,
    FakeXhr,
  };
}

it('reports local mode only while the global fetch guard is installed', () => {
  const contract = createV1AppHealthSourceContract();
  const generation = getLocalAppHealthAuditGeneration();
  expect(isLocalAppHealthAudit()).toBe(false);
  const guard = installAppHealthTransportGuard({ target: globalThis, mode: 'local', contract });
  try { expect(isLocalAppHealthAudit()).toBe(true); } finally { guard.restore(); }
  expect(isLocalAppHealthAudit()).toBe(false);
  expect(getLocalAppHealthAuditGeneration()).toBe(generation + 1);
});

describe('installAppHealthTransportGuard', () => {
  const contract = createV1AppHealthSourceContract({
    manifestUrl: 'https://example.test/manifest.json',
    datesIndexUrl: 'https://example.test/dates-index.json',
  });

  it('permits only the eight exact credential-free official CSV GETs without widening the payload or link policies', async () => {
    const { target, fetchSpy } = targetWithSpies();
    const guard = installAppHealthTransportGuard({ target, mode: 'live-source', contract });
    const safe = { method: 'GET', credentials: 'omit', headers: { Accept: 'text/csv' } } as const;
    try {
      for (const url of OFFICIAL_PUBLIC_DATA_URLS) await expect(target.fetch(url, safe)).resolves.toMatchObject({ ok: true, url });
      expect(fetchSpy).toHaveBeenCalledTimes(8);
      expect(fetchSpy).toHaveBeenCalledWith(ABS_HEADLINE_CPI_URL, safe);
      expect(guard.snapshot()).toMatchObject({ authorizedAttempts: 8, transportCalls: 8, policyViolations: 0, blockedAttempts: 0 });
      await expect(target.fetch(OFFICIAL_PUBLIC_DATA_URLS[0], { method: 'HEAD', credentials: 'omit' })).rejects.toThrow('blocked');
      expect(fetchSpy).toHaveBeenCalledTimes(8);
    } finally { guard.restore(); }
  });

  it('rejects unsafe official request forms before transport, including headers, bodies and referrer tunnels', async () => {
    const { target, fetchSpy } = targetWithSpies();
    const guard = installAppHealthTransportGuard({ target, mode: 'live-source', contract });
    const url = OFFICIAL_PUBLIC_DATA_URLS[0];
    const safe = { method: 'GET', credentials: 'omit', headers: { Accept: 'text/csv' } } as const;
    const getter = jest.fn(() => 'GET');
    const invalid: (RequestInit | undefined)[] = [undefined, {},
      { ...safe, method: 'POST' }, { ...safe, method: 'HEAD' }, { ...safe, credentials: 'include' },
      { ...safe, credentials: undefined }, { ...safe, body: 'private' },
      { ...safe, headers: { Accept: 'text/csv', Authorization: 'private' } },
      { ...safe, headers: { Cookie: 'private' } }, { ...safe, headers: { Accept: 'application/json' } },
      { ...safe, headers: { 'X-Private': 'private' } }, { ...safe, referrer: 'https://private.test/account' },
      { ...safe, redirect: 'follow' }, Object.defineProperty({ credentials: 'omit' }, 'method', { get: getter }),
    ];
    try {
      for (const init of invalid) await expect(target.fetch(url, init)).rejects.toThrow('blocked');
      await expect(target.fetch(new Request(url), safe)).rejects.toThrow('blocked');
      await expect(target.fetch(new URL(url), safe)).rejects.toThrow('blocked');
      expect(getter).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(guard.snapshot()).toMatchObject({ blockedAttempts: invalid.length + 2, transportCalls: 0, policyViolations: 0 });
    } finally { guard.restore(); }
  });

  it('denies sibling endpoints, changed query identity, unknown hosts and insecure or credentialed URLs', async () => {
    const { target, fetchSpy } = targetWithSpies();
    const guard = installAppHealthTransportGuard({ target, mode: 'live-source', contract });
    const url = OFFICIAL_PUBLIC_DATA_URLS[0];
    const safe = { method: 'GET', credentials: 'omit', headers: { Accept: 'text/csv' } } as const;
    const invalid = [url.replace('g1-data', 'unknown'), url.replace('www.rba.gov.au', 'unknown.test'),
      url.replace('www.rba.gov.au', 'sub.rba.gov.au'), url.replace('https:', 'http:'),
      url.replace('www.rba.gov.au', 'www.rba.gov.au:443'), url.replace('https://', 'https://user:password@'),
      `${url}?_=123`, `${url}#fragment`, ABS_HEADLINE_CPI_URL.replace('2015-01', '2000-01'),
      ABS_HEADLINE_CPI_URL.replace('startPeriod=2015-01&format=csv', 'format=csv&startPeriod=2015-01'),
      `${ABS_HEADLINE_CPI_URL}&extra=1`, ABS_HEADLINE_CPI_URL.replace('data.api.abs.gov.au', 'www.abs.gov.au')];
    try {
      for (const value of invalid) await expect(target.fetch(value, safe)).rejects.toThrow('blocked');
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(guard.snapshot()).toMatchObject({ blockedAttempts: invalid.length, transportCalls: 0 });
    } finally { guard.restore(); }
  });

  it('requires the exact official final URL and records a real violation for a redirect or missing identity', async () => {
    const url = OFFICIAL_PUBLIC_DATA_URLS[0];
    const finals = [{ url: OFFICIAL_PUBLIC_DATA_URLS[1], redirected: true },
      { url: 'https://unknown.test/data.csv', redirected: true },
      { url: `${url}?extra=1`, redirected: false }, { url: '', redirected: false },
      { url, redirected: true }];
    const { target, fetchSpy } = targetWithSpies();
    for (const final of finals) jest.mocked(fetchSpy).mockResolvedValueOnce({ ok: true, status: 200, ...final } as Response);
    const guard = installAppHealthTransportGuard({ target, mode: 'live-source', contract });
    try {
      for (let attempt = 0; attempt < finals.length; attempt += 1) await expect(target.fetch(url, { method: 'GET', credentials: 'omit', headers: { Accept: 'text/csv' } })).rejects.toThrow('blocked');
      expect(guard.snapshot()).toMatchObject({ authorizedAttempts: 5, transportCalls: 5, policyViolations: 5 });
      expect(guard.snapshot().violations?.every(item => item.purpose === 'official-public-data' && item.requestedHost === 'www.rba.gov.au')).toBe(true);
    } finally { guard.restore(); }
  });

  it('keeps all official source GETs and direct XHR blocked in a local audit', async () => {
    const { target, fetchSpy } = targetWithSpies();
    const guard = installAppHealthTransportGuard({ target, mode: 'local', contract });
    try {
      for (const url of OFFICIAL_PUBLIC_DATA_URLS) await expect(target.fetch(url, { method: 'GET', credentials: 'omit', headers: { Accept: 'text/csv' } })).rejects.toThrow('blocked');
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(guard.snapshot()).toMatchObject({ blockedAttempts: 8, authorizedAttempts: 0, transportCalls: 0 });
    } finally { guard.restore(); }
    class SourceXhr { open(_method: string, _url: string | URL, ..._rest: unknown[]): void {} send(): void {} }
    const send = jest.spyOn(SourceXhr.prototype, 'send');
    const xhrTarget = { fetch: fetchSpy, XMLHttpRequest: { prototype: SourceXhr.prototype } };
    const live = installAppHealthTransportGuard({ target: xhrTarget, mode: 'live-source', contract });
    try {
      const xhr = new SourceXhr();
      xhr.open('GET', OFFICIAL_PUBLIC_DATA_URLS[0]);
      expect(() => xhr.send()).toThrow('blocked');
      expect(send).not.toHaveBeenCalled();
      expect(live.snapshot()).toMatchObject({ blockedAttempts: 1, transportCalls: 0 });
    } finally { live.restore(); send.mockRestore(); }
  });

  it('temporarily permits only exact credential-free configured APK manifest GETs', async () => {
    const { target, fetchSpy } = targetWithSpies();
    const guard = installAppHealthTransportGuard({ target, mode: 'live-source', contract });
    const safe = { method: 'GET', credentials: 'omit' } as const;
    await expect(target.fetch(APK_MANIFEST_URL, safe)).rejects.toThrow('blocked');
    const end = guard.beginAppUpdateMetadata();
    try {
      await expect(target.fetch(`${APK_MANIFEST_URL}?_=1234`, safe)).resolves.toMatchObject({ ok: true });
      for (const init of [{ method: 'POST', credentials: 'omit' }, { method: 'GET', credentials: 'include' },
        { ...safe, headers: { Authorization: 'private' } }, { ...safe, body: 'private' }]) {
        await expect(target.fetch(APK_MANIFEST_URL, init as RequestInit)).rejects.toThrow('blocked');
      }
      for (const url of [APK_MANIFEST_URL.replace('.json', '.apk'), `${APK_MANIFEST_URL}?extra=1`,
        APK_MANIFEST_URL.replace('AR-app/', 'another-repo/')]) {
        await expect(target.fetch(url, safe)).rejects.toThrow('blocked');
      }
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    } finally { end(); }
    await expect(target.fetch(APK_MANIFEST_URL, safe)).rejects.toThrow('blocked');
    guard.restore();
  });

  it('never grants update manifest transport in local mode', async () => {
    const { target, fetchSpy } = targetWithSpies();
    const guard = installAppHealthTransportGuard({ target, mode: 'local', contract });
    const end = guard.beginAppUpdateMetadata();
    try {
      await expect(target.fetch(APK_MANIFEST_URL, { method: 'GET', credentials: 'omit' })).rejects.toThrow('blocked');
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally { end(); guard.restore(); }
  });

  it('accepts approved APK delivery but rejects untrusted or missing final locations', async () => {
    const { target, fetchSpy } = targetWithSpies();
    jest.mocked(fetchSpy).mockResolvedValueOnce({ ok: true, url: 'https://release-assets.githubusercontent.com/release/file?public=1' } as Response)
      .mockResolvedValueOnce({ ok: true, url: 'https://untrusted.test/metadata.json' } as Response)
      .mockResolvedValueOnce({ ok: true, url: '' } as Response);
    const guard = installAppHealthTransportGuard({ target, mode: 'live-source', contract });
    const end = guard.beginAppUpdateMetadata();
    try {
      await expect(target.fetch(APK_MANIFEST_URL, { method: 'GET', credentials: 'omit' })).resolves.toMatchObject({ ok: true });
      await expect(target.fetch(APK_MANIFEST_URL, { method: 'GET', credentials: 'omit' })).rejects.toThrow('blocked');
      await expect(target.fetch(APK_MANIFEST_URL, { method: 'GET', credentials: 'omit' })).rejects.toThrow('blocked');
      expect(guard.snapshot().policyViolations).toBe(2);
    } finally { end(); guard.restore(); }
  });

  it('checks exact approved external destinations with credential-free HEAD only', async () => {
    const { target, fetchSpy } = targetWithSpies();
    const guard = installAppHealthTransportGuard({ target, mode: 'live-source', contract });
    const request = { url: 'https://www.rba.gov.au/statistics/tables/?table=f1',
      label: 'Statistics', purpose: 'official_economic_source' as const };
    expect(guard.allowExternalUrls([request, { ...request, url: 'https://untrusted.test/' }])).toBe(1);
    try {
      await expect(target.fetch(request.url, { method: 'HEAD', credentials: 'omit' })).resolves.toMatchObject({ ok: true });
      await expect(target.fetch(request.url)).rejects.toThrow('blocked');
      await expect(target.fetch(request.url, { method: 'HEAD', credentials: 'include' })).rejects.toThrow('blocked');
      await expect(target.fetch('https://www.rba.gov.au/statistics/other/', { method: 'HEAD', credentials: 'omit' })).rejects.toThrow('blocked');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    } finally { guard.restore(); }
  });

  it('preserves zero transport for external destinations in local mode', async () => {
    const { target, fetchSpy } = targetWithSpies();
    const guard = installAppHealthTransportGuard({ target, mode: 'local', contract });
    const request = { url: 'https://www.rba.gov.au/statistics/tables/',
      label: 'Statistics', purpose: 'official_economic_source' as const };
    expect(guard.allowExternalUrls([request])).toBe(0);
    try {
      await expect(target.fetch(request.url, { method: 'HEAD', credentials: 'omit' })).rejects.toThrow('blocked');
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally { guard.restore(); }
  });

  it('registers successive external batches without granting later or sibling destinations early', async () => {
    const { target, fetchSpy } = targetWithSpies();
    const guard = installAppHealthTransportGuard({ target, mode: 'live-source', contract });
    const requests = ['f1', 'f2', 'f3', 'f4', 'f5'].map(table => ({
      url: `https://www.rba.gov.au/statistics/tables/?table=${table}`,
      label: 'Statistics', purpose: 'official_economic_source' as const,
    }));
    const head = (url: string) => target.fetch(url, { method: 'HEAD', credentials: 'omit' });
    try {
      expect(guard.allowExternalUrls(requests.slice(0, 4))).toBe(4);
      await expect(head(requests[4].url)).rejects.toThrow('blocked');
      expect(fetchSpy).not.toHaveBeenCalled();
      for (const request of requests.slice(0, 4)) await expect(head(request.url)).resolves.toMatchObject({ ok: true });
      expect(guard.allowExternalUrls(requests.slice(4))).toBe(1);
      await expect(head(requests[4].url)).resolves.toMatchObject({ ok: true });
      await expect(head(requests[0].url)).resolves.toMatchObject({ ok: true });
      await expect(head(`${requests[4].url}0`)).rejects.toThrow('blocked');
      expect(fetchSpy).toHaveBeenCalledTimes(6);
      expect(guard.snapshot().policyViolations).toBe(0);
    } finally { guard.restore(); }
  });

  it('blocks fetch before transport in local mode and restores it', async () => {
    const { target, fetchSpy } = targetWithSpies();
    const original = target.fetch;
    const guard = installAppHealthTransportGuard({ target, mode: 'local', contract });
    await expect(target.fetch(contract.manifestUrl)).rejects.toThrow('blocked');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(guard.snapshot()).toMatchObject({ blockedAttempts: 1, transportCalls: 0 });
    guard.restore();
    expect(target.fetch).toBe(original);
  });

  it('allows only declared live-source fetches', async () => {
    const { target, fetchSpy } = targetWithSpies();
    const guard = installAppHealthTransportGuard({ target, mode: 'live-source', contract });
    await target.fetch(contract.manifestUrl);
    await expect(target.fetch('https://elsewhere.test/data.json')).rejects.toThrow('blocked');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(guard.snapshot()).toMatchObject({ authorizedAttempts: 1, blockedAttempts: 1, transportCalls: 1 });
    guard.restore();
  });

  it('uses standards canonicalization when the native global has getter-only properties', async () => {
    const originalUrl = globalThis.URL;
    globalThis.URL = jest.requireActual('react-native/Libraries/Blob/URL').URL;
    const { target } = targetWithSpies();
    const guard = installAppHealthTransportGuard({ target, mode: 'live-source', contract });
    try {
      await expect(target.fetch(contract.manifestUrl)).resolves.toMatchObject({ ok: true });
      await expect(target.fetch(`${contract.manifestUrl}?_=123`)).resolves.toMatchObject({ ok: true });
    } finally {
      guard.restore();
      globalThis.URL = originalUrl;
    }
  });

  it('accepts cache-busted contract URLs without URLSearchParams.size on native', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(URLSearchParams.prototype, 'size');
    Object.defineProperty(URLSearchParams.prototype, 'size', { configurable: true, get: () => undefined });
    const { target, fetchSpy } = targetWithSpies();
    const guard = installAppHealthTransportGuard({ target, mode: 'live-source', contract });
    try {
      await expect(target.fetch(`${contract.datesIndexUrl}?_=12345`)).resolves.toMatchObject({ ok: true });
      await expect(target.fetch(`${contract.manifestUrl}?_=12345`)).resolves.toMatchObject({ ok: true });
      await expect(target.fetch(`${contract.datesIndexUrl}?_=12345&extra=1`)).rejects.toThrow('blocked');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    } finally {
      guard.restore();
      if (descriptor) Object.defineProperty(URLSearchParams.prototype, 'size', descriptor);
      else Reflect.deleteProperty(URLSearchParams.prototype, 'size');
    }
  });

  it('admits only manifest-declared assets after the manifest is read', async () => {
    const { target, fetchSpy } = targetWithSpies();
    const githubContract = createV1AppHealthSourceContract();
    const assetUrl = `https://github.com/${githubContract.repo}/releases/download/app-payload-latest/core.json.gz`;
    const guard = installAppHealthTransportGuard({ target, mode: 'live-source', contract: githubContract });
    await expect(target.fetch(assetUrl)).rejects.toThrow('blocked');
    expect(guard.allowManifestAssets([assetUrl, 'https://untrusted.test/core.json.gz'])).toBe(1);
    await expect(target.fetch(assetUrl)).resolves.toMatchObject({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    guard.restore();
  });

  it('accepts exact Cloudflare delivery but rejects an untrusted final host', async () => {
    const fetchSpy = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        redirected: false,
        url: 'https://ar-app-data.jkokavec.workers.dev/v1/release/app-payload-latest/manifest.json',
      })
      .mockResolvedValueOnce({
        ok: true,
        redirected: true,
        url: 'https://untrusted.test/manifest.json',
      }) as unknown as typeof fetch;
    const target = { fetch: fetchSpy };
    const githubContract = createV1AppHealthSourceContract();
    const guard = installAppHealthTransportGuard({
      target,
      mode: 'live-source',
      contract: githubContract,
    });

    await expect(target.fetch(githubContract.manifestUrl)).resolves.toMatchObject({ ok: true });
    await expect(target.fetch(githubContract.manifestUrl)).rejects.toThrow('blocked');
    expect(guard.snapshot()).toMatchObject({
      authorizedAttempts: 2,
      transportCalls: 2,
      policyViolations: 1,
    });
    guard.restore();
  });

  it('requests only the readable companion while authorizing the canonical publication', async () => {
    const { target, fetchSpy } = targetWithSpies();
    const githubContract = createV1AppHealthSourceContract();
    const guard = installAppHealthTransportGuard({ target, mode: 'live-source', contract: githubContract });
    try {
      await expect(target.fetch(githubContract.manifestUrl)).resolves.toMatchObject({ ok: true });
      expect(fetchSpy).toHaveBeenCalledWith(automaticDataUrl(githubContract.manifestUrl), undefined);
      await expect(target.fetch(automaticDataUrl(githubContract.manifestUrl)!)).rejects.toThrow('blocked');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    } finally { guard.restore(); }
  });

  it.each([
    'https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json',
    'https://github.com/yanniedog/AR-local/releases/download/app-payload-public-2026-09-18/manifest.json',
    'https://release-assets.githubusercontent.com/github-production-release-asset/file?sp=r',
    'https://ar-app-data.jkokavec.workers.dev/v1/release/app-payload-latest/other.json',
    'https://raw.githubusercontent.com/yanniedog/AR-local/app-payload-public/latest/manifest.json',
  ])('rejects a service redirect to an unrelated delivery route: %s', async finalUrl => {
    const target = { fetch: jest.fn(async () => ({ ok: true, url: finalUrl })) as unknown as typeof fetch };
    const githubContract = createV1AppHealthSourceContract();
    const guard = installAppHealthTransportGuard({ target, mode: 'live-source', contract: githubContract });
    try {
      await expect(target.fetch(githubContract.manifestUrl)).rejects.toThrow('blocked');
      expect(guard.snapshot().policyViolations).toBe(1);
    } finally { guard.restore(); }
  });

  it('fails closed when the transport does not expose its final URL', async () => {
    const fetchSpy = jest.fn(async () => ({ ok: true, redirected: false, url: '' })) as unknown as typeof fetch;
    const target = { fetch: fetchSpy };
    const guard = installAppHealthTransportGuard({ target, mode: 'live-source', contract });

    await expect(target.fetch(contract.manifestUrl)).rejects.toThrow('blocked');
    expect(guard.snapshot()).toMatchObject({ transportCalls: 1, policyViolations: 1 });
    expect(guard.snapshot().violations).toEqual([{
      reason: 'untrusted-final-url', purpose: 'manifest',
      requestedHost: new URL(contract.manifestUrl).hostname, finalHost: null,
    }]);
    guard.restore();
  });

  it('blocks XHR before send even when its initial URL is allowlisted', () => {
    class FakeXhr {
      open(_method: string, _url: string | URL, ..._rest: unknown[]): void {}
      send(_body?: unknown): void {}
    }
    const open = jest.spyOn(FakeXhr.prototype, 'open');
    const send = jest.spyOn(FakeXhr.prototype, 'send');
    const fetchSpy = jest.fn(async () => ({ ok: true })) as unknown as typeof fetch;
    const target = {
      fetch: fetchSpy,
      XMLHttpRequest: { prototype: FakeXhr.prototype },
    };
    const guard = installAppHealthTransportGuard({ target, mode: 'live-source', contract });
    const xhr = new FakeXhr();

    xhr.open('GET', contract.manifestUrl);
    expect(() => xhr.send()).toThrow('blocked');
    expect(open).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
    expect(guard.snapshot()).toMatchObject({
      authorizedAttempts: 1,
      blockedAttempts: 1,
      transportCalls: 0,
      policyViolations: 0,
    });
    guard.restore();
  });

  it('allows the internal XHR used by an already-authorized React Native fetch', async () => {
    class FakeXhr {
      open(_method: string, _url: string | URL, ..._rest: unknown[]): void {}
      send(_body?: unknown): void {}
    }
    const open = jest.spyOn(FakeXhr.prototype, 'open');
    const send = jest.spyOn(FakeXhr.prototype, 'send');
    const fetchSpy = jest.fn(async (input: RequestInfo | URL) => {
      const xhr = new FakeXhr();
      xhr.open('GET', typeof input === 'string' ? input : input.toString());
      xhr.send();
      return {
        ok: true,
        redirected: false,
        url: typeof input === 'string' ? input : input.toString(),
      } as Response;
    }) as unknown as typeof fetch;
    const target = {
      fetch: fetchSpy,
      XMLHttpRequest: { prototype: FakeXhr.prototype },
    };
    const guard = installAppHealthTransportGuard({ target, mode: 'live-source', contract });

    await expect(target.fetch(contract.manifestUrl)).resolves.toMatchObject({ ok: true });
    expect(open).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(guard.snapshot()).toMatchObject({
      authorizedAttempts: 1,
      blockedAttempts: 0,
      transportCalls: 1,
      policyViolations: 0,
    });
    guard.restore();
  });
});
