/** Accessible names of the calculator inputs; also key which fields have been left. */
export const CALCULATOR_FIELDS = {
  propertyPrice: 'Property price in dollars',
  propertyValue: 'Current property value',
  loanBalance: 'Current loan balance',
  years: 'Years remaining on loan',
  depositBalance: 'Balance in dollars',
  currentRate: 'Current interest rate percent',
} as const;

export interface CalculatorIssue {
  message: string;
  /** Set when the issue is an empty required field; it waits until that field has been left. */
  emptyField?: string;
}

/** Messages to show now: invalid values at once, empty fields only after they have been left. */
export function visibleCalculatorIssues(
  issues: readonly CalculatorIssue[],
  leftFields: ReadonlySet<string>,
): string[] {
  return issues
    .filter((issue) => !issue.emptyField || leftFields.has(issue.emptyField))
    .map((issue) => issue.message);
}
