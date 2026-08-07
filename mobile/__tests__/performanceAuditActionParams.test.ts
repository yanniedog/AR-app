import {
  auditActionInteger,
  auditActionString,
  auditActionStrings,
} from '../src/lib/performanceAuditActionParams';

describe('performance audit action parameters', () => {
  test('reads the planner parameter object passed to a semantic action', () => {
    const args = [{ provider: 'Exact Bank', rateIndex: 17, selectionTokens: ['17#one', '4#two'] }];
    expect(auditActionString(args, 'provider')).toBe('Exact Bank');
    expect(auditActionInteger(args, 'rateIndex')).toBe(17);
    expect(auditActionStrings(args, 'selectionTokens')).toEqual(['17#one', '4#two']);
  });

  test('rejects malformed and fabricated values', () => {
    expect(auditActionString([{ provider: 7 }], 'provider')).toBeNull();
    expect(auditActionInteger([{ rateIndex: 4.2 }], 'rateIndex')).toBeNull();
    expect(auditActionStrings([{ selectionTokens: ['valid', 3, ''] }], 'selectionTokens'))
      .toEqual(['valid']);
    expect(auditActionString([], 'provider')).toBeNull();
  });
});
