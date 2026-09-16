import oracle from './fixtures/mortgage-independent-oracle-v2.json';
import companion from './fixtures/mortgage-leap-monthend-companion.json';
import { mortgageHarness } from '../test-support/mortgageHarness';
import { profile } from '../test-support/executableDepositHarness';
import { calculateMortgagePeriod, instantiateMortgagePeriod } from '../src/data/mortgageContracts/adapter';
import { mortgageDueDates, mortgageObligationId } from '../src/data/mortgageContracts/calendar';
import { calculateLedger } from '../src/lib/productTermsEngine/ledger';
import { Decimal } from '../src/lib/productTermsEngine/decimal';
import type { CalculationReceipt } from '../src/lib/productTermsEngine/types';
jest.mock('../src/data/payload', () => ({ downloadInflate: jest.fn() }));
const same = (actual: string | null | undefined, expected: string) => { expect(actual).not.toBeNull(); expect(Decimal.parse(actual!).compare(Decimal.parse(expected))).toBe(0); };
function check(r: CalculationReceipt, e: any) {
 expect(r.status).toBe(e.status); same(r.totals?.interestAccrued,e.interestAccrued);same(r.loan?.outstandingDebt,e.outstandingDebt);same(r.totals?.interestRoundingAdjustment,e.roundingAdjustment);same(r.totals?.externalInflows,e.payments);same(r.totals?.feesPaidExternal,e.feesPaidExternal);
 const components = r.loan!.closing; for (const [key,value] of Object.entries(e.closingComponents)) same(components[key as keyof typeof components],String(value));
 same(r.loan!.principalRepaid,e.paymentAllocation.principal);
 const daily=r.ledger.filter(row=>row.type==='interest_accrual');expect(daily).toHaveLength(e.rows.length);daily.forEach((row,n)=>{expect(row.date).toBe(e.rows[n].date);same(row.amount,e.rows[n].interestAccrued);});
 // Loan rows expose rounded total balance, not a daily component snapshot or exact interest basis.
 // Final component conservation is independently asserted; unexposed oracle fields are not claimed.
 const closing=Object.values(r.loan!.closing).reduce((sum,v)=>sum.add(Decimal.parse(v)),Decimal.parse('0'));same(closing.fixed(12),e.outstandingDebt);
}
for (const vector of oracle.vectors.filter(v=>v.kind==='arithmetic' && v.id!=='leap_day_act365_end_exclusive')) {
 test(`actual mortgage adapter oracle: ${vector.id}`,async()=>{const h=await mortgageHarness(vector.input),[selection]=await h.load();check(calculateMortgagePeriod(selection,h.context,h.target,h.inputs,profile).receipt,vector.expected);});
}
test('actual mortgage adapter leap month-end companion',async()=>{const h=await mortgageHarness(companion.input),[s]=await h.load();check(calculateMortgagePeriod(s,h.context,h.target,h.inputs,profile).receipt,companion.expected);});
test('original no-posting leap oracle remains direct-v8 control, outside adapter month-end policy',async()=>{const v=oracle.vectors.find(v=>v.id==='leap_day_act365_end_exclusive')!,h=await mortgageHarness(v.input),[s]=await h.load(),x=instantiateMortgagePeriod(s,h.context,h.target,h.inputs,profile);x.contract.interest.postingDates=[];check(calculateLedger(x.contract,x.scenario),v.expected);});
for(const v of oracle.vectors.filter(v=>v.kind==='calendar'))test(`source calendar helper: ${v.id}`,async()=>{const x=v.input as any,h=await mortgageHarness(x,s=>{s.policy.obligationCalendar.monthConvention=x.convention;});expect(mortgageDueDates(h.subject,x.anchor)).toEqual((v.expected as any).includedDueDates);});
const reasons:Record<string,RegExp>={late_payment:/timing unsupported/,excess_payment:/exceeds obligation/,split_excess_payment:/exceeds obligation/,opening_reconciliation_mismatch:/do not reconcile/,external_fee_settlement_date_mismatch:/settlement differs/};
for(const v of oracle.vectors.filter(v=>v.kind==='adapter_refusal'))test(`actual adapter refusal: ${v.id}`,async()=>{
 const x=v.input as any,base:any={obligation:x.due??'30'};if(v.id==='opening_reconciliation_mismatch')base.opening=x.components;if(v.id==='external_fee_settlement_date_mismatch')base.external_fee=x.amount;
 const h=await mortgageHarness(base),[s]=await h.load();
 if(v.id==='opening_reconciliation_mismatch')h.inputs.openingOutstanding=x.statedOutstanding;
 else if(v.id==='external_fee_settlement_date_mismatch')h.inputs.feeSettlements[0].date=x.settlementDate;
 else h.inputs.payments=(x.payments??[x.paid]).map((amount:string,order:number)=>({id:`pay${order}`,accountId:h.inputs.accountId,obligationId:mortgageObligationId(h.subject,h.inputs.accountId,h.inputs.from),date:x.paymentDate??h.inputs.from,phase:h.subject.policy.paymentPhase,order,amount,status:'cleared'}));
 expect(()=>calculateMortgagePeriod(s,h.context,h.target,h.inputs,profile)).toThrow(reasons[v.id]);
});
