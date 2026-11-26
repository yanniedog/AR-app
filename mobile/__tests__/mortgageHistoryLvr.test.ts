import { mortgageHistoryLvr, mortgageHistoryLvrLabel } from '../src/data/mortgageHistoryLvr';
import { matchesLvrTier } from '../src/data/lvrRange';

test('the benchmark LVR is one point inside the product band', () => {
  expect(mortgageHistoryLvr('lvr_<=90%')).toBe('lvr_>=90-90%');
  expect(mortgageHistoryLvr('lvr_=60%')).toBe('lvr_>=60-60%');
  expect(mortgageHistoryLvr('lvr_80-90%')).toBe('lvr_>=90-90%');
  expect(mortgageHistoryLvr('lvr_<80%')).toBe('lvr_>=79.99-79.99%');
  expect(mortgageHistoryLvr('lvr_>=80%')).toBe('lvr_>=80-80%');
  expect(mortgageHistoryLvr('lvr_>80%')).toBe('lvr_>=80.01-80.01%');
  expect(mortgageHistoryLvr('lvr_unspecified')).toBeNull();
  expect(mortgageHistoryLvr(undefined)).toBeNull();
  expect(String(mortgageHistoryLvrLabel(mortgageHistoryLvr('lvr_<=90%')))).toBe('LVR 90.0%');
});

test('narrow published bands now benchmark a wide product band', () => {
  const key = mortgageHistoryLvr('lvr_<=90%')!;
  // Narrow bands that include 90% are available at the product's limit.
  expect(matchesLvrTier('lvr_85-90%', [key])).toBe(true);
  expect(matchesLvrTier('lvr_<=90%', [key])).toBe(true);
  expect(matchesLvrTier('lvr_<=95%', [key])).toBe(true);
  // Bands that stop short of 90% or start above it are not.
  expect(matchesLvrTier('lvr_70-80%', [key])).toBe(false);
  expect(matchesLvrTier('lvr_90-95%', [key])).toBe(false);
  expect(matchesLvrTier('lvr_unspecified', [key])).toBe(false);
  // An unchanged narrow product keeps the rows it matched before.
  const sixty = mortgageHistoryLvr('lvr_=60%')!;
  expect(matchesLvrTier('lvr_=60%', [sixty])).toBe(true);
  expect(matchesLvrTier('lvr_60-70%', [sixty])).toBe(false);
});
