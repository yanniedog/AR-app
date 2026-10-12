import { CALCULATOR_FIELDS, visibleCalculatorIssues } from '../src/lib/calculatorIssues';

describe('calculator input messages', () => {
  const issues = [
    { message: 'Enter a property value.', emptyField: CALCULATOR_FIELDS.propertyPrice },
    { message: 'Enter the current interest rate.', emptyField: CALCULATOR_FIELDS.currentRate },
    { message: 'Years left must be greater than 0 and no more than 50.' },
  ];

  it('does not flag empty fields before the person has used them', () => {
    expect(visibleCalculatorIssues(issues, new Set())).toEqual([
      'Years left must be greater than 0 and no more than 50.',
    ]);
  });

  it('flags an empty field once it has been left', () => {
    expect(visibleCalculatorIssues(issues, new Set([CALCULATOR_FIELDS.currentRate]))).toEqual([
      'Enter the current interest rate.',
      'Years left must be greater than 0 and no more than 50.',
    ]);
  });
});
