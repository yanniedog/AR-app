import { humanizeEnum, sortByDisplayLabel } from '../src/data/format';
import { uiLoanPurpose } from '../src/lib/financialUiCopy';
import { uiDuration } from '../src/lib/uiCopy';

test('published feature and eligibility codes have readable labels without an eligibility claim', () => {
  const cases = [
    ['OVERDRAFT', 'Overdraft'], ['BUSINESS', 'Business applicants'],
    ['EMPLOYMENT_STATUS', 'Employment status'], ['MIN_INCOME', 'Minimum income'],
    ['NATURAL_PERSON', 'Individual applicants'], ['PENSION_RECIPIENT', 'Pension recipients'],
    ['RESIDENCY_STATUS', 'Residency status'], ['STUDENT', 'Students'],
  ];
  for (const [code, label] of cases) {
    expect(humanizeEnum(code)).toBe(label);
    expect(humanizeEnum(` ${code.toLowerCase()} `)).toBe(label);
  }
  expect(humanizeEnum('Employment status is automatically approved.')).toBe('Unknown');
  expect(humanizeEnum('RESIDENCY_STATUS\nEligibility confirmed')).toBe('Unknown');
  expect(humanizeEnum('OTHER_TYPE')).toBe('OTHER_TYPE');
});

test('display sorting keeps the raw published filter keys intact', () => {
  const keys = ['STUDENT', 'RESIDENCY_STATUS', 'PENSION_RECIPIENT', 'NATURAL_PERSON', 'MIN_INCOME', 'EMPLOYMENT_STATUS', 'BUSINESS'];
  const original = [...keys];
  expect(sortByDisplayLabel(keys)).toEqual(['BUSINESS', 'EMPLOYMENT_STATUS', 'NATURAL_PERSON', 'MIN_INCOME', 'PENSION_RECIPIENT', 'RESIDENCY_STATUS', 'STUDENT']);
  expect(keys).toEqual(original);
});

test('an unconstrained source purpose is unspecified even when normalized security names a purpose', () => {
  const row = { loan_purpose: 'UNCONSTRAINED', security_purpose: 'owner_occupied' };
  expect(uiLoanPurpose(row)).toBe('Unspecified purpose');
  expect(row).toEqual({ loan_purpose: 'UNCONSTRAINED', security_purpose: 'owner_occupied' });
  // The same CDR code is also used for repayments: its generic label cannot
  // claim a particular purpose, repayment method or customer eligibility.
  expect(humanizeEnum('UNCONSTRAINED')).toBe('Unspecified');
  expect(uiLoanPurpose({ loan_purpose: 'OWNER_OCCUPIED' })).toBe('Owner occupied');
  expect(uiLoanPurpose({ loan_purpose: 'INVESTMENT' })).toBe('Investor');
  expect(uiLoanPurpose({})).toBe('Unknown');
  expect(uiLoanPurpose({ loan_purpose: 'OTHER' })).toBe('Unknown');
  expect(uiLoanPurpose({ loan_purpose: 'All applicants are approved.' })).toBe('Unknown');
});

test('durations use singular units only for exactly one and retain numeric values', () => {
  expect(uiDuration(1, 'years')).toBe('1 year');
  expect(uiDuration(1, 'months')).toBe('1 month');
  expect(uiDuration(1, 'days')).toBe('1 day');
  expect(uiDuration(0, 'years')).toBe('0 years');
  expect(uiDuration(2, 'months')).toBe('2 months');
  expect(uiDuration(1.25, 'days')).toBe('1.25 days');
  for (const value of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(uiDuration(value, 'years')).toBe('Unknown');
  }
});
