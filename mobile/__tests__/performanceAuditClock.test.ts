import { uiDurationClock } from '../src/lib/uiCopy';
import { publicAuditDiagnosticStage } from '../src/lib/performanceAuditDiagnostic';

it.each([[0, '00:00'], [1, '00:01'], [59_000, '00:59'], [59_001, '01:00'],
  [480_484, '08:01'], [3_661_000, '61:01'], [NaN, 'Unknown'], [Infinity, 'Unknown'], [-1, 'Unknown']])(
  'formats %s as %s', (ms, expected) => expect(uiDurationClock(ms as number)).toBe(expected),
);
it('reads a public failure stage without traversing the expensive diagnostic tree', () => {
  const readiness = jest.fn(() => { throw new Error('Unnecessary traversal'); });
  const diagnostic = { stage: 'complete', get readiness() { return readiness(); } };
  expect(publicAuditDiagnosticStage(diagnostic)).toBe('complete');
  expect(readiness).not.toHaveBeenCalled();
  expect(publicAuditDiagnosticStage({ stage: 'private arbitrary text' })).toBeNull();
  expect(publicAuditDiagnosticStage(Object.create({ stage: 'complete' }))).toBeNull();
});
