import { chooseFilterValue, isSingleChoiceFilter } from '../src/data/filterChoice';

test('major filter dimensions are single-choice; features, criteria and providers are not', () => {
  for (const key of ['loanPurposes', 'rateTypes', 'repaymentTypes', 'depositKinds', 'interestPayments']) expect(isSingleChoiceFilter(key)).toBe(true);
  for (const key of ['accountFeatures', 'eligibilityCriteria', 'providers']) expect(isSingleChoiceFilter(key)).toBe(false);
});

test('a single-choice pick replaces, tapping the chosen value clears it and saved extras can be removed', () => {
  expect(chooseFilterValue([], 'A', true)).toEqual(['A']);
  expect(chooseFilterValue(['A'], 'B', true)).toEqual(['B']);
  expect(chooseFilterValue(['A'], 'A', true)).toEqual([]);
  expect(chooseFilterValue(['A', 'B'], 'B', true)).toEqual(['A']);
  expect(chooseFilterValue(['A'], 'B', false)).toEqual(['A', 'B']);
});
