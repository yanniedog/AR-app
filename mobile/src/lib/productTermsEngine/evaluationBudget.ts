import { utf8ToBytes } from '@noble/hashes/utils';
import { dayNumber } from './calendar';
import type { PortfolioInput, PortfolioReceipt, ComparisonReceipt } from './portfolioTypes';
/** Bounded before work and incrementally during emission; never truncate an exact result. */
export class EvaluationBudget {
  private rows = 0;
  private bytes = 0;
  constructor(private comparison = false) {}
  check(inputs: PortfolioInput[]) {
    if (inputs.some(p => p.accounts.length * (dayNumber(p.frame.endDateExclusive) - dayNumber(p.frame.startDate)) > 50000)) throw new Error('evaluation_account_day_budget_exceeded');
    const work = inputs.reduce((sum, p) => sum + p.accounts.length * (dayNumber(p.frame.endDateExclusive) - dayNumber(p.frame.startDate)), 0);
    if (work > (this.comparison ? 100000 : 50000)) throw new Error('evaluation_account_day_budget_exceeded');
  }
  verifyPortfolio(receipt: PortfolioReceipt) {
    if (Object.values(receipt.accounts).reduce((n, r) => n + r.ledger.length, 0) > 100000) throw new Error('evaluation_output_budget_exceeded');
    this.verifyEnvelope(receipt, 12);
  }
  verifyComparison(receipt: ComparisonReceipt) { this.verifyEnvelope(receipt, 24); }
  private verifyEnvelope(value: unknown, mebibytes: number) {
    if (utf8ToBytes(JSON.stringify(value)).length > mebibytes * 1024 * 1024) throw new Error('evaluation_output_budget_exceeded');
  }
  emit(value: unknown, rows = 0) {
    this.rows += rows; this.bytes += utf8ToBytes(JSON.stringify(value)).length + 2;
    if (this.rows > (this.comparison ? 150000 : 100000) || this.bytes > (this.comparison ? 24 : 12) * 1024 * 1024) throw new Error('evaluation_output_budget_exceeded');
  }
}
/** Check each item before adding it; Array methods return ordinary arrays. */
export class BudgetArray<T> extends Array<T> {
  static get [Symbol.species]() { return Array; }
  constructor(private budget: EvaluationBudget, private row: boolean) { super(); }
  push(...items: T[]): number { for (const item of items) { this.budget.emit(item, this.row ? 1 : 0); super.push(item); } return this.length; }
}
