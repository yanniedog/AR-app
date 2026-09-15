import { Decimal, decimalZero } from './decimal';
import { calculatePortfolio } from './portfolio';
import type { ComparisonInput, ComparisonReceipt, PortfolioFrame } from './portfolioTypes';
import { canonical, hashText } from './validation';
import { EVALUATOR_VERSION } from './types';
import { EvaluationBudget } from './evaluationBudget';

function frameIdentity(f: PortfolioFrame): string {
  return canonical({ currency: f.currency, startDate: f.startDate, endDateExclusive: f.endDateExclusive, timezone: f.timezone, settlement: f.settlement,
    valuation: f.valuation, openingNetWorth: Decimal.parse(f.openingNetWorth).fixed(12), externalFeeFunding: f.externalFeeFunding, allowConditional: f.allowConditional, metric: f.metric,
    externalFlows: [...f.externalFlows].sort((a, b) => a.id.localeCompare(b.id)).map(e => ({ ...e, delta: Decimal.parse(e.delta).fixed() })) });
}
export function crossing(dates: string[], advantages: string[]): NonNullable<ComparisonReceipt['results'][number]['breakEven']> {
  const signs = advantages.map(v => Decimal.parse(v).compare(decimalZero())), first = signs.findIndex(s => s > 0);
  let boundary = signs.length - 1;
  while (boundary >= 0 && signs[boundary] >= 0) boundary--;
  const sustained = signs.findIndex((s, index) => index > boundary && s > 0);
  return { firstPositive: first < 0 ? null : dates[first], sustainedFrom: sustained < 0 ? null : dates[sustained], through: sustained < 0 ? null : dates[dates.length - 1],
    transient: first >= 0 && (sustained < 0 || first < sustained), tiedDates: dates.filter((_, i) => signs[i] === 0) };
}
export function comparePortfolios(input: ComparisonInput): ComparisonReceipt {
  const result: ComparisonReceipt = { inputSha256: '', referenceId: input?.referenceId ?? '', available: false, conditional: false, metric: null, issues: [], results: [] };
  try {
    if (input.schemaVersion !== 1 || !Array.isArray(input.alternatives) || input.alternatives.length < 2 || input.alternatives.length > 16 || input.alternatives.some(a => typeof a.id !== 'string' || !/^[A-Za-z0-9_.:-]{1,180}$/.test(a.id)) || new Set(input.alternatives.map(a => a.id)).size !== input.alternatives.length) throw new Error('comparison_alternatives_invalid');
    const budget = new EvaluationBudget(true); budget.check(input.alternatives.map(a => a.input));
    budget.emit({ envelopeReserve: 'x'.repeat(65536) });
    let inputCharacters = 0;
    for (const a of input.alternatives) { const size = canonical(a.input).length; inputCharacters += size; if (size > 16_000_000 || inputCharacters > 24_000_000) throw new Error('comparison_input_limit'); }
    const reference = input.alternatives.find(a => a.id === input.referenceId); if (!reference) throw new Error('comparison_reference_missing');
    const frame = frameIdentity(reference.input.frame); result.metric = reference.input.frame.metric;
    if (input.alternatives.some(a => frameIdentity(a.input.frame) !== frame)) throw new Error('comparison_frame_mismatch');
    result.inputSha256 = hashText(canonical({ evaluatorVersion: EVALUATOR_VERSION, input }));
    result.results = input.alternatives.map(a => ({ id: a.id, receipt: calculatePortfolio(a.input, budget), advantage: null, rank: null, breakEven: null }));
    if (result.results.some(r => !['factual_complete', 'conditional_complete'].includes(r.receipt.completeness))) { result.issues.push('comparison_material_inputs_incomplete'); budget.verifyComparison(result); return result; }
    result.conditional = result.results.some(r => r.receipt.completeness === 'conditional_complete');
    if (result.conditional && !reference.input.frame.allowConditional) { result.issues.push('comparison_conditional_not_permitted'); budget.verifyComparison(result); return result; }
    const baseline = result.results.find(r => r.id === input.referenceId)!;
    const metric = result.metric === 'terminal_net_worth' ? 'netWorth' : 'netInterestFeeCost';
    for (const r of result.results) {
      if (r.receipt.days.length !== baseline.receipt.days.length || r.receipt.days.some((d, i) => d.date !== baseline.receipt.days[i].date || d[metric] === null)) throw new Error('comparison_daily_frame_incomplete');
      const advantages = r.receipt.days.map((d, i) => {
        const a = Decimal.parse(d[metric]!), b = Decimal.parse(baseline.receipt.days[i][metric]!);
        return (metric === 'netWorth' ? a.sub(b) : b.sub(a)).fixed(12);
      });
      r.advantage = advantages[advantages.length - 1]; r.breakEven = crossing(r.receipt.days.map(d => d.date), advantages);
    }
    for (const r of result.results) r.rank = 1 + result.results.filter(other => Decimal.parse(other.advantage!).compare(Decimal.parse(r.advantage!)) > 0).length;
    for (const r of result.results) budget.emit({ id: r.id, advantage: r.advantage, rank: r.rank, breakEven: r.breakEven });
    result.available = true; budget.verifyComparison(result); return result;
  } catch (error) { result.available = false; if (error instanceof Error && /budget_exceeded$/.test(error.message)) result.results = []; for (const r of result.results) { r.advantage = null; r.rank = null; r.breakEven = null; } result.issues.push(error instanceof Error ? error.message : 'comparison_input_invalid'); try { new EvaluationBudget(true).verifyComparison(result); } catch { result.results = []; result.issues = ['evaluation_output_budget_exceeded']; } return result; }
}
