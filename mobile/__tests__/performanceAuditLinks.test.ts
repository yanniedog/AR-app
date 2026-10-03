import { externalLinkAuditCheck } from '../src/lib/performanceAuditLinks';
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

it('keeps each destination independently addressable and omits URL queries', () => {
  const check = externalLinkAuditCheck(result, 3, 12);
  expect(check.id).toBe('external-link-4');
  expect(check.metrics).toMatchObject({ host: 'www.rba.gov.au', destinationPath: '/statistics/' });
  expect(check.metrics).not.toHaveProperty('url');
});
