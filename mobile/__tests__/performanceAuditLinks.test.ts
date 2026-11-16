import { externalLinkAuditCheck, externalLinkAuditCheckId, runExternalLinkAuditCheck } from '../src/lib/performanceAuditLinks';
import type { ExternalLinkAuditResult } from '../src/lib/externalLinkAudit';

const part = (status: 'pass' | 'fail' | 'unknown') => ({ status, detail: 'Evidence', attempted: true });
const result: ExternalLinkAuditResult = {
  label: 'RBA source', purpose: 'official_economic_source', host: 'www.rba.gov.au', path: '/statistics/',
  validation: part('pass'), handler: part('pass'), reachability: part('pass'), httpStatus: 200,
};

it('passes only when address, browser handler and HTTP all have positive evidence', () => {
  expect(externalLinkAuditCheck(result, 0, 12).status).toBe('pass');
  expect(externalLinkAuditCheck({ ...result, reachability: part('unknown') }, 0, 12).status).toBe('warn');
  expect(externalLinkAuditCheck({ ...result, handler: part('fail') }, 0, 12)).toMatchObject({
    status: 'fail', metrics: { nonTimingFailure: true, browserHandler: 'fail' },
  });
});

it('keeps an unselected HTTP destination warn and records that it was outside the sample', () => {
  const unselected = externalLinkAuditCheck({
    ...result,
    reachability: { status: 'unknown', detail: 'Evidence', attempted: false, selection: 'not-selected' },
  }, 0, 12);
  expect(unselected.status).toBe('warn');
  expect(unselected.metrics).toMatchObject({ httpSelected: false, httpAttempted: false, httpReachability: 'unknown', handlerResolution: 'pass' });
});

it('records a handler the platform could not resolve separately from a missing handler', () => {
  const unresolved = externalLinkAuditCheck({
    ...result,
    handler: { status: 'unknown', detail: 'Evidence', attempted: true, selection: 'selected' },
  }, 0, 12);
  expect(unresolved.status).toBe('warn');
  expect(unresolved.metrics).toMatchObject({ handlerResolution: 'unresolved', handlerAttempted: true, browserHandler: 'unknown' });
  expect(externalLinkAuditCheck({ ...result, handler: { status: 'fail', detail: 'Evidence', attempted: true, selection: 'selected' } }, 0, 12).metrics)
    .toMatchObject({ handlerResolution: 'fail', nonTimingFailure: true });
});

it('keeps each destination independently addressable and omits URL queries', () => {
  const check = externalLinkAuditCheck(result, 3, 12);
  expect(check.id).toBe('external-link-4');
  expect(check.metrics).toMatchObject({ host: 'www.rba.gov.au', destinationPath: '/statistics/' });
  expect(check.metrics).not.toHaveProperty('url');
});

it('keeps an indexed policy result for every local destination without transport', async () => {
  const fetch = jest.fn();
  const canOpenUrl = jest.fn();
  const results = await Promise.all([
    'https://www.rba.gov.au/statistics/',
    'https://unapproved.example/statistics/',
  ].map((url, index) => runExternalLinkAuditCheck({
    url, label: 'Source', purpose: 'official_economic_source',
  }, index, { platform: 'android', reachability: false, handler: false, fetch, canOpenUrl })));

  expect(results.map(check => check.id)).toEqual([externalLinkAuditCheckId(0), externalLinkAuditCheckId(1)]);
  expect(results[0]).toMatchObject({ status: 'warn', metrics: {
    urlValidation: 'pass', httpAttempted: false, handlerAttempted: false,
  } });
  expect(results[1]).toMatchObject({ status: 'fail', metrics: {
    urlValidation: 'fail', host: null, destinationPath: null,
  } });
  expect(fetch).not.toHaveBeenCalled();
  expect(canOpenUrl).not.toHaveBeenCalled();
});

it('measures a selected local native HTTPS handler without requesting its website', async () => {
  const fetch = jest.fn();
  const canOpenUrl = jest.fn(async () => true);
  const request = { url: 'https://www.rba.gov.au/statistics/', label: 'Source',
    purpose: 'official_economic_source' as const };
  const result = await runExternalLinkAuditCheck(request, 0, {
    platform: 'android', reachability: false, handler: true, fetch, canOpenUrl,
  });
  expect(result.metrics).toMatchObject({
    browserHandler: 'pass', handlerAttempted: true, httpAttempted: false,
  });
  expect(canOpenUrl).toHaveBeenCalledWith(request.url);
  expect(fetch).not.toHaveBeenCalled();
});
