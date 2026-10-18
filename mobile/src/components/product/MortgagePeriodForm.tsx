import React, { useEffect, useState } from 'react';
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
import type { CalculationReceipt } from '../../lib/productTermsEngine/types';
import { CustomerAnswerEditor } from '../CustomerProfilePanel';
import { LedgerField } from '../ledger/LedgerField';
import { AppText, Chip, Button, Disclosure } from '../ui';
import { ReviewedCriteria } from './DepositCriteria';
import { EngineReceiptFacts, uiEngineStatus } from './EngineReceiptFacts';
import { uiEngineScope } from './engineComparisonUi';
import { uiCount, uiDate, uiDecimal, uiIdentifier, uiInputIdentifier, uiInputNumber, uiJoin, uiLabel, uiNumber, uiPrivateOfferInput, type UiCopy, type UiLabel } from '../../lib/uiCopy';
const labels = { principal: 'Principal', postedInterest: 'Interest posted', accruedInterest: 'Interest unposted', capitalizedCharges: 'Capitalised charges', otherDebt: 'Other debt' } as const;
export function MortgageResultDetails({ receipt }: { receipt: CalculationReceipt }) {
 const [open,setOpen]=useState(false),loan=receipt.loan,t=receipt.totals;
 const fact=(label:UiCopy,value:string|null|undefined)=><AppText variant="small">{uiJoin(label, ': ', uiDecimal(value))}</AppText>;
 return <>{fact('Outstanding debt',loan?.outstandingDebt)}
  {!receipt.claimAvailable&&<AppText variant="small">{uiLabel('Known components')}</AppText>}
  <Disclosure title={uiJoin('Debt', ' / ', 'Interest', ' / ', 'Fees')} open={open} onToggle={()=>setOpen(!open)}>
   {fact('Known component debt',loan?.knownComponentDebt)}
   {fact('Principal remaining',loan?.closing.principal)}{fact('Principal repaid',loan?.principalRepaid)}
   {fact('Interest accrued',t?.interestAccrued)}{fact('Interest paid',loan?.interestPaid)}
   {fact('Capitalised charges remaining',loan?.closing.capitalizedCharges)}{fact('Charges paid',loan?.chargesPaid)}
   {fact('Fees paid externally',t?.feesPaidExternal)}
   <AppText variant="small">{uiJoin('Tax', ' · ', 'Excluded')}</AppText>
  </Disclosure></>;
}
export interface MortgageFormInput { selection: MortgageSelection; inputs: MortgageInputs }
export function MortgagePeriodForm({selections,context,target,onComparisonInput}:{selections:MortgageSelection[];context:MortgageContext;target:MortgageTarget;onComparisonInput?:(value:MortgageFormInput|null)=>void}) {
 const customer=useCustomerProfile(),[selectedId,setSelectedId]=useState<string|null>(null),[text,setText]=useState<Record<string,string>>({}),[confirmed,setConfirmed]=useState(''),[clear,setClear]=useState(false),[noEffects,setNoEffects]=useState(false),[complete,setComplete]=useState(false),[feeConfirmed,setFeeConfirmed]=useState<Record<string,boolean>>({}),[detailOpen,setDetailOpen]=useState(false),[savedOpen,setSavedOpen]=useState(false),[copy,setCopy]=useState<UiLabel>('');
 const selection=selections.find(s=>s.subject.id===selectedId),s=selection?.subject;
 function change(key:string,value:string){setText(v=>({...v,[key]:value}));setConfirmed('');setCopy('');}
 let annualRate='';try{const d=Decimal.parse(text.rate??'').div(Decimal.parse('100'));if(d.compare(Decimal.parse(d.fixed(12)))===0)annualRate=d.fixed(12);}catch{/* Unconfirmed until exact decimal. */}
 let due:string[]=[];try{if(s)due=mortgageDueDates(s,text.anchor??'');}catch{/* Invalid anchor is shown by calculation admission. */}
 const positiveFees=s?.policy.fees.occurrences.filter(f=>Decimal.parse(f.amount).compare(Decimal.parse('0'))>0)??[],roles=[...new Set(positiveFees.map(f=>f.externalAccountRole))];
 const inputs:MortgageInputs={accountId:text.account??'',offerId:text.offer??'',sourceVersion:text.version??'',snapshotId:text.snapshot??'',from:s?.scope.from??'',toExclusive:s?.scope.toExclusive??'',confirmedAt:confirmed,provenance:'user_reported_bank_offer_and_statement',confirmedAnnualRate:annualRate,openingOutstanding:text.outstanding??'',openingComponents:Object.fromEntries(LOAN_COMPONENTS.map(k=>[k,text[k]??''])) as MortgageInputs['openingComponents'],noCarriedArrearsOrDefault:clear,noExcludedMovements:noEffects,obligationAmount:text.obligation??'',originalAnchor:text.anchor??'',executionCoverage:complete?'complete':'unknown',payments:due.filter(date=>!!text[`paid:${date}`]).map((date,n)=>({id:`payment_${n}`,accountId:text.account??'',obligationId:s?mortgageObligationId(s,text.account??'',date):'',date,phase:s!.policy.paymentPhase,order:n,amount:text[`paid:${date}`],status:'cleared'})),externalAccounts:roles.map(role=>({role,accountId:text[`external:${role}`]??''})),feeSettlements:positiveFees.filter(f=>feeConfirmed[f.id]).map(f=>({occurrenceId:f.id,externalAccountId:text[`external:${f.externalAccountRole}`]??'',date:f.dueDate,amount:f.amount,status:'cleared'})),confirmedOfferFacts:Object.fromEntries(['purpose','security','repaymentType'].filter(k=>!!text[k]).map(k=>[k,text[k]])),customerFacts:[]};
 const identity=hashText(canonical([selectedId,inputs,customer.profile?.revision??null])),[result,setResult]=useState<{identity:string;value?:ReturnType<typeof calculateMortgagePeriod>;error?:string}|null>(null),current=result?.identity===identity?result:null;
 const inputKey=canonical(inputs);
 useEffect(()=>{onComparisonInput?.(selection?{selection,inputs:JSON.parse(inputKey)}:null);},[selection,inputKey,onComparisonInput]);
 if(!customer.profile)return <AppText variant="small">{uiLabel(customer.error?'Unavailable':'Loading')}</AppText>;
 const requirements=s?mortgageRequirements(s,inputs,customer.profile):null,criteria=s?evaluateEligibility(s.policy.eligibility,mortgageFacts(s,inputs,customer.profile).facts):null;
  const field=(key:string,label:UiCopy,decimal=false,placeholder?:UiCopy)=>{
  const value=key==='purpose'||key==='security'||key==='repaymentType'?uiPrivateOfferInput(inputs,key):decimal?uiInputNumber(text[key]??''):uiInputIdentifier(text[key]??'');
   return <LedgerField key={key} label={label} value={value} placeholder={placeholder} keyboardType={decimal?'decimal-pad':'default'} onChangeText={value=>change(key,value)}/>;
 };
 return <View style={{gap:12}}>
  <AppText variant="small">{uiJoin('Basis', ' · ', 'History', ' · ', 'Local storage', ' · ', 'No approval')}</AppText>
  <AppText variant="small">{uiJoin('Published', ' · ', uiDate(context.manifest?.run_date))}</AppText>
  {selections.map(x=><View key={x.subject.id}><AppText variant="small">{uiJoin('Eligibility', ' · ', uiEngineStatus(evaluateEligibility(x.subject.policy.eligibility,mortgageFacts(x.subject,inputs,customer.profile!).facts).status))}</AppText><Chip label={uiJoin(uiEngineScope(x.subject.scope.cohortKey), ' / ', uiEngineScope(x.subject.scope.tierKey), ' / ', uiEngineScope(x.subject.scope.packageKey))} selected={selectedId===x.subject.id} onPress={()=>{setSelectedId(x.subject.id);setConfirmed('');setText({});setFeeConfirmed({});setClear(false);setNoEffects(false);setComplete(false);}}/></View>)}
  {s&&<>
   <AppText variant="small">{uiJoin('Coverage', ' · ', uiDate(s.scope.from), ' ', '–', ' ', uiDate(s.scope.toExclusive), ' · ', 'End excluded')}</AppText>
   {field('account','Local loan account reference')}{field('offer','Local offer reference')}{field('version','Offer version reference')}{field('snapshot','Opening statement reference')}
   {field('rate','Confirmed annual rate (%)',true)}{field('outstanding','Opening total debt (AUD)',true)}
    {LOAN_COMPONENTS.map(k=>field(k,uiJoin(labels[k], ' (', 'AUD', ')'),true,uiNumber(0)))}
   {field('obligation','Confirmed monthly amount due (AUD)',true)}{field('anchor',uiJoin('Original monthly due date', ' · ', 'YYYY-MM-DD'))}
   <AppText variant="small">{uiJoin('Payment phase', ' · ', s.policy.paymentPhase==='before_accrual'?'Before daily interest':'After daily interest')}</AppText>
   {due.map(date=>field('paid:'+date,uiJoin('Cleared payment', ' · ', uiDate(date), ' (', 'AUD', ')'),true))}
   {roles.map(role=>field('external:'+role,uiJoin('External fee account reference', ': ', uiIdentifier(role))))}
   {positiveFees.map(f=><Chip key={f.id} label={uiJoin('Fee', ' · ', uiIdentifier(f.id), ' · ', uiDecimal(f.amount), ' · ', 'Cleared', ' · ', uiDate(f.dueDate))} selected={!!feeConfirmed[f.id]} onPress={()=>{setFeeConfirmed(v=>({...v,[f.id]:!v[f.id]}));setConfirmed('');}}/>)}
   <Chip label="No arrears / default" selected={clear} onPress={()=>{setClear(!clear);setConfirmed('');}}/>
   <Chip label="No excluded movements" selected={noEffects} onPress={()=>{setNoEffects(!noEffects);setConfirmed('');}}/>
   <AppText variant="small">{uiJoin('Excluded', ' · ', 'Advances', ' / ', 'Redraw', ' / ', 'Offset', ' / ', 'Reversals', ' / ', 'Rate changes', ' / ', 'Closure')}</AppText>
   <Chip label="Payments complete" selected={complete} onPress={()=>{setComplete(!complete);setConfirmed('');}}/>
   {requirements?.needed.map(d=>{const def=s.policy.inputDefinitions.find(x=>mortgageAnswerId(s,x.field)===d.id)!;if(def.binding!=='customer_fact'){switch(def.binding){case 'offer_purpose':return field('purpose','Loan purpose');case 'offer_security':return field('security','Security');case 'repayment_type':return field('repaymentType','Repayment');default:return null;}}return <CustomerAnswerEditor key={d.id} definition={d} questionSource={{ kind: 'mortgage', selection: selection!, context, target }} answer={customer.profile!.answers[d.id]} productKey={target.productKey} disabled={customer.busy} onSave={answer=>void customer.update(p=>({...p,definitions:{...p.definitions,[d.id]:d},answers:{...p.answers,[d.id]:answer}}))}/>;})}
   {!!requirements?.deferred.length&&<AppText variant="small">{uiJoin('Unresolved inputs', ' · ', uiCount(requirements.deferred.length))}</AppText>}
   <Disclosure title="Criteria" open={detailOpen} onToggle={()=>setDetailOpen(!detailOpen)}><AppText variant="small">{uiJoin('Eligibility', ' · ', uiEngineStatus(criteria?.status))}</AppText><ReviewedCriteria contract={{eligibility:s.policy.eligibility,inputDefinitions:s.policy.inputDefinitions.map(d=>({key:d.field,label:d.label})),evidence:s.evidence}} trace={criteria!.trace}/></Disclosure>
   <Disclosure title="Saved answers" open={savedOpen} onToggle={()=>setSavedOpen(!savedOpen)}>{requirements?.saved.map(d=><CustomerAnswerEditor key={d.id} definition={d} questionSource={{ kind: 'mortgage', selection: selection!, context, target }} answer={customer.profile!.answers[d.id]} productKey={target.productKey} disabled={customer.busy} onSave={answer=>void customer.update(p=>({...p,answers:{...p.answers,[d.id]:answer}}))}/>)}</Disclosure>
   <Chip label="Confirmed" selected={!!confirmed} onPress={()=>setConfirmed(confirmed?'':new Date().toISOString())}/>
   {!onComparisonInput&&<Button title={uiJoin('Calculate', ' ', 'Mortgage')} disabled={customer.busy} onPress={()=>{try{setResult({identity,value:calculateMortgagePeriod(selection!,context,target,inputs,customer.profile!)});}catch(e){setResult({identity,error:e instanceof Error?e.message:'Calculation unavailable'});}}}/>}
  </>}
  {current?.error&&<AppText variant="small">{uiLabel('Unavailable')}</AppText>}
  {current?.value&&<><EngineReceiptFacts receipt={current.value.receipt}/>
   {current.value.receipt.loan?.obligations.map(o=><AppText key={o.id} variant="small">{uiJoin(uiDate(o.dueDate), ' · ', 'Due', ': ', uiDecimal(o.due), ' · ', 'Cleared', ': ', uiDecimal(o.paid), ' · ', uiLabel(o.status==='paid'?'Complete':o.status==='partial'?'Partial':o.status==='unpaid'?'Pending':'Unknown'))}</AppText>)}
   <MortgageResultDetails receipt={current.value.receipt}/>
   <Button title={uiJoin('Copy', ' ', 'Receipt')} onPress={()=>{try{assertMortgageSelection(selection!,context,target);void Clipboard.setStringAsync(JSON.stringify(current.value,null,2)).then(()=>setCopy('Copied'),()=>setCopy('Copy failed'));}catch{setCopy('Source changed');}}}/><AppText variant="small">{uiJoin('Receipt', ' · ', 'Private', ' · ', 'Entered facts', ' · ', 'Obligations', ' · ', 'Source')}</AppText>
  </>}{!!copy&&current&&<AppText variant="small">{uiLabel(copy)}</AppText>}
 </View>;

}
