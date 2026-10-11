import { auditExternalLink, type ExternalLinkAuditOptions } from '../src/lib/externalLinkAudit';
import type { TrustedExternalUrlRequest } from '../src/lib/trustedExternalUrl';

const request: TrustedExternalUrlRequest = { url: 'https://www.rba.gov.au/statistics/tables/?format=csv', label: 'RBA tables', purpose: 'official_economic_source' };
const response = (status = 200, url = request.url): Response => ({ status, url } as Response);
const options = (overrides: Partial<ExternalLinkAuditOptions> = {}): ExternalLinkAuditOptions => ({
  platform: 'android', reachability: true, canOpenUrl: jest.fn(async () => true), fetch: jest.fn(async () => response()), ...overrides,
});

describe('external link audit', () => {
  it('rejects unsafe destinations without handing them to native or network APIs', async () => {
    const dependencies = options();
    const result = await auditExternalLink({ ...request, url: 'https://www.rba.gov.au/?token=secret' }, dependencies);
    expect(result.validation.status).toBe('fail');
    expect(result.handler.attempted).toBe(false);
    expect(result.reachability.attempted).toBe(false);
    expect(result.host).toBeNull();
    expect(result.path).toBeNull();
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(dependencies.canOpenUrl).not.toHaveBeenCalled();
    expect(dependencies.fetch).not.toHaveBeenCalled();
  });

  it('checks the OS receiver and HEAD without opening a browser or recording query values', async () => {
    const dependencies = options();
    const result = await auditExternalLink(request, dependencies);
    expect(result).toMatchObject({ host: 'www.rba.gov.au', path: '/statistics/tables/', httpStatus: 200,
      validation: { status: 'pass' }, handler: { status: 'pass' }, reachability: { status: 'pass' } });
    expect(dependencies.fetch).toHaveBeenCalledWith(request.url, expect.objectContaining({ method: 'HEAD', redirect: 'manual', credentials: 'omit' }));
    expect(JSON.stringify(result)).not.toContain('format=csv');
  });

  it('keeps local destination validation separate from untested HTTP', async () => {
    const dependencies = options({ reachability: false });
    const result = await auditExternalLink(request, dependencies);
    expect(result.validation.status).toBe('pass');
    expect(result.handler.status).toBe('pass');
    expect(result.reachability).toMatchObject({ status: 'unknown', attempted: false });
    expect(dependencies.fetch).not.toHaveBeenCalled();
  });

  it('still validates every destination after the runtime check budget ends', async () => {
    const dependencies = options({ reachability: false, handler: false });
    const result = await auditExternalLink(request, dependencies);
    expect(result.validation.status).toBe('pass');
    expect(result.handler).toMatchObject({ status: 'unknown', attempted: false });
    expect(result.reachability).toMatchObject({ status: 'unknown', attempted: false });
    expect(dependencies.canOpenUrl).not.toHaveBeenCalled();
    expect(dependencies.fetch).not.toHaveBeenCalled();
  });

  it('does not accept RN-web\'s unconditional canOpenURL answer as browser proof', async () => {
    const dependencies = options({ platform: 'web' });
    const result = await auditExternalLink(request, dependencies);
    expect(result.handler).toMatchObject({ status: 'unknown', attempted: false });
    expect(dependencies.canOpenUrl).not.toHaveBeenCalled();
    expect(result.reachability.status).toBe('pass');
  });

  it('reports a missing browser handler independently of a responding website', async () => {
    const result = await auditExternalLink(request, options({ canOpenUrl: jest.fn(async () => false) }));
    expect(result.handler.status).toBe('fail');
    expect(result.reachability.status).toBe('pass');
  });

  it.each([401, 403, 405, 407, 429, 0, 301])('keeps blocked, unsupported and redirect HTTP %i unknown', async (status) => {
    const result = await auditExternalLink(request, options({ fetch: jest.fn(async () => response(status)) }));
    expect(result.reachability.status).toBe('unknown');
    expect(result.reachability.attempted).toBe(true);
  });

  it.each([404, 410, 500])('reports unavailable HTTP %i as a failure', async (status) => {
    expect((await auditExternalLink(request, options({ fetch: jest.fn(async () => response(status)) }))).reachability.status).toBe('fail');
  });

  it('revalidates a native-followed final destination and does not bless a missing response URL', async () => {
    const escaped = await auditExternalLink(request, options({ fetch: jest.fn(async () => response(200, 'https://attacker.test/redirect')) }));
    expect(escaped.reachability.status).toBe('fail');
    const missing = await auditExternalLink(request, options({ fetch: jest.fn(async () => response(200, '')) }));
    expect(missing.reachability.status).toBe('unknown');
  });

  it('bounds native and HTTP calls even when neither honors cancellation', async () => {
    jest.useFakeTimers();
    try {
      const task = auditExternalLink(request, options({ timeoutMs: 20,
        canOpenUrl: jest.fn(() => new Promise<boolean>(() => {})),
        fetch: jest.fn(() => new Promise<Response>(() => {})),
      }));
      await jest.advanceTimersByTimeAsync(20);
      const result = await task;
      expect(result.handler.status).toBe('unknown');
      expect(result.reachability.status).toBe('unknown');
      expect(jest.getTimerCount()).toBe(0);
    } finally { jest.useRealTimers(); }
  });

  it('cancels in-flight probes and removes their timers', async () => {
    const controller = new AbortController();
    const task = auditExternalLink(request, options({ signal: controller.signal,
      canOpenUrl: jest.fn(() => new Promise<boolean>(() => {})),
      fetch: jest.fn(() => new Promise<Response>(() => {})),
    }));
    await Promise.resolve();
    controller.abort();
    const result = await task;
    expect(result.handler.status).toBe('unknown');
    expect(result.reachability.status).toBe('unknown');
  });
});
