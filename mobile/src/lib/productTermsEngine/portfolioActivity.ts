import type { PortfolioInput, PortfolioReceipt } from './portfolioTypes';
import type { AccountAuthority } from './accountAuthority';
import type { AccountDay } from './accountPort';
import type { LedgerEntry } from './types';
import { canonical } from './validation';
import { Decimal, decimalZero } from './decimal';
import { dayNumber } from './calendar';
import type { SavingsAssessment } from './savingsTypes';
import type { SavingsActivityEvent } from './savingsActivityTypes';

type Binding = NonNullable<PortfolioInput['activityBindings']>[number];
type Pending = { binding: Binding; assessment: SavingsAssessment; rows: { accountId: string; row: LedgerEntry }[]; opening: Map<string, string>; closing: Map<string, string>; done: boolean };
const rowKey = (account: string, type: string, id: string, date: string) => JSON.stringify([account, type, id, date]);

/** Reconciles explicit source classifications with actual generated occurrences once per window. */
export class PortfolioActivity {
  private pending: Pending[] = [];
  private captured = 0;
  constructor(private input: PortfolioInput, private result: PortfolioReceipt, authorities: Map<string, AccountAuthority>) {
    const bindings = input.activityBindings ?? [];
    if (!Array.isArray(bindings) || bindings.length > 128) throw new Error('portfolio_activity_binding_limit');
    const identities = new Set<string>();
    for (const binding of bindings) {
      const account = input.accounts.find(a => a.id === binding.accountId), assessment = account?.scenario.savingsAssessments?.find(a => a.id === binding.assessmentId);
      const key = `${binding.accountId}:${binding.assessmentId}`;
      if (!account?.contract.savingsSchedule || !assessment?.activity || identities.has(key) || !Array.isArray(binding.sourceAccountIds) || !binding.sourceAccountIds.length || new Set(binding.sourceAccountIds).size !== binding.sourceAccountIds.length ||
          binding.sourceAccountIds.some(id => !input.accounts.some(a => a.id === id)) || dayNumber(assessment.from) < dayNumber(input.frame.startDate) || dayNumber(assessment.toExclusive) > dayNumber(input.frame.endDateExclusive) || assessment.appliesFrom < assessment.toExclusive) throw new Error('portfolio_activity_scope_invalid');
      if (!Array.isArray(binding.evidenceIds) || !binding.evidenceIds.length || binding.evidenceIds.some(id => !account.contract.evidence.some(e => e.id === id)) || !Array.isArray(binding.entries) || binding.entries.length > 10000) throw new Error('portfolio_activity_evidence_invalid');
      const metricAccounts = new Set(account.contract.savingsSchedule.intervals.flatMap(i => i.components.flatMap(c => c.qualification?.assessmentKey === assessment.assessmentKey && c.qualification.accountId === assessment.accountId ? c.qualification.activityMetrics?.flatMap(m => m.accountIds) ?? [] : [])));
      if (!metricAccounts.size || canonical([...metricAccounts].sort()) !== canonical([...binding.sourceAccountIds].sort())) throw new Error('portfolio_activity_role_scope_mismatch');
      const sourceRows = new Set<string>(), activityIds = new Set<string>();
      for (const entry of binding.entries) {
        const row = rowKey(entry.sourceAccountId, entry.sourceType, entry.sourceOccurrenceId, entry.date);
        if (!binding.sourceAccountIds.includes(entry.sourceAccountId) || !['cashflow', 'fee', 'interest_posting'].includes(entry.sourceType) || entry.date < assessment.from || entry.date >= assessment.toExclusive || sourceRows.has(row) || activityIds.has(entry.activityId) ||
            typeof entry.activityId !== 'string' || !entry.activityId || !['deposit', 'withdrawal', 'purchase', 'refund', 'interest', 'fee', 'tax', 'unknown'].includes(entry.kind) || !['processed', 'transaction'].includes(entry.dateBasis) || !['settled', 'pending'].includes(entry.status) || (entry.classification !== null && typeof entry.classification !== 'string')) throw new Error('portfolio_activity_entry_invalid');
        sourceRows.add(row); activityIds.add(entry.activityId);
      }
      identities.add(key);
      const authority = authorities.get(binding.accountId)!;
      authority.savingsAssessments = new Set([...(authority.savingsAssessments ?? []), assessment.id]);
      this.pending.push({ binding, assessment, rows: [], opening: new Map(), closing: new Map(), done: false });
    }
  }
  captureStart(current: Map<string, AccountDay>, date: string) {
    for (const p of this.pending) if (p.assessment.from === date) for (const id of p.binding.sourceAccountIds) p.opening.set(id, current.get(id)!.balance);
  }
  captureEnd(current: Map<string, AccountDay>, rows: Map<string, LedgerEntry[]>, date: string) {
    for (const p of this.pending) {
      if (p.done || date < p.assessment.from || date >= p.assessment.toExclusive) continue;
      for (const id of p.binding.sourceAccountIds) {
        for (const row of rows.get(id) ?? []) if (['fee', 'interest_posting', 'cashflow'].includes(row.type) && !(row.type === 'fee' && row.feeDebitAccountId && row.feeDebitAccountId !== id)) {
          if (++this.captured > 100000) throw new Error('portfolio_activity_capture_budget_exceeded'); p.rows.push({ accountId: id, row });
        }
        p.closing.set(id, current.get(id)!.balance);
      }
    }
  }
  beforeAccount(accountId: string, date: string) {
    for (const p of this.pending) if (!p.done && p.binding.accountId === accountId && date >= p.assessment.toExclusive) this.reconcile(p);
  }
  private reconcile(p: Pending) {
    p.done = true; let known = true;
    const data = p.assessment.activity!, expected = new Map(p.binding.entries.map(e => [rowKey(e.sourceAccountId, e.sourceType, e.sourceOccurrenceId, e.date), e]));
    const mapped: SavingsActivityEvent[] = [];
    const declaredIds = new Set(p.binding.entries.map(e => e.activityId));
    if (data.events.some(e => p.binding.sourceAccountIds.includes(e.accountId) && e.date >= p.assessment.from && e.date < p.assessment.toExclusive && !declaredIds.has(e.id))) known = false;
    for (const { accountId, row } of p.rows) {
      const key = rowKey(accountId, row.type, row.id, row.date), entry = expected.get(key); expected.delete(key);
      if (!entry || row.amount === null) { known = false; continue; }
      if (entry.status !== 'settled' || row.settlementStatus === 'projected') { known = false; continue; }
      // Activity v1 amounts are unsigned; negative interest needs an explicit signed contract.
      if (row.type === 'interest_posting' && Decimal.parse(row.amount).compare(decimalZero()) < 0) { known = false; continue; }
      const signed = Decimal.parse(row.amount), amount = signed.compare(decimalZero()) < 0 ? decimalZero().sub(signed) : signed;
      if ((row.type === 'fee' && entry.kind !== 'fee') || (row.type === 'interest_posting' && entry.kind !== 'interest') ||
          (row.type === 'cashflow' && (!['deposit', 'withdrawal', 'purchase', 'refund', 'tax'].includes(entry.kind) || (['deposit', 'refund'].includes(entry.kind) !== (signed.compare(decimalZero()) >= 0))))) { known = false; continue; }
      if (this.result.transfers.some(t => t.status === 'projected' && (t.debitIdentity === key || t.creditIdentity === key))) { known = false; continue; }
      const event: SavingsActivityEvent = { id: entry.activityId, accountId, date: row.date, dateBasis: entry.dateBasis, status: entry.status, kind: entry.kind, amount: amount.fixed(), classification: entry.classification, ...(entry.originalPurchaseId ? { originalPurchaseId: entry.originalPurchaseId } : {}) };
      const existing = data.events.find(e => e.id === event.id);
      if (existing && canonical(existing) !== canonical(event)) { known = false; continue; }
      mapped.push(event);
    }
    if (expected.size) known = false;
    for (const id of p.binding.sourceAccountIds) {
      const r = this.result.accounts[id], classified = new Set((r.issueDetails ?? []).map(d => d.index));
      if (r.issues.some((_, index) => !classified.has(index)) || !p.opening.has(id) || !p.closing.has(id)) known = false;
      for (const b of data.balances.filter(b => b.accountId === id && b.from === p.assessment.from && b.toExclusive === p.assessment.toExclusive)) {
        if (Decimal.parse(b.opening).compare(Decimal.parse(p.opening.get(id)!)) !== 0 || Decimal.parse(b.closing).compare(Decimal.parse(p.closing.get(id)!)) !== 0) known = false;
      }
    }
    const mappedIds = new Set(mapped.map(e => e.id)); data.events = [...data.events.filter(e => !mappedIds.has(e.id)), ...mapped];
    if (!known) {
      p.assessment.coverage = 'unknown'; for (const c of data.coverage) c.status = 'unknown';
      this.result.accounts[p.binding.accountId].issues.push('portfolio_activity_reconciliation_unknown');
    }
  }
}
