/** Presentation only. Consume the output of existing scopedRateConditions. */
export interface ScopedConditionInput {
  status: 'available' | 'unavailable';
  reason?: string;
  sourceSha256: string | null;
  coreSha256: string | null;
  detailsSha256: string | null;
  generationId: string | null;
  entries: readonly {
    id: string; rateFamily: 'lending' | 'deposit'; rateIndex: number;
    rateSourcePointer: string; tierSourcePointer?: string; sourcePointer: string; text: string;
  }[];
}
export interface ConditionSourceReference {
  readonly conditionId: string;
  readonly sourceSha256: string;
  readonly coreSha256: string;
  readonly detailsSha256: string;
  readonly generationId: string | null;
  readonly rateFamily: 'lending' | 'deposit';
  readonly rateIndex: number;
  readonly rateSourcePointer: string;
  readonly tierSourcePointer: string | null;
  readonly sourcePointer: string;
}
export type NumericConditionBoundary =
  | { readonly state: 'known'; readonly value: number; readonly inclusive: boolean }
  | { readonly state: 'unspecified' };
export type PublishedNumericConditionFact =
  | { readonly kind: 'published-lvr-range'; readonly unit: 'percent'; readonly lower: NumericConditionBoundary; readonly upper: NumericConditionBoundary; readonly source: ConditionSourceReference }
  | { readonly kind: 'published-balance-range'; readonly unit: 'AUD'; readonly subject: 'balance' | 'deposit-balance' | 'loan-amount' | 'borrowing-amount'; readonly lower: NumericConditionBoundary; readonly upper: NumericConditionBoundary; readonly source: ConditionSourceReference }
  | { readonly kind: 'published-term-range'; readonly unit: 'months'; readonly subject: 'term' | 'deposit-term' | 'fixed-term' | 'loan-term'; readonly lower: NumericConditionBoundary; readonly upper: NumericConditionBoundary; readonly source: ConditionSourceReference };
export interface ScopedFinancialConditionPresentation {
  readonly state: 'admitted' | 'unverified';
  readonly eligibility: 'unassessed';
  readonly facts: readonly PublishedNumericConditionFact[];
  readonly unresolved: readonly { readonly kind: 'published-condition-unparsed'; readonly state: 'source-review-required'; readonly source: ConditionSourceReference }[];
}

