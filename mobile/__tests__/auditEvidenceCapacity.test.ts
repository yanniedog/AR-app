import { AuditEvidenceBudget, AuditEvidenceCapacityError, auditActionResultEvidence, measureAuditEvidence } from '../src/lib/auditEvidenceCapacity';

test('preserves all evidence within capacity, including long text', () => {
  const check = { metrics: { full: 'e'.repeat(20_000), timing: 0 }, trace: 'trace'.repeat(5_000) };
  const original = JSON.stringify(check);
  new AuditEvidenceBudget().retain(check);
  expect(JSON.stringify(check)).toBe(original);
});

test('retains semantic result evidence beyond the former 512-character boundary', () => {
  const result = { evidence: 'x'.repeat(20_000), observed: 0 };
  expect(JSON.parse(auditActionResultEvidence(result)!)).toEqual(result);
  expect(auditActionResultEvidence(null)).toBeNull();
  const toJSON = jest.fn();
  expect(() => auditActionResultEvidence({ evidence: result.evidence, toJSON }, 1024)).toThrow(AuditEvidenceCapacityError);
  expect(toJSON).not.toHaveBeenCalled();
});

test('rejects oversized strings before serialization or invoking toJSON', () => {
  const toJSON = jest.fn();
  expect(() => measureAuditEvidence({ trace: 'x'.repeat(10_000), toJSON }, 1_024)).toThrow(AuditEvidenceCapacityError);
  expect(toJSON).not.toHaveBeenCalled();
});

test('bounds cumulative retained checks and leaves prior evidence intact', () => {
  const check = { metrics: { full: 'x'.repeat(100) } };
  const size = measureAuditEvidence(check);
  const budget = new AuditEvidenceBudget(size * 2);
  budget.retain(check); budget.retain(check);
  expect(() => budget.retain(check)).toThrow(AuditEvidenceCapacityError);
  expect(check.metrics.full).toHaveLength(100);
});

test('counts repeated values and rejects cycles and deeply nested evidence', () => {
  const shared = { text: 'x'.repeat(100) };
  expect(measureAuditEvidence([shared, shared])).toBeGreaterThan(measureAuditEvidence(shared) * 2);
  const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
  expect(() => measureAuditEvidence(cyclic)).toThrow(AuditEvidenceCapacityError);
  let deep: unknown = 'end'; for (let i = 0; i < 70; i++) deep = { nested: deep };
  expect(() => measureAuditEvidence(deep)).toThrow(AuditEvidenceCapacityError);
});
