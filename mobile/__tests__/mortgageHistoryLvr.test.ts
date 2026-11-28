import { mortgageHistoryLvr, mortgageHistoryLvrLabel, profileLvrPercent, userLvrPercent } from '../src/data/mortgageHistoryLvr';
import { matchesLvrTier } from '../src/data/lvrRange';

test('the benchmark LVR is the user LVR, moved inside the product band', () => {
  // User LVR known: used as is when the product band holds it.
  expect(mortgageHistoryLvr('lvr_<=98%', 75)).toBe('lvr_>=75-75%');
  expect(mortgageHistoryLvr('lvr_<=98%', 92.5)).toBe('lvr_>=92.5-92.5%');
  // No user LVR: 80%, not the product's 98% ceiling.
  expect(mortgageHistoryLvr('lvr_<=98%')).toBe('lvr_>=80-80%');
  // Bands that cannot hold the user LVR use their nearest point.
  expect(mortgageHistoryLvr('lvr_<=60%', 80)).toBe('lvr_>=60-60%');
  expect(mortgageHistoryLvr('lvr_80-90%', 70)).toBe('lvr_>=80.01-80.01%');
  expect(mortgageHistoryLvr('lvr_>=80%', 70)).toBe('lvr_>=80-80%');
  expect(mortgageHistoryLvr('lvr_<80%', 85)).toBe('lvr_>=79.99-79.99%');
  expect(mortgageHistoryLvr('lvr_unspecified', 80)).toBeNull();
  expect(mortgageHistoryLvr(undefined)).toBeNull();
  expect(String(mortgageHistoryLvrLabel(mortgageHistoryLvr('lvr_<=98%', 80)))).toBe('LVR 80.0%');
});

test('user LVR parsing and profile band', () => {
  expect(userLvrPercent('0.8')).toBe(80);
  expect(userLvrPercent('85')).toBe(85);
  expect(userLvrPercent('')).toBeNull();
  expect(userLvrPercent(undefined)).toBeNull();
  expect(profileLvrPercent(['lvr_80-90%', 'lvr_<=70%'])).toBe(90);
  expect(profileLvrPercent([])).toBeNull();
});

test('narrow published bands now benchmark a wide product band', () => {
  const key = mortgageHistoryLvr('lvr_<=90%', 90)!;
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
