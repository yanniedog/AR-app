import type { CorePayload, RateRow, SectionKey } from '../types';
import { findByKey } from './selectors';

export interface CompareSelection {
  row: RateRow;
  section: SectionKey;
}

export function resolveCompareSelections(core: CorePayload, tokens: readonly string[]): CompareSelection[] {
  return tokens.flatMap((token) => {
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
