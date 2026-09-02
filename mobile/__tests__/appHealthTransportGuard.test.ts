import { installAppHealthTransportGuard } from '../src/lib/appHealthTransportGuard';
import { createV1AppHealthSourceContract } from '../src/lib/appHealth/sourceContract';

function targetWithSpies() {
  const fetchSpy = jest.fn(async () => ({ ok: true })) as unknown as typeof fetch;
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

describe('installAppHealthTransportGuard', () => {
  const contract = createV1AppHealthSourceContract({
    manifestUrl: 'https://example.test/manifest.json',
    datesIndexUrl: 'https://example.test/dates-index.json',
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

  it('accepts GitHub release delivery redirects but rejects an untrusted final host', async () => {
    const fetchSpy = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        redirected: true,
        url: 'https://release-assets.githubusercontent.com/github-production-release-asset/file?sp=r',
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
});
