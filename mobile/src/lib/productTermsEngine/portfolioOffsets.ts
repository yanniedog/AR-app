import type { AccountDay } from './accountPort';
import type { PortfolioInput, PortfolioReceipt } from './portfolioTypes';
import { canonical } from './validation';
import { Decimal } from './decimal';
import type { LoanContract } from './loanTypes';

type Offset = NonNullable<LoanContract['offset']>;
interface Series { values: Offset['snapshots']; cursor: number; latest?: Offset['snapshots'][number] }
/** Precompiled scope identities and advancing snapshot cursors; no daily history rescan. */
export class PortfolioOffsets {
  private records = new Map<string, { invalidScope: boolean; series: Map<string, Series> }>();
  constructor(private input: PortfolioInput, private result: PortfolioReceipt) {
    const signatures = new Map(input.accounts.map(a => [a.id, a.contract.loanContract?.offset ? canonical(a.contract.loanContract.offset) : null]));
    for (const a of input.accounts) {
      const offset = a.contract.loanContract?.offset; if (!offset) continue;
      let invalidScope = false; const series = new Map<string, Series>();
      for (const id of offset.accountIds) {
        const actualLoans = input.accounts.filter(other => other.contract.loanContract?.offset?.accountIds.includes(id)).map(other => other.id).sort();
        if (canonical(actualLoans) !== canonical([...offset.loanIds].sort()) || offset.loanIds.some(loan => signatures.get(loan) !== signatures.get(a.id))) invalidScope = true;
        series.set(id, { values: offset.snapshots.filter(s => s.accountId === id).sort((x, y) => x.date.localeCompare(y.date)), cursor: 0 });
      }
      this.records.set(a.id, { invalidScope, series });
    }
  }
  beforeAccount(current: Map<string, AccountDay>, accountId: string, date: string) {
    const record = this.records.get(accountId); if (!record) return;
    const unresolved = () => { const issues = this.result.accounts[accountId].issues; if (!issues.includes('loan_offset_portfolio_binding_unknown')) issues.push('loan_offset_portfolio_binding_unknown'); };
    if (record.invalidScope) unresolved();
    for (const [id, series] of record.series) {
      const source = this.input.accounts.find(a => a.id === id), day = current.get(id);
      if (!source || source.contract.direction !== 'asset' || day?.phase !== 'end' || day.date !== date) { unresolved(); continue; }
      const receipt = this.result.accounts[id], classified = new Set((receipt.issueDetails ?? []).filter(d => receipt.issues[d.index] === d.code).map(d => d.index));
      if (receipt.issues.some((_, index) => !classified.has(index))) { unresolved(); continue; }
      while (series.cursor < series.values.length && series.values[series.cursor].date <= date) series.latest = series.values[series.cursor++];
      if (!series.latest || Decimal.parse(series.latest.clearedBalance).compare(Decimal.parse(day.balance)) !== 0) unresolved();
    }
  }
}
