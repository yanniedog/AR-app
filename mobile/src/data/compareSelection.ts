import type { CorePayload, RateRow, SectionKey } from '../types';
import { findByKey } from './selectors';

export interface CompareSelection {
  row: RateRow;
  section: SectionKey;
}

export const MAX_COMPARE_PRODUCTS = 4;

export type CompareSelectionIssue =
  | 'category_mismatch'
  | 'limit_reached'
  | 'too_few'
  | 'unavailable';

export interface CompareSelectionValidation {
  entries: CompareSelection[];
  issue: CompareSelectionIssue | null;
}

export interface CompareSelectionUpdate {
  tokens: string[];
  rejection: Exclude<CompareSelectionIssue, 'too_few'> | null;
}

export function resolveCompareSelections(core: CorePayload, tokens: readonly string[]): CompareSelection[] {
  return [...new Set(tokens)].flatMap((token) => {
    const match = /^(\d+)#([\s\S]+)$/.exec(token);
    const rateIndex = match ? Number(match[1]) : null;
    const productKey = match ? match[2] : token;
    const found = findByKey(core.sections, productKey);
    if (!found) return [];
    if (rateIndex == null) return [{ row: found.row, section: found.section }];
    const exact = found.siblings.find((row) => row.rate_index === rateIndex);
    return exact ? [{ row: exact, section: found.section }] : [];
  });
}

export function validateCompareSelections(
  core: CorePayload,
  tokens: readonly string[],
): CompareSelectionValidation {
  const distinctTokens = [...new Set(tokens)];
  const entries = resolveCompareSelections(core, distinctTokens);
  if (distinctTokens.length > MAX_COMPARE_PRODUCTS) return { entries, issue: 'limit_reached' };
  if (entries.length !== distinctTokens.length) return { entries, issue: 'unavailable' };
  if (entries.length < 2) return { entries, issue: 'too_few' };
  if (entries.some((entry) => entry.section !== entries[0].section)) {
    return { entries, issue: 'category_mismatch' };
  }
  return { entries, issue: null };
}

export function toggleCompareSelection(
  core: CorePayload,
  tokens: readonly string[],
  token: string,
): CompareSelectionUpdate {
  const distinctTokens = [...new Set(tokens)];
  if (distinctTokens.includes(token)) {
    return { tokens: distinctTokens.filter((value) => value !== token), rejection: null };
  }
  const candidate = resolveCompareSelections(core, [token])[0];
  if (!candidate) return { tokens: distinctTokens, rejection: 'unavailable' };
  const current = resolveCompareSelections(core, distinctTokens);
  if (current.length !== distinctTokens.length) {
    return { tokens: distinctTokens, rejection: 'unavailable' };
  }
  if (distinctTokens.length >= MAX_COMPARE_PRODUCTS) {
    return { tokens: distinctTokens, rejection: 'limit_reached' };
  }
  if (current.some((entry) => entry.section !== candidate.section)) {
    return { tokens: distinctTokens, rejection: 'category_mismatch' };
  }
  return { tokens: [...distinctTokens, token], rejection: null };
}
