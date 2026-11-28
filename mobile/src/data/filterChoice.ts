/** Major filter dimensions take one value at a time; features and criteria stay multi-select. */
const SINGLE_CHOICE_FILTER_KEYS: ReadonlySet<string> = new Set([
  'loanPurposes', 'rateTypes', 'repaymentTypes', 'depositKinds', 'interestPayments',
]);

export function isSingleChoiceFilter(key: string): boolean {
  return SINGLE_CHOICE_FILTER_KEYS.has(key);
}

/** The list after tapping `option`. A chosen value is removed; on a single-choice list any other value replaces it. */
export function chooseFilterValue(current: readonly string[], option: string, single: boolean): string[] {
  if (current.includes(option)) return current.filter(item => item !== option);
  return single ? [option] : [...current, option];
}
