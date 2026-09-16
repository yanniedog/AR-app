import { calendarDate, dayNumber } from './calendar';
import { Decimal, decimalZero } from './decimal';
import type { PortfolioInput } from './portfolioTypes';
import { money, nonNegative } from './validation';
const id = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,180}$/.test(value) && value !== '__proto__' && value !== 'constructor';
export function validatePortfolio(input: PortfolioInput): Map<string, string[]> {
  const f = input.frame;
  if (input.schemaVersion !== 1 || !f || !id(f.id) || f.currency !== 'AUD' || !['Australia/Sydney', 'Australia/Hobart'].includes(f.timezone) || f.settlement !== 'same_civil_day' ||
      f.valuation !== 'holding_with_accrued_interest' || f.externalFeeFunding !== 'outside_frame_cost_adjustment' || !['terminal_net_worth', 'net_interest_fee_cost'].includes(f.metric) || typeof f.allowConditional !== 'boolean') throw new Error('portfolio_frame_unsupported');
  if (dayNumber(f.endDateExclusive) <= dayNumber(f.startDate) || dayNumber(f.endDateExclusive) - dayNumber(f.startDate) > 18300) throw new Error('portfolio_horizon_invalid');
  if (!['reviewed_complete', 'unknown'].includes(f.scopeCoverage) || !Array.isArray(input.accounts) || !input.accounts.length || input.accounts.length > 32 || !Array.isArray(input.transfers) || input.transfers.length > 10000 || !Array.isArray(input.dependencyGraph) || input.dependencyGraph.length > 1024 || !Array.isArray(input.dependencyIds) || !input.dependencyIds.length || input.dependencyIds.some(x => !id(x))) throw new Error('portfolio_inventory_invalid');
  const accounts = new Map<string, typeof input.accounts[number]>(); let opening = decimalZero();
  for (const a of input.accounts) {
    if (!id(a.id) || accounts.has(a.id) || a.timezone !== f.timezone || a.scenario.startDate !== f.startDate || a.scenario.endDateExclusive !== f.endDateExclusive || a.contract.currency !== f.currency ||
        a.scenario.accountId !== a.id || (a.contract.direction === 'liability' && !a.contract.loanContract)) throw new Error('portfolio_account_frame_mismatch');
    accounts.set(a.id, a);
    const amount = Decimal.parse(a.scenario.openingBalance); opening = a.contract.direction === 'asset' ? opening.add(amount) : opening.sub(amount);
    const suppliedIds = [...a.scenario.events.map(e => e.id), ...(a.scenario.loan?.executions.map(e => e.id) ?? []), ...(a.contract.loanContract?.advances.map(e => e.id) ?? [])];
    if (suppliedIds.some(key => /^(portfolio:|accrue:|post:|fee:|td:)/.test(key))) throw new Error('portfolio_reserved_occurrence_identity');
  }
  if (opening.compare(Decimal.parse(f.openingNetWorth)) !== 0) throw new Error('portfolio_opening_wealth_mismatch');
  const edges = new Map(input.accounts.map(a => [a.id, new Set<string>()]));
  for (const e of input.dependencyGraph) {
    if (!accounts.has(e.from) || !accounts.has(e.to) || e.from === e.to || (e.date !== undefined && (dayNumber(e.date) < dayNumber(f.startDate) || dayNumber(e.date) >= dayNumber(f.endDateExclusive)))) throw new Error('portfolio_dependency_invalid');
    edges.get(e.from)!.add(e.to);
  }
  const transfers = new Set<string>(), generated = new Set<string>();
  for (const t of input.transfers) {
    const source = accounts.get(t.from), target = accounts.get(t.to);
    if (!id(t.id) || transfers.has(t.id) || !source || !target || t.from === t.to || !input.dependencyGraph.some(e => e.from === t.from && e.to === t.to && (e.date === undefined || e.date === t.date)) || dayNumber(t.date) < dayNumber(f.startDate) || dayNumber(t.date) >= dayNumber(f.endDateExclusive) || !['cleared', 'projected'].includes(t.status)) throw new Error('portfolio_transfer_scope_invalid');
    transfers.add(t.id);
    if (!Number.isSafeInteger(t.order) || t.order < 0) throw new Error('portfolio_transfer_order_invalid');
    for (const a of [source, target]) if (a.scenario.events.some(e => e.date === t.date && e.order === t.order) || a.scenario.loan?.executions.some(e => e.date === t.date && e.order === t.order)) throw new Error('portfolio_event_order_collision');
    if (input.transfers.some(other => other !== t && other.date === t.date && other.order === t.order && [other.from, other.to].some(key => key === t.from || key === t.to))) throw new Error('portfolio_event_order_collision');
    if (!Array.isArray(t.evidenceIds) || !t.evidenceIds.length || t.evidenceIds.some(key => !source.contract.evidence.some(e => e.id === key) && !target.contract.evidence.some(e => e.id === key))) throw new Error('portfolio_transfer_evidence_missing');
    if (t.amount.type === 'fixed') nonNegative(t.amount.value);
    else if (t.amount.type === 'generated_cashflow') {
      const key = JSON.stringify([t.from, 'cashflow', t.amount.occurrenceId, t.date]);
      if (!id(t.amount.occurrenceId) || generated.has(key)) throw new Error('portfolio_generated_transfer_duplicate'); generated.add(key);
    } else throw new Error('portfolio_transfer_amount_unsupported');
    if (!!source.contract.loanContract !== !!t.sourceLoan || !!target.contract.loanContract !== !!t.targetLoan || target.contract.tdLifecycle) throw new Error('portfolio_transfer_account_role_invalid');
    if (t.sourceLoan && (t.sourceLoan.type !== 'redraw' || source.scenario.loan?.mode !== t.status)) throw new Error('portfolio_loan_source_invalid');
    if (t.targetLoan && (!['payment', 'extra_payment'].includes(t.targetLoan.type) || target.scenario.loan?.mode !== t.status ||
        (t.targetLoan.type === 'payment' && !target.contract.loanContract!.obligations.some(o => o.id === t.targetLoan!.obligationId)) || (t.targetLoan.type === 'extra_payment' && t.targetLoan.obligationId !== undefined))) throw new Error('portfolio_loan_target_invalid');
  }
  if (!Array.isArray(f.externalFlows) || f.externalFlows.length > 10000) throw new Error('portfolio_external_flow_invalid');
  const external = new Set<string>();
  for (const e of f.externalFlows) { if (!id(e.id) || external.has(e.id) || dayNumber(e.date) < dayNumber(f.startDate) || dayNumber(e.date) >= dayNumber(f.endDateExclusive)) throw new Error('portfolio_external_flow_invalid'); external.add(e.id); money(e.delta); }
  const orders = new Map<string, string[]>(), cache = new Map<string, string[]>();
  for (let day = dayNumber(f.startDate); day < dayNumber(f.endDateExclusive); day++) {
    const date = calendarDate(day), active = input.dependencyGraph.filter(e => e.date === undefined || e.date === date), cacheKey = JSON.stringify(active.map(e => [e.from, e.to]));
    if (cache.has(cacheKey)) { orders.set(date, cache.get(cacheKey)!); continue; }
    const outgoing = new Map(input.accounts.map(a => [a.id, [] as string[]]));
    for (const e of active) outgoing.get(e.from)!.push(e.to);
    const order: string[] = [], visiting = new Set<string>(), visited = new Set<string>();
    function visit(key: string) { if (visiting.has(key)) throw new Error('portfolio_dependency_cycle'); if (visited.has(key)) return; visiting.add(key); for (const next of outgoing.get(key)!) visit(next); visiting.delete(key); visited.add(key); order.unshift(key); }
    for (const a of input.accounts) visit(a.id);
    cache.set(cacheKey, order); orders.set(date, order);
  }
  return orders;
}
