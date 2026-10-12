/** Chips shown per filter group before a "Show all" control. */
export const FILTER_OPTION_LIMIT = 24;

/**
 * Options to render for one filter group. Collapsed groups show the first
 * `limit` options plus any selected option beyond them, so a selection is
 * never hidden from the person who has to clear it.
 */
export function visibleFilterOptions(
  options: readonly string[],
  selected: readonly string[],
  expanded: boolean,
  limit = FILTER_OPTION_LIMIT,
): { visible: string[]; hidden: number } {
  if (expanded || options.length <= limit) return { visible: [...options], hidden: 0 };
  const chosen = new Set(selected);
  const visible = options.filter((option, index) => index < limit || chosen.has(option));
  return { visible, hidden: options.length - visible.length };
}

/** Case-insensitive lender search; selected lenders always stay listed. */
export function matchingLenders(
  providers: readonly string[],
  query: string,
  selected: readonly string[],
): string[] {
  const needle = query.trim().toLocaleLowerCase('en-AU');
  if (!needle) return [...providers];
  const chosen = new Set(selected);
  return providers.filter(
    (provider) => chosen.has(provider) || provider.toLocaleLowerCase('en-AU').includes(needle),
  );
}
