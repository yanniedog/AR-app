import type { PortfolioInput, PortfolioReceipt } from './portfolioTypes';
import type { AccountAuthority } from './accountAuthority';
import type { AccountMovement } from './accountPort';
import type { LedgerEntry } from './types';
import { feeOccurrences } from './feeSchedule';
import { movementIdentity } from './portfolioAccounting';
import { decimalZero, Decimal } from './decimal';
import { dateIndex } from './dateIndex';
import { canonical, hashText } from './validation';

export class PortfolioFeeFunding {
  private byDate;
  constructor(private input: PortfolioInput, private result: PortfolioReceipt, private authorities: Map<string, AccountAuthority>) {
    const routes = input.feeFundingRoutes ?? [], seen = new Set<string>();
    if (!Array.isArray(routes) || routes.length > 10000) throw new Error('portfolio_fee_route_limit');
    for (const route of routes) {
      const source = input.accounts.find(a => a.id === route.sourceAccountId), funding = input.accounts.find(a => a.id === route.fundingAccountId), key = JSON.stringify([route.sourceAccountId, route.occurrenceId]);
      const occurrence = source?.contract.feeSchedule ? feeOccurrences(source.contract.feeSchedule).find(o => o.id === route.occurrenceId && o.dueDate === route.date) : undefined;
      if (!source || !funding || source === funding || route.status !== 'cleared' || funding.contract.direction !== 'asset' || funding.contract.tdLifecycle || seen.has(key) || !occurrence || occurrence.fee.debit.type !== 'external_account' || occurrence.fee.debit.accountId !== funding.id ||
          !input.dependencyGraph.some(e => e.from === source.id && e.to === funding.id && (e.date === undefined || e.date === route.date)) || !Number.isSafeInteger(route.order) || route.order < 0 || !Array.isArray(route.evidenceIds) || !route.evidenceIds.length || route.evidenceIds.some(id => !source.contract.evidence.some(e => e.id === id))) throw new Error('portfolio_fee_route_invalid');
      if (funding.scenario.events.some(e => e.date === route.date && e.order === route.order) || input.transfers.some(t => t.date === route.date && t.order === route.order && (t.from === funding.id || t.to === funding.id)) || routes.some(other => other !== route && other.fundingAccountId === route.fundingAccountId && other.date === route.date && other.order === route.order)) throw new Error('portfolio_event_order_collision');
      seen.add(key);
    }
    this.byDate = dateIndex(routes, r => r.date);
  }
  route(accountId: string, date: string, rows: LedgerEntry[], incoming: Map<string, AccountMovement[]>, internal: Set<string>) {
    for (const route of this.byDate.get(date) ?? []) {
      if (route.sourceAccountId !== accountId) continue;
      const row = rows.find(e => e.type === 'fee' && e.id === route.occurrenceId);
      if (!row || row.amount === null) {
        this.result.issues.push('portfolio_fee_funding_unknown'); this.result.accounts[route.fundingAccountId].issues.push('portfolio_fee_funding_unknown');
        this.authorities.get(route.fundingAccountId)!.balanceUncertain = true; continue;
      }
      const amount = Decimal.parse(row.amount), id = `portfolio:funding:${hashText(canonical([accountId, route.occurrenceId, date]))}`;
      incoming.get(route.fundingAccountId)!.push({ id, delta: decimalZero().sub(amount).fixed(), order: route.order, status: route.status, evidenceIds: route.evidenceIds });
      const key = movementIdentity(route.fundingAccountId, 'cashflow', id, date); internal.add(key);
      this.result.fundedFees.push({ sourceAccountId: accountId, fundingAccountId: route.fundingAccountId, occurrenceId: route.occurrenceId, date, amount: amount.fixed(), movementIdentity: key });
    }
  }
}
