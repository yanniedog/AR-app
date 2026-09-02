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
});
