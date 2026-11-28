import { mortgageHistoryLvr, mortgageHistoryLvrLabel, profileLvrPercent, userLvrPercent } from '../src/data/mortgageHistoryLvr';
import { matchesLvrTier } from '../src/data/lvrRange';

test('the benchmark is the user LVR exactly, and above', () => {
  expect(mortgageHistoryLvr(75)).toBe('lvr_atleast_75');
  expect(mortgageHistoryLvr(92.5)).toBe('lvr_atleast_92.5');
  expect(mortgageHistoryLvr(null)).toBe('lvr_atleast_80');
  expect(mortgageHistoryLvr()).toBe('lvr_atleast_80');
  expect(String(mortgageHistoryLvrLabel(mortgageHistoryLvr(80)))).toBe('LVR ≥80.0%');
});

test('user LVR parsing and profile band', () => {
  expect(userLvrPercent('0.8')).toBe(80);
  expect(userLvrPercent('0.855')).toBe(85.5);
  expect(userLvrPercent('1.05')).toBeNull();
  expect(userLvrPercent('85')).toBeNull();
  expect(userLvrPercent('')).toBeNull();
  expect(userLvrPercent(undefined)).toBeNull();
  expect(profileLvrPercent(['lvr_80-90%', 'lvr_<=70%'])).toBe(90);
  expect(profileLvrPercent(['>90'])).toBe(90.01);
  expect(profileLvrPercent(['lvr_>=95%'])).toBe(95);
  expect(mortgageHistoryLvr(profileLvrPercent(['>90']))).toBe('lvr_atleast_90.01');
  expect(profileLvrPercent(['<60'])).toBe(59.99);
  expect(profileLvrPercent([])).toBeNull();
});

test('market rows match when their band reaches the user LVR or goes above', () => {
  const key = mortgageHistoryLvr(80)!;
  expect(matchesLvrTier('lvr_<=80%', [key])).toBe(true);
  expect(matchesLvrTier('lvr_70-80%', [key])).toBe(true);
  expect(matchesLvrTier('lvr_<=90%', [key])).toBe(true);
  expect(matchesLvrTier('lvr_80-90%', [key])).toBe(true);
  expect(matchesLvrTier('lvr_90-95%', [key])).toBe(true);
  expect(matchesLvrTier('lvr_>=90%', [key])).toBe(true);
  // Bands that stop short of the user LVR do not.
  expect(matchesLvrTier('lvr_<80%', [key])).toBe(false);
  expect(matchesLvrTier('lvr_60-70%', [key])).toBe(false);
  expect(matchesLvrTier('lvr_<=60%', [key])).toBe(false);
  expect(matchesLvrTier('lvr_unspecified', [key])).toBe(false);
  // The existing open-ended profile option is unchanged.
  expect(matchesLvrTier('lvr_90-95%', ['>90'])).toBe(true);
  expect(matchesLvrTier('lvr_80-90%', ['>90'])).toBe(false);
});
