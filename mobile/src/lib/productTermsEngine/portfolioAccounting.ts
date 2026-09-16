import { Decimal, decimalZero } from './decimal';
import type { AccountDay } from './accountPort';
import type { PortfolioInput, PortfolioReceipt } from './portfolioTypes';
import type { LedgerEntry } from './types';
import { money } from './validation';
export const movementIdentity = (account: string, type: string, id: string, date: string) => JSON.stringify([account, type, id, date]);

/** Visits each generated row once, independent of horizon length. */
export class PortfolioAccounting {
  private state = new Map<string, { unposted: Decimal; outsideFees: Decimal }>();
  private external = decimalZero();
  private observed = new Map<string, { date: string; delta: string }>();
  private funded = new Set<string>();
  private fundedCursor = 0;
  constructor(private input: PortfolioInput, private result: PortfolioReceipt) {
    for (const a of input.accounts) this.state.set(a.id, { unposted: decimalZero(), outsideFees: decimalZero() });
  }
  day(current: Map<string, AccountDay>, rows: Map<string, LedgerEntry[]>, internal: Set<string>, date: string) {
    for (; this.fundedCursor < this.result.fundedFees.length; this.fundedCursor++) {
      const f = this.result.fundedFees[this.fundedCursor]; this.funded.add(JSON.stringify([f.sourceAccountId, f.occurrenceId]));
    }
    let wealth = decimalZero();
    for (const a of this.input.accounts) {
      const state = this.state.get(a.id)!, balance = Decimal.parse(current.get(a.id)!.balance);
      for (const e of rows.get(a.id) ?? []) {
        if (e.amount === null) continue;
        const amount = Decimal.parse(e.amount);
        if (e.type === 'interest_accrual') state.unposted = state.unposted.add(amount);
        if (e.type === 'interest_posting') state.unposted = decimalZero();
        if (e.type === 'cashflow' && !internal.has(movementIdentity(a.id, e.type, e.id, e.date))) {
          if (this.observed.has(e.id)) this.result.issues.push('portfolio_external_flow_identity_unknown');
          this.observed.set(e.id, { date: e.date, delta: e.amount }); this.external = this.external.add(amount);
        }
        if (e.type === 'fee' && amount.compare(decimalZero()) > 0 && e.feeDebitAccountId && e.feeDebitAccountId !== a.id) {
          if (this.state.has(e.feeDebitAccountId)) {
            if (!this.funded.has(JSON.stringify([a.id, e.id]))) this.result.issues.push('portfolio_external_fee_routing_missing');
          } else state.outsideFees = state.outsideFees.add(amount);
        }
      }
      wealth = a.contract.direction === 'asset' ? wealth.add(balance).add(state.unposted) : wealth.sub(balance);
      wealth = wealth.sub(state.outsideFees);
    }
    const cost = Decimal.parse(this.input.frame.openingNetWorth).add(this.external).sub(wealth);
    return { date, netWorth: wealth.fixed(12), knownNetWorth: wealth.fixed(12), netInterestFeeCost: cost.fixed(12), knownNetInterestFeeCost: cost.fixed(12) };
  }
  finish() {
    for (const e of this.input.frame.externalFlows) {
      const actual = this.observed.get(e.id);
      if (!actual || actual.date !== e.date || Decimal.parse(actual.delta).compare(money(e.delta)) !== 0) this.result.issues.push(`portfolio_external_flow_mismatch:${e.id}`);
      this.observed.delete(e.id);
    }
    if (this.observed.size) this.result.issues.push('portfolio_unframed_external_flow'); this.result.externalContributionNet = this.external.fixed();
  }
}
