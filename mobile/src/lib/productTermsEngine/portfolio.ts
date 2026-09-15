import { calendarDate, dayNumber } from './calendar';
import { Decimal, decimalZero } from './decimal';
import { prepareAccount, finalizeAccount } from './ledger';
import type { AccountDay, AccountMovement, AccountPort } from './accountPort';
import type { PortfolioInput, PortfolioReceipt, PortfolioTransfer } from './portfolioTypes';
import { validatePortfolio } from './portfolioValidation';
import { canonical, hashText, money } from './validation';
import { EVALUATOR_VERSION, type CalculationReceipt, type LedgerEntry } from './types';

import { movementIdentity as identity, PortfolioAccounting } from './portfolioAccounting';
import { dateIndex } from './dateIndex';
import { portfolioAuthorities } from './portfolioAuthority';
import { EvaluationBudget, BudgetArray } from './evaluationBudget';
import { PortfolioOffsets } from './portfolioOffsets';
import { PortfolioActivity } from './portfolioActivity';
import { PortfolioFeeFunding } from './portfolioFeeFunding';
function receipt(id: string): CalculationReceipt { return { schemaVersion: 1, evaluatorVersion: EVALUATOR_VERSION, inputSha256: '', contractId: id, dependencies: [], status: 'unsupported', completeness: 'unsupported', claimAvailable: false, issues: [], issueDetails: [], assumptions: [], eligibility: null, totals: null, ledger: [] }; }
function movement(t: PortfolioTransfer, amount: Decimal, debit: boolean): AccountMovement {
  return { id: `portfolio:${t.id}:${debit ? 'debit' : 'credit'}`, delta: (debit ? decimalZero().sub(amount) : amount).fixed(), order: t.order, status: t.status, evidenceIds: t.evidenceIds,
    ...(debit && t.sourceLoan ? { loan: t.sourceLoan } : !debit && t.targetLoan ? { loan: t.targetLoan } : {}) };
}
/** Finite chronological graph over the same account runners used by calculateLedger. */
export function calculatePortfolio(input: PortfolioInput, budget = new EvaluationBudget()): PortfolioReceipt {
  const result: PortfolioReceipt = { schemaVersion: 1, evaluatorVersion: EVALUATOR_VERSION, inputSha256: '', completeness: 'unsupported', issues: [], assumptions: [], fundedFees: [], accounts: Object.create(null), transfers: [], days: [], externalContributionNet: '0.00', closingNetWorth: null, netInterestFeeCost: null };
  try {
    const encoded = canonical({ evaluatorVersion: EVALUATOR_VERSION, input });
    if (encoded.length > 16_000_000) throw new Error('portfolio_input_limit'); result.inputSha256 = hashText(encoded);
    input = JSON.parse(JSON.stringify(input)) as PortfolioInput; // Isolate derived activity from caller-owned inputs.
    budget.check([input]);
    budget.emit({ envelopeReserve: 'x'.repeat(16384) });
    const orders = validatePortfolio(input), ports = new Map<string, AccountPort>(), current = new Map<string, AccountDay>();
    const authorities = portfolioAuthorities(input);
    const activity = new PortfolioActivity(input, result, authorities);
    const feeFunding = new PortfolioFeeFunding(input, result, authorities);
    const offsets = new PortfolioOffsets(input, result);
    const transfersByDate = dateIndex(input.transfers, t => t.date), accounting = new PortfolioAccounting(input, result);
    const seenIds = new Map(input.accounts.map(a => [a.id, new Set<string>()]));
    if (input.frame.scopeCoverage !== 'reviewed_complete') result.issues.push('portfolio_scope_unverified');
    if (input.transfers.some(t => t.status === 'projected')) {
      const a = input.projectedTransferAssumption, sha = hashText(canonical(input.transfers));
      if (a && typeof a.id === 'string' && /^[A-Za-z0-9_.:-]{1,180}$/.test(a.id) && a.acknowledged === true && a.transfersSha256 === sha && input.accounts.every(a => a.contract.evaluatorVersion === EVALUATOR_VERSION)) {
        result.assumptions.push({ id: a.id, kind: 'projected_transfer_schedule', inputSha256: sha });
        for (const authority of authorities.values()) authority.projectionAssumptionId = a.id;
      } else result.issues.push('portfolio_projected_transfer_assumption_unacknowledged');
      if (!input.frame.allowConditional) result.issues.push('portfolio_conditional_frame_not_permitted');
    }
    for (const a of input.accounts) {
      const r = receipt(a.contract.id); result.accounts[a.id] = r;
      r.ledger = new BudgetArray<LedgerEntry>(budget, true);
      const port = prepareAccount(a.contract, a.scenario, r, authorities.get(a.id));
      const issues = new BudgetArray<string>(budget, false); issues.push(...r.issues); r.issues = issues;
      const start = port.next();
      if (start.done) throw new Error('portfolio_account_state_unavailable');
      ports.set(a.id, port); current.set(a.id, start.value);
    }
    const internal = new Set<string>();
    for (let day = dayNumber(input.frame.startDate); day < dayNumber(input.frame.endDateExclusive); day++) {
      const date = calendarDate(day), order = orders.get(date)!, incoming = new Map(order.map(id => [id, [] as AccountMovement[]]));
      const dayTransfers = transfersByDate.get(date) ?? [], dayRows = new Map<string, LedgerEntry[]>(), transferredAtStart = result.transfers.length, fundedAtStart = result.fundedFees.length;
      activity.captureStart(current, date);
      const outgoingByAccount = dateIndex(dayTransfers, t => t.from);
      for (const accountId of order) {
        const start = current.get(accountId)!;
        if (start.phase !== 'start' || start.date !== date) throw new Error('portfolio_account_phase_mismatch');
        const outgoing = outgoingByAccount.get(accountId) ?? [];
        for (const t of outgoing) if (t.amount.type === 'fixed') incoming.get(accountId)!.push(movement(t, money(t.amount.value), true));
        const previousRows = result.accounts[accountId].ledger.length;
        activity.beforeAccount(accountId, date);
        offsets.beforeAccount(current, accountId, date);
        const stepped = ports.get(accountId)!.next(incoming.get(accountId)!);
        if (stepped.done || stepped.value.phase !== 'end' || stepped.value.date !== date) throw new Error('portfolio_account_step_unavailable');
        current.set(accountId, stepped.value);
        const r = result.accounts[accountId], ids = seenIds.get(accountId)!, newRows = r.ledger.slice(previousRows); dayRows.set(accountId, newRows);
        for (const row of newRows) { if (ids.has(row.id)) throw new Error('portfolio_account_occurrence_collision'); ids.add(row.id); }
        feeFunding.route(accountId, date, newRows, incoming, internal);
        for (const t of outgoing) {
          const debitId = t.amount.type === 'fixed' ? `portfolio:${t.id}:debit` : t.amount.occurrenceId;
          const rows = newRows.filter(e => e.id === debitId && e.date === date && e.type === 'cashflow');
          if (rows.length !== 1 || rows[0].amount === null || Decimal.parse(rows[0].amount).compare(decimalZero()) > 0) { result.issues.push(`portfolio_transfer_debit_unavailable:${t.id}`); continue; }
          const amount = decimalZero().sub(Decimal.parse(rows[0].amount));
          if (t.amount.type === 'fixed' && amount.compare(money(t.amount.value)) !== 0) throw new Error('portfolio_transfer_amount_mismatch');
          const credit = movement(t, amount, false); incoming.get(t.to)!.push(credit);
          const debitIdentity = identity(t.from, 'cashflow', debitId, date), creditIdentity = identity(t.to, 'cashflow', credit.id, date);
          internal.add(debitIdentity); internal.add(creditIdentity);
          result.transfers.push({ id: t.id, date, from: t.from, to: t.to, amount: amount.fixed(), debitIdentity, creditIdentity, status: t.status });
        }
      }
      for (const t of result.transfers.slice(transferredAtStart)) {
        const rows = dayRows.get(t.to)!.filter(e => identity(t.to, e.type, e.id, e.date) === t.creditIdentity);
        if (rows.length !== 1 || rows[0].amount !== t.amount) result.issues.push(`portfolio_transfer_credit_unavailable:${t.id}`);
      }
      for (const funding of result.fundedFees.slice(fundedAtStart)) {
        const row = dayRows.get(funding.fundingAccountId)?.find(e => identity(funding.fundingAccountId, e.type, e.id, e.date) === funding.movementIdentity);
        if (!row || row.amount === null || Decimal.parse(row.amount).compare(decimalZero().sub(Decimal.parse(funding.amount))) !== 0) result.issues.push('portfolio_fee_payment_leg_missing');
      }
      const daily = accounting.day(current, dayRows, internal, date); budget.emit(daily); result.days.push(daily);
      activity.captureEnd(current, dayRows, date);
      budget.emit(result.transfers.slice(transferredAtStart));
      budget.emit(result.fundedFees.slice(fundedAtStart));
      for (const key of order) {
        const next = ports.get(key)!.next([]);
        if (day + 1 === dayNumber(input.frame.endDateExclusive)) {
          if (!next.done) throw new Error('portfolio_account_end_mismatch');
          result.accounts[key] = finalizeAccount(next.value);
        } else { if (next.done) throw new Error('portfolio_account_ended_early'); current.set(key, next.value); }
      }
    }
    accounting.finish();
    for (const [accountId, r] of Object.entries(result.accounts)) {
      r.dependencies = [...new Set([...r.dependencies, ...input.dependencyIds, ...input.accounts.flatMap(a => a.contract.dependencyIds)])];
      const binding = { portfolioInputSha256: result.inputSha256, accountId,
        movementAuthoritySha256: hashText(canonical({ transfers: result.transfers.filter(t => t.from === accountId || t.to === accountId), fundedFees: result.fundedFees.filter(f => f.sourceAccountId === accountId || f.fundingAccountId === accountId), activityBindings: input.activityBindings ?? [], assumptions: result.assumptions, packages: input.packages ?? [], tdFeeRoutes: input.tdFeeRoutes ?? [] })) };
      r.inputSha256 = hashText(canonical({ accountInputSha256: r.inputSha256, portfolioBinding: binding })); r.portfolioBinding = binding;
    }
    const accountComplete = Object.values(result.accounts).every(r => r.completeness === 'factual_complete' || (input.frame.allowConditional && r.completeness === 'conditional_complete'));
    result.completeness = result.issues.length || !accountComplete ? 'incomplete' : result.assumptions.length || Object.values(result.accounts).some(r => r.completeness === 'conditional_complete') ? 'conditional_complete' : 'factual_complete';
    if (result.completeness === 'incomplete') for (const d of result.days) { d.netWorth = null; d.netInterestFeeCost = null; }
    const last = result.days[result.days.length - 1]; result.closingNetWorth = last.netWorth; result.netInterestFeeCost = last.netInterestFeeCost;
    for (const r of Object.values(result.accounts)) budget.emit({ ...r, ledger: [], issues: [] });
    budget.emit({ ...result, accounts: {}, transfers: [], fundedFees: [], days: [] });
    budget.verifyPortfolio(result);
    return result;
  } catch (error) { result.completeness = 'unsupported'; result.closingNetWorth = null; result.netInterestFeeCost = null;
    if (error instanceof Error && /budget_exceeded$/.test(error.message)) {
      result.accounts = Object.create(null); result.transfers = []; result.fundedFees = []; result.days = []; result.assumptions = [];
      result.issues = [error.message]; return result; // Compact rejection, never a truncated exact receipt.
    }
    for (const day of result.days) { day.netWorth = null; day.netInterestFeeCost = null; }
    for (const [accountId, r] of Object.entries(result.accounts)) {
      if (!r.portfolioBinding) {
        const binding = { portfolioInputSha256: result.inputSha256, accountId, movementAuthoritySha256: hashText(canonical(result.transfers.filter(t => t.from === accountId || t.to === accountId))) };
        r.inputSha256 = hashText(canonical({ accountInputSha256: r.inputSha256, portfolioBinding: binding })); r.portfolioBinding = binding;
      }
      r.completeness = 'unsupported'; r.status = 'unsupported'; r.claimAvailable = false; r.issues = [...r.issues, 'portfolio_execution_incomplete'];
    }
    result.issues.push(error instanceof Error ? error.message : 'portfolio_input_invalid');
    try { budget.verifyPortfolio(result); } catch {
      result.accounts = Object.create(null); result.transfers = []; result.fundedFees = []; result.days = []; result.assumptions = [];
      result.issues = ['evaluation_output_budget_exceeded'];
    }
    return result; }
}

