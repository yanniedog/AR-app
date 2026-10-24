import {
  auditActionInteger,
  auditActionString,
  auditActionStrings,
  auditSearchEntryParams,
} from '../src/lib/performanceAuditActionParams';
import { resolveRatesIntent, ratesIntentKey } from '../src/lib/ratesIntent';

describe('performance audit action parameters', () => {
  test('each search pass resets persisted comparison and result scope before its toggle', () => {
    const first = auditSearchEntryParams('Mortgage', 'first-pass.route.rates.search.open');
    const repeat = auditSearchEntryParams('Mortgage', 'repeat.route.rates.search.open');
    expect(ratesIntentKey(first)).not.toBe(ratesIntentKey(repeat));
    for (const entry of [first, repeat]) {
      const intent = resolveRatesIntent(entry, 'Savings', []);
      // The preceding pass or another consumer task can leave comparison on,
      // unlisted results selected and a search/taxonomy restriction in place.
      const task = { selectMode: true, selected: ['previous-rate'], availability: 'unlisted',
        query: 'previous query', path: ['previous-category'], hierarchyScoped: true, ...intent.patch };
      expect(intent.section).toBe('Mortgage');
      expect(task).toMatchObject({ selectMode: false, selected: [], availability: 'listed',
        query: '', path: [], hierarchyScoped: false });
      expect(!task.selectMode).toBe(true);
    }
  });
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
