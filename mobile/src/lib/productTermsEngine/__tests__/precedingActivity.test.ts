import { example } from '../testSupport';
import type { LedgerContract } from '../types';
import fixture from './precedingActivity.fixture.json';
import { calculateLedger, calculateSavingsActivityLedger } from '../ledger';
import { canonical, hashText } from '../validation';
const mapped = (): { contract: any; scenario: any } => JSON.parse(JSON.stringify({ contract: fixture.contract, scenario: fixture.scenario }));
const run = (x:any) => calculateSavingsActivityLedger(x.contract,x.scenario);
const bonus = (r:any) => r.ledger.find((x:any)=>x.type==='interest_accrual').savingsContributions[1];
test('32-tier positive and base-only agree with independent root Fraction oracle',()=>{
 const x=mapped(),r=run(x); expect(r.issues).toEqual([]);expect(r.claimAvailable).toBe(true);
 expect(r.totals).toMatchObject({interestPosted:'1.03',closingBalance:'1001.28'});
 expect(x.contract.savingsSchedule.intervals[0].components[1].tiers).toHaveLength(32);
 expect(bonus(r).status).toBe('applied'); expect(bonus(r).activityResults.map((m:any)=>m.fact)).toEqual([{type:'decimal',value:'100.25',unit:'AUD'},{type:'decimal',value:'0',unit:'count'}]);
 expect(r.evaluatorVersion).toBe('product-terms-engine-v9');expect(r.inputSha256).toBe(hashText(canonical({evaluatorVersion:'product-terms-engine-v9',...x})));
 x.scenario.savingsAssessments[0].activity.events[0].amount='100.00'; const failed=run(x);expect(failed.issues).toEqual([]);expect(failed.claimAvailable).toBe(true);expect(bonus(failed).status).toBe('does_not_meet');expect(failed.totals).toMatchObject({interestPosted:'1.00',closingBalance:'1001.25'});
});
test.each(['coverage','innerCoverage','status','classification','kind'])('unknown %s keeps actual assessment trace and incomplete result',field=>{
 const x=mapped(),a=x.scenario.savingsAssessments[0]; if(field==='coverage')a.coverage='unknown';else if(field==='innerCoverage')a.activity.coverage[0].status='unknown';else a.activity.events[0][field]=field==='classification'?null:'unknown';
 const r=run(x);expect(r.claimAvailable).toBe(false);expect(bonus(r).status).toBe('needs_information');expect(bonus(r).activityResults.some((m:any)=>m.status==='unknown')).toBe(true);
});
test('legacy input receipt and hash remain byte-identical; entrypoints cannot relabel contracts',()=>{
 const x=mapped();x.contract.evaluatorVersion='product-terms-engine-v8';
 const old = calculateLedger(x.contract,x.scenario);expect(old.inputSha256).toBe(fixture.legacy.inputSha256);expect(hashText(canonical(old))).toBe(fixture.legacy.receiptSha256);expect(calculateLedger(x.contract,x.scenario).issues).toContain('fee_activity_reconciliation_unsupported');
 expect(run(x).issues).toContain('preceding_activity_version_unsupported');x.contract.evaluatorVersion='product-terms-engine-v9';expect(calculateLedger(x.contract,x.scenario).issues).toContain('contract_version_unsupported');
});
test.each([
 ['overlap',(x:any)=>x.scenario.savingsAssessments[0].toExclusive='2026-01-02','window_mismatch'],
 ['account',(x:any)=>x.scenario.savingsAssessments[0].accountId='another','window_mismatch'],
 ['coverage scope',(x:any)=>x.scenario.savingsAssessments[0].activity.coverage[0].accountId='another','coverage_scope'],
 ['deferred',(x:any)=>x.contract.feeSchedule.deferredObligations='unknown','no_fees_required'],
 ['inventory',(x:any)=>x.contract.feeSchedule.inventory[0].state='unknown','no_fees_required'],
 ['zero fee definition',(x:any)=>x.contract.feeSchedule.fees.push({price:{type:'fixed',value:'0'}}),'no_fees_required'],
 ['application event',(x:any)=>x.scenario.events.push({}),'effects_unsupported'],
 ['purchase',(x:any)=>x.scenario.savingsAssessments[0].activity.events[0].kind='purchase','event_kind_unsupported'],
 ['refund',(x:any)=>x.scenario.savingsAssessments[0].activity.events[0].kind='refund','event_kind_unsupported'],
 ['wrong date',(x:any)=>x.scenario.savingsAssessments[0].activity.events[0].date='2026-01-01','event_scope'],
 ['future version',(x:any)=>x.contract.evaluatorVersion='product-terms-engine-v10','version_unsupported'],
])('%s refusal is specific',(_,mutate,reason)=>{const x=mapped();(mutate as any)(x);expect(run(x).issues).toContain('preceding_activity_'+reason);});
test('spoofed qualifying aggregates cannot replace actual failing events',()=>{const x=mapped(),a=x.scenario.savingsAssessments[0];a.activity.events[0].amount='100.00';a.facts.activity_deposit_total={type:'decimal',value:'999999',unit:'AUD'};expect(bonus(run(x)).status).toBe('does_not_meet');});

test.each(fixture.legacyVersions)('literal $version retains b9 input and receipt hashes', expected => {
 const x=example();x.contract.evaluatorVersion=expected.version as LedgerContract['evaluatorVersion'];const r=calculateLedger(x.contract,x.scenario);
 expect(r.issues).not.toContain('contract_version_unsupported');expect(r.inputSha256).toBe(expected.inputSha256);expect(hashText(canonical(r))).toBe(expected.receiptSha256);
});

test('settled-only excludes pending events at the exact threshold',()=>{
 const x=mapped();x.scenario.savingsAssessments[0].activity.events[0].status='pending';const r=run(x);
 expect(r.claimAvailable).toBe(true);expect(bonus(r).status).toBe('does_not_meet');expect(bonus(r).activityResults[0].fact.value).toBe('0.00');
});
