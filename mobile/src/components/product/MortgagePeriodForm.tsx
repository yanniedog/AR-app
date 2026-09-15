import React, { useState } from 'react';
import { View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useCustomerProfile } from '../../hooks/useCustomerProfile';
import { canonical, hashText } from '../../lib/productTermsEngine/validation';
import { Decimal } from '../../lib/productTermsEngine/decimal';
import { evaluateEligibility } from '../../lib/productTermsEngine/eligibility';
import { LOAN_COMPONENTS } from '../../lib/productTermsEngine/loanTypes';
import { calculateMortgagePeriod } from '../../data/mortgageContracts/adapter';
import { assertMortgageSelection, type MortgageSelection, type MortgageContext, type MortgageTarget } from '../../data/mortgageContracts/transport';
import { mortgageFacts, mortgageRequirements, mortgageAnswerId } from '../../data/mortgageContracts/facts';
import { mortgageDueDates, mortgageObligationId } from '../../data/mortgageContracts/calendar';
import type { MortgageInputs } from '../../data/mortgageContracts/types';
import { CustomerAnswerEditor } from '../CustomerProfilePanel';
import { LedgerField } from '../ledger/LedgerField';
import { AppText, Chip, Button, Disclosure } from '../ui';
import { ReviewedCriteria } from './DepositCriteria';
const labels = {principal:'Principal',postedInterest:'Posted interest',accruedInterest:'Unposted interest',capitalizedCharges:'Capitalised charges',otherDebt:'Other debt'};
const scopeLabel = (s:string) => s === 'all_source_declared' ? 'All reviewed customers' : s === 'none_source_declared' ? 'None' : s;
export function MortgagePeriodForm({selections,context,target}:{selections:MortgageSelection[];context:MortgageContext;target:MortgageTarget}) {
 const customer=useCustomerProfile(),[selectedId,setSelectedId]=useState<string|null>(null),[text,setText]=useState<Record<string,string>>({}),[confirmed,setConfirmed]=useState(''),[clear,setClear]=useState(false),[noEffects,setNoEffects]=useState(false),[complete,setComplete]=useState(false),[feeConfirmed,setFeeConfirmed]=useState<Record<string,boolean>>({}),[detailOpen,setDetailOpen]=useState(false),[savedOpen,setSavedOpen]=useState(false),[copy,setCopy]=useState('');
 const selection=selections.find(s=>s.subject.id===selectedId),s=selection?.subject;
 function change(key:string,value:string){setText(v=>({...v,[key]:value}));setConfirmed('');setCopy('');}
 let annualRate='';try{const d=Decimal.parse(text.rate??'').div(Decimal.parse('100'));if(d.compare(Decimal.parse(d.fixed(12)))===0)annualRate=d.fixed(12);}catch{/* Unconfirmed until exact decimal. */}
 let due:string[]=[];try{if(s)due=mortgageDueDates(s,text.anchor??'');}catch{/* Invalid anchor is shown by calculation admission. */}
 const positiveFees=s?.policy.fees.occurrences.filter(f=>Decimal.parse(f.amount).compare(Decimal.parse('0'))>0)??[],roles=[...new Set(positiveFees.map(f=>f.externalAccountRole))];
 const inputs:MortgageInputs={accountId:text.account??'',offerId:text.offer??'',sourceVersion:text.version??'',snapshotId:text.snapshot??'',from:s?.scope.from??'',toExclusive:s?.scope.toExclusive??'',confirmedAt:confirmed,provenance:'user_reported_bank_offer_and_statement',confirmedAnnualRate:annualRate,openingOutstanding:text.outstanding??'',openingComponents:Object.fromEntries(LOAN_COMPONENTS.map(k=>[k,text[k]??''])) as MortgageInputs['openingComponents'],noCarriedArrearsOrDefault:clear,noExcludedMovements:noEffects,obligationAmount:text.obligation??'',originalAnchor:text.anchor??'',executionCoverage:complete?'complete':'unknown',payments:due.filter(date=>!!text[`paid:${date}`]).map((date,n)=>({id:`payment_${n}`,accountId:text.account??'',obligationId:s?mortgageObligationId(s,text.account??'',date):'',date,phase:s!.policy.paymentPhase,order:n,amount:text[`paid:${date}`],status:'cleared'})),externalAccounts:roles.map(role=>({role,accountId:text[`external:${role}`]??''})),feeSettlements:positiveFees.filter(f=>feeConfirmed[f.id]).map(f=>({occurrenceId:f.id,externalAccountId:text[`external:${f.externalAccountRole}`]??'',date:f.dueDate,amount:f.amount,status:'cleared'})),confirmedOfferFacts:Object.fromEntries(['purpose','security','repaymentType'].filter(k=>!!text[k]).map(k=>[k,text[k]])),customerFacts:[]};
 const identity=hashText(canonical([selectedId,inputs,customer.profile?.revision??null])),[result,setResult]=useState<{identity:string;value?:ReturnType<typeof calculateMortgagePeriod>;error?:string}|null>(null),current=result?.identity===identity?result:null;
 if(!customer.profile)return <AppText variant="small">{customer.error??'Opening encrypted local inputs...'}</AppText>;
 const requirements=s?mortgageRequirements(s,inputs,customer.profile):null,criteria=s?evaluateEligibility(s.policy.eligibility,mortgageFacts(s,inputs,customer.profile).facts):null;
 const field=(key:string,label:string,decimal=false,hint?:string)=><LedgerField key={key} label={label} value={text[key]??''} hint={hint} keyboardType={decimal?'decimal-pad':'default'} onChangeText={value=>change(key,value)}/>;
 return <View style={{gap:12}}>
  <AppText variant="small">One historical loan account. Enter confirmed offer and statement records; inputs stay on this device. This is not credit approval or a full borrowing-cost comparison.</AppText>
  <AppText variant="small">Source publication: {context.manifest?.run_date}. The producer verifies original source records; this app verifies the reviewed policy and publication.</AppText>
  {selections.map(x=><View key={x.subject.id}><AppText variant="small">Recorded criteria: {evaluateEligibility(x.subject.policy.eligibility,mortgageFacts(x.subject,inputs,customer.profile!).facts).status.replace(/_/g,' ')}</AppText><Chip label={`Choose ${[x.subject.scope.cohortKey,x.subject.scope.tierKey,x.subject.scope.packageKey].map(scopeLabel).join(' / ')}`} selected={selectedId===x.subject.id} onPress={()=>{setSelectedId(x.subject.id);setConfirmed('');setText({});setFeeConfirmed({});setClear(false);setNoEffects(false);setComplete(false);}}/></View>)}
  {s&&<>
   <AppText variant="small">Reviewed period: {s.scope.from} to {s.scope.toExclusive} (end excluded). Data coverage, not a bank expiry date.</AppText>
   {field('account','Local loan account reference')}{field('offer','Local offer reference')}{field('version','Offer version reference')}{field('snapshot','Opening statement reference')}
   {field('rate','Confirmed annual rate (%)',true)}{field('outstanding','Opening total debt (AUD)',true)}
   {LOAN_COMPONENTS.map(k=>field(k,`${labels[k]} (AUD)`,true,k==='accruedInterest'?'Up to 12 decimal places; enter zero explicitly':'Enter zero explicitly if none'))}
   {field('obligation','Confirmed monthly amount due (AUD)',true)}{field('anchor','Original monthly due date',false,'YYYY-MM-DD; use the original anchor, not an adjusted later date')}
   <AppText variant="small">Payments must clear on the exact due date, {s.policy.paymentPhase==='before_accrual'?'before':'after'} daily interest. Late or excess payments are unavailable in this calculation.</AppText>
   {due.map(date=>field(`paid:${date}`,`Cleared payment on ${date} (AUD)`,true,'Leave blank only if no payment cleared; partial payments remain incomplete'))}
   {roles.map(role=>field(`external:${role}`,`External fee account reference: ${role}`))}
   {positiveFees.map(f=><Chip key={f.id} label={`Fee ${f.id}: $${f.amount} cleared externally on ${f.dueDate}`} selected={!!feeConfirmed[f.id]} onPress={()=>{setFeeConfirmed(v=>({...v,[f.id]:!v[f.id]}));setConfirmed('');}}/>)}
   <Chip label="No opening overdue obligations or default" selected={clear} onPress={()=>{setClear(!clear);setConfirmed('');}}/>
   <Chip label="No advances, redraw, offsets, reversals, rate changes or closure" selected={noEffects} onPress={()=>{setNoEffects(!noEffects);setConfirmed('');}}/>
   <Chip label="All cleared payments for this period are recorded" selected={complete} onPress={()=>{setComplete(!complete);setConfirmed('');}}/>
   {requirements?.needed.map(d=>{const def=s.policy.inputDefinitions.find(x=>mortgageAnswerId(s,x.field)===d.id)!;if(def.binding!=='customer_fact'){const key=({offer_purpose:'purpose',offer_security:'security',repayment_type:'repaymentType'} as Record<string,string>)[def.binding];return key?field(key,d.label):null;}return <CustomerAnswerEditor key={d.id} definition={d} answer={customer.profile!.answers[d.id]} productKey={target.productKey} disabled={customer.busy} onSave={answer=>void customer.update(p=>({...p,definitions:{...p.definitions,[d.id]:d},answers:{...p.answers,[d.id]:answer}}))}/>;})}
   {!!requirements?.deferred.length&&<AppText variant="small">Unresolved: {requirements.deferred.map(d=>d.label).join(', ')}.</AppText>}
   <Disclosure title="Criteria and source evidence" open={detailOpen} onToggle={()=>setDetailOpen(!detailOpen)}><AppText variant="small">Recorded criteria: {criteria?.status.replace(/_/g,' ')}.</AppText><ReviewedCriteria contract={{eligibility:s.policy.eligibility,inputDefinitions:s.policy.inputDefinitions.map(d=>({key:d.field,label:d.label})),evidence:s.evidence}} trace={criteria!.trace}/></Disclosure>
   <Disclosure title="Saved criteria answers" open={savedOpen} onToggle={()=>setSavedOpen(!savedOpen)}>{requirements?.saved.map(d=><CustomerAnswerEditor key={d.id} definition={d} answer={customer.profile!.answers[d.id]} productKey={target.productKey} disabled={customer.busy} onSave={answer=>void customer.update(p=>({...p,answers:{...p.answers,[d.id]:answer}}))}/>)}</Disclosure>
   <Chip label="I confirm these offer, statement and payment details" selected={!!confirmed} onPress={()=>setConfirmed(confirmed?'':new Date().toISOString())}/>
   <Button title="Calculate mortgage period" disabled={customer.busy} onPress={()=>{try{setResult({identity,value:calculateMortgagePeriod(selection!,context,target,inputs,customer.profile!)});}catch(e){setResult({identity,error:e instanceof Error?e.message:'Calculation unavailable'});}}}/>
  </>}
  {current?.error&&<AppText variant="small">{current.error}</AppText>}
  {current?.value&&<><AppText variant="small">{current.value.receipt.claimAvailable?'Complete for this confirmed account period.':`Incomplete: ${current.value.receipt.issues.join('; ')}`}</AppText>
   {current.value.receipt.loan?.obligations.map(o=><AppText key={o.id} variant="small">{o.dueDate}: due ${o.due??'unknown'}, cleared ${o.paid} — {o.status}.</AppText>)}
   {current.value.receipt.claimAvailable&&<><AppText>Closing debt: ${current.value.receipt.loan?.outstandingDebt}</AppText><AppText>Interest accrued: ${current.value.receipt.totals?.interestAccrued}</AppText><AppText variant="small">Fees paid externally: ${current.value.receipt.totals?.feesPaidExternal}. External fees do not increase the loan balance. Tax effects are not calculated.</AppText></>}
   <Button title="Copy mortgage receipt" onPress={()=>{try{assertMortgageSelection(selection!,context,target);void Clipboard.setStringAsync(JSON.stringify(current.value,null,2)).then(()=>setCopy('Receipt copied.'),()=>setCopy('Copy failed.'));}catch{setCopy('Source changed. Calculate again.');}}}/><AppText variant="small">Receipt includes private entries, due obligations, cleared executions, source identities and the daily trace.</AppText>
  </>}{!!copy&&current&&<AppText variant="small">{copy}</AppText>}
 </View>;
}