const NUM = '(?:0|[1-9]\\d*)(?:\\.\\d+)?';
const CASH = '(?:[1-9]\\d{0,2}(?:,\\d{3})+|0|[1-9]\\d*)(?:\\.\\d{1,2})?';
const unspecified: NumericConditionBoundary = Object.freeze({ state: 'unspecified' });
function boundary(value: number, inclusive = true): NumericConditionBoundary { return { state: 'known', value, inclusive }; }
function validRange(lower: NumericConditionBoundary, upper: NumericConditionBoundary, maximum: number): boolean {
  const values = [lower, upper].filter((value): value is Extract<NumericConditionBoundary, { state: 'known' }> => value.state === 'known');
  return values.length > 0 && values.every(value => Number.isFinite(value.value) && value.value >= 0 && value.value <= maximum)
    && !(upper.state === 'known' && upper.value === 0 && !upper.inclusive)
    && !(lower.state === 'known' && lower.value === maximum && !lower.inclusive)
    && !(lower.state === 'known' && upper.state === 'known' && (lower.value > upper.value
      || (lower.value === upper.value && (!lower.inclusive || !upper.inclusive))));
}
function bounds(text: string, numberPattern: string, suffix: string, parse: (value: string) => number): [NumericConditionBoundary, NumericConditionBoundary] | null {
  const amount = `(${numberPattern})${suffix}`;
  const patterns: readonly [string, (match: RegExpMatchArray) => [NumericConditionBoundary, NumericConditionBoundary]][] = [
    [`^(?:from\\s+|between\\s+)?${amount}\\s+(?:to|and|[-–])\\s+${amount}$`, match => [boundary(parse(match[1])), boundary(parse(match[2]))]],
    [`^(?:up to|at most|maximum(?: of)?)\\s+${amount}$`, match => [unspecified, boundary(parse(match[1]))]],
    [`^(?:at least|minimum(?: of)?)\\s+${amount}$`, match => [boundary(parse(match[1])), unspecified]],
    [`^(?:less than|below)\\s+${amount}$`, match => [unspecified, boundary(parse(match[1]), false)]],
    [`^(?:greater than|above|over)\\s+${amount}$`, match => [boundary(parse(match[1]), false), unspecified]],
    [`^${amount}\\s+(?:or less|or below)$`, match => [unspecified, boundary(parse(match[1]))]],
    [`^${amount}\\s+(?:or more|or above)$`, match => [boundary(parse(match[1])), unspecified]],
    [`^(<=|<|>=|>|≤|≥)\\s*${amount}$`, match => {
      const value = parse(match[2]), inclusive = ['<=', '>=', '≤', '≥'].includes(match[1]);
      return ['<=', '<', '≤'].includes(match[1]) ? [unspecified, boundary(value, inclusive)] : [boundary(value, inclusive), unspecified];
    }],
  ];
  for (const [pattern, value] of patterns) {
    const match = text.match(new RegExp(pattern, 'i'));
    if (match) return value(match);
  }
  return null;
}
function parseAtomic(text: string, source: ConditionSourceReference): PublishedNumericConditionFact | null {
  if (text.length > 180 || /[\r\n]/.test(text)) return null;
  const clause = text.trim().replace(/\.$/, '').trim();
  const lvr = /^(?:For\s+)?LVR\s+(.+)$/i.exec(clause);
  if (lvr) {
    const range = bounds(lvr[1], NUM, '%', Number);
    return range && validRange(...range, 100) ? { kind: 'published-lvr-range', unit: 'percent', lower: range[0], upper: range[1], source } : null;
  }
  const balance = /^(Balance|Deposit balance|Loan amount|Borrowing amount)\s+(.+)$/i.exec(clause);
  if (balance) {
    // Currency is explicit; unlabelled bare numerals do not become dollars.
    const remainder = balance[2].replace(/\$(?=\d)/g, '');
    const currencyCount = (balance[2].match(/\$(?=\d)/g) ?? []).length;
    const numericCount = (remainder.match(new RegExp(CASH, 'g')) ?? []).length;
    if (!currencyCount || currencyCount !== numericCount) return null;
    const range = bounds(remainder, CASH, '', value => Number(value.replace(/,/g, '')));
    const subjects = { balance: 'balance', 'deposit balance': 'deposit-balance', 'loan amount': 'loan-amount', 'borrowing amount': 'borrowing-amount' } as const;
    return range && validRange(...range, 1_000_000_000_000) ? { kind: 'published-balance-range', unit: 'AUD', subject: subjects[balance[1].toLowerCase() as keyof typeof subjects], lower: range[0], upper: range[1], source } : null;
  }
  const term = /^(Term|Deposit term|Fixed term|Loan term)\s+(.+)$/i.exec(clause);
  if (!term) return null;
  // One explicit shared unit only. Mixed-unit or multi-clause text stays unresolved.
  const unit = new RegExp(`^(.+?)\\s+(months?|years?)$`, 'i').exec(term[2]);
  if (!unit) return null;
  const multiplier = unit[2].toLowerCase().startsWith('year') ? 12 : 1;
  const range = bounds(unit[1], NUM, '', value => Number(value) * multiplier)
    ?? (new RegExp(`^${NUM}$`).test(unit[1])
      ? [boundary(Number(unit[1]) * multiplier), boundary(Number(unit[1]) * multiplier)] as [NumericConditionBoundary, NumericConditionBoundary] : null);
  const subjects = { term: 'term', 'deposit term': 'deposit-term', 'fixed term': 'fixed-term', 'loan term': 'loan-term' } as const;
  return range && validRange(...range, 1200) && [range[0], range[1]].every(value => value.state === 'unspecified' || (Number.isSafeInteger(value.value) && value.value > 0))
    ? { kind: 'published-term-range', unit: 'months', subject: subjects[term[1].toLowerCase() as keyof typeof subjects], lower: range[0], upper: range[1], source } : null;
}

/** This adapter does not replace publication/index/pointer/hash admission. */
export function scopedFinancialConditionFacts(model: ScopedConditionInput): ScopedFinancialConditionPresentation {
  const unverified: ScopedFinancialConditionPresentation = { state: 'unverified', eligibility: 'unassessed', facts: [], unresolved: [] };
  const hex = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
  if (model.status !== 'available' || !hex(model.sourceSha256) || !hex(model.coreSha256) || !hex(model.detailsSha256) || !model.entries.length) return unverified;
  const exact = model.entries[0];
  const pointer = (value: string): boolean => value.length <= 512 && /^\/[A-Za-z0-9/]+$/.test(value);
  if (!Number.isSafeInteger(exact.rateIndex) || exact.rateIndex < 1 || !['lending', 'deposit'].includes(exact.rateFamily)
    || model.entries.some(entry => entry.rateIndex !== exact.rateIndex || entry.rateFamily !== exact.rateFamily || !hex(entry.id)
      || !pointer(entry.rateSourcePointer) || !pointer(entry.sourcePointer) || (entry.tierSourcePointer !== undefined && !pointer(entry.tierSourcePointer)))) return unverified;
  const generationId = typeof model.generationId === 'string' && /^[A-Za-z0-9_.:-]{1,180}$/.test(model.generationId) ? model.generationId : null;
  const facts: PublishedNumericConditionFact[] = [], unresolved: { kind: 'published-condition-unparsed'; state: 'source-review-required'; source: ConditionSourceReference }[] = [];
  for (const entry of model.entries) {
    const source: ConditionSourceReference = { conditionId: entry.id, sourceSha256: model.sourceSha256,
      coreSha256: model.coreSha256, detailsSha256: model.detailsSha256, generationId,
      rateFamily: entry.rateFamily, rateIndex: entry.rateIndex, rateSourcePointer: entry.rateSourcePointer,
      tierSourcePointer: entry.tierSourcePointer ?? null, sourcePointer: entry.sourcePointer };
    const parsed = parseAtomic(entry.text, source);
    if (parsed) facts.push(parsed);
    else unresolved.push({ kind: 'published-condition-unparsed', state: 'source-review-required', source });
  }
  return { state: 'admitted', eligibility: 'unassessed', facts, unresolved };
}
