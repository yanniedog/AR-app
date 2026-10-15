/** Closed presentation facts; ranking classification is unchanged. */
export type RateSection = 'Mortgage' | 'Savings' | 'TD';
export type RateConditionality = 'base' | 'bonus' | 'intro' | 'none';
export interface ConditionalRateInput {
  ribbon_deposit_kind?: string;
  ribbon_rate_structure?: string;
  taxonomy_path?: string;
  ongoing_rate?: string | number | null;
  term?: string;
}

export type ConditionalRateFact =
  | { readonly kind: 'rate-kind'; readonly value: 'bonus' | 'intro' }
  | { readonly kind: 'bonus-conditions'; readonly state: 'required' }
  | { readonly kind: 'intro-period'; readonly state: 'known'; readonly months: number }
  | { readonly kind: 'intro-period'; readonly state: 'unknown' }
  | { readonly kind: 'ongoing-rate'; readonly state: 'known'; readonly fraction: number }
  | { readonly kind: 'ongoing-rate'; readonly state: 'unknown' };

export interface ConditionalRatePresentation {
  readonly kind: RateConditionality;
  readonly conditional: boolean;
  readonly facts: readonly ConditionalRateFact[];
}

/** Port using the existing rateConditionality classifier, without changing ranking. */
export function rateConditionality(row: ConditionalRateInput, section: RateSection): RateConditionality {
  if (section === 'Mortgage') return 'none';
  const raw = (section === 'Savings' ? row.ribbon_deposit_kind : row.ribbon_rate_structure)
    ?.toLowerCase().trim();
  if (raw === 'bonus') return 'bonus';
  if (raw === 'introductory' || raw === 'intro') return 'intro';
  if (raw === 'base') return 'base';
  const path = (row.taxonomy_path ?? '').toUpperCase();
  if (path.includes('.BONUS.')) return 'bonus';
  if (path.includes('.INTRO')) return 'intro';
  if (path.includes('.BASE.')) return 'base';
  return 'none';
}

/** Same fraction/percent convention as toFraction; explicit zero remains known. */
function ongoingFraction(raw: ConditionalRateInput['ongoing_rate']): number | null {
  if (raw == null || (typeof raw === 'string' && !raw.trim())) return null;
  const number = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(number) || number < 0) return null;
  return number > 1 ? number / 100 : number;
}

/** The current qualifier uses ISO term, not the independent term_months field. */
function introMonths(term: string | undefined): number | null {
  if (typeof term !== 'string') return null;
  const match = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/.exec(term.trim());
  if (!match || (!match[1] && !match[2])) return null;
  const months = Number(match[1] ?? 0) * 12 + Number(match[2] ?? 0);
  return Number.isSafeInteger(months) && months > 0 ? months : null;
}

/** No source prose, arbitrary labels, descriptions, notes, or inferred lower rate. */
export function rateConditionalFacts(
  row: ConditionalRateInput | null | undefined,
  section: RateSection,
): ConditionalRatePresentation {
  const kind = row ? rateConditionality(row, section) : 'none';
  if (!row || kind === 'none' || kind === 'base') return { kind, conditional: false, facts: [] };
  const fraction = ongoingFraction(row.ongoing_rate);
  const facts: ConditionalRateFact[] = [{ kind: 'rate-kind', value: kind }];
  if (kind === 'bonus') facts.push({ kind: 'bonus-conditions', state: 'required' });
  else {
    const months = introMonths(row.term);
    facts.push(months === null
      ? { kind: 'intro-period', state: 'unknown' }
      : { kind: 'intro-period', state: 'known', months });
  }
  facts.push(fraction === null
    ? { kind: 'ongoing-rate', state: 'unknown' }
    : { kind: 'ongoing-rate', state: 'known', fraction });
  return { kind, conditional: true, facts };
}
