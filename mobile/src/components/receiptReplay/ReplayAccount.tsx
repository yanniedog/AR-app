import { uiCount, uiDate, uiIdentifier, uiInputIdentifier, uiInputNumber, uiJoin, uiProductName, uiRate, type UiCopy } from "../../lib/uiCopy";
import { toFraction } from '../../data/format';
import { InfoRow } from "../settings/settingsUi";
import { ActivityEvents } from '../product/ActivityEvents';
import type { ActivitySelection } from '../../data/activityContracts/transport';
import React,{useEffect,useState} from 'react';
import { View } from 'react-native';
import { AppText,Chip,Disclosure } from '../ui';
import { LedgerField } from '../ledger/LedgerField';
import { CustomerAnswerEditor } from '../CustomerProfilePanel';
import { currentReplayRows,resolveReplayItem,type ReplayOption } from '../../data/receiptReplay/resolve';
import { replayProfile,replayRequirements,type ReplayChoice } from '../../data/receiptReplay/recalculate';
import type { ReplayItem } from '../../data/receiptReplay/types';
import type { EligibilityContext } from '../../data/eligibilityContracts/transport';
import type { RateRow } from '../../types';
import { EligibilityScenarioFields } from '../product/EligibilityScenarioFields';
import { eligibilityRequirements } from '../../data/eligibilityContracts/facts';
import type { EligibilitySelection } from '../../data/eligibilityContracts/transport';
import { replayQuestionSource } from '../../lib/customerQuestionBinding';
const INPUT_LABELS:Readonly<Record<string,UiCopy>>={
  openingBalance:'Opening balance',principal:'Principal',fundedDate:'Funded date',maturityDate:'Maturity date',
  confirmedAnnualRate:'Confirmed annual rate',confirmedAt:'Confirmation date',accountId:'Account ID',
  noWithholdingConfirmed:'Withholding excluded',confirmed:'Confirmed',startDate:'Starting date',endDateExclusive:'End excluded',
  openingOffsetBalance:'Opening offset',assessmentDate:'Assessment date',amount:'Amount',rate:'Rate',
  date:'Date',balance:'Balance',value:'Value',type:'Type',id:'ID',annualRate:'Annual rate',
};
const IDENTIFIER_INPUTS=new Set(['accountId','id','intervalId','tierId','componentId','timezone','type','field','metric','state','status']);
function inputLabel(path:readonly string[]):UiCopy {
  return uiJoin(...path.flatMap<UiCopy>((key,index)=>index?[' / ',INPUT_LABELS[key]??uiIdentifier(key)]:[INPUT_LABELS[key]??uiIdentifier(key)]));
}
function InputValues({value,onChange,path=[]}:{value:any;onChange:(v:any)=>void;path?:readonly string[]}) {
  const label=inputLabel(path),key=path.at(-1)??'';
  if(value===null)return <InfoRow label={label} value="Unknown"/>;
  if(typeof value==='boolean')return <Chip label={label} selected={value} onPress={()=>onChange(!value)}/>;
  if(typeof value==='string'||typeof value==='number') {
    const numeric=typeof value==='number'||/^[\d.,+\- $%]*$/.test(value);
    if(!numeric&&!IDENTIFIER_INPUTS.has(key))return <InfoRow label={label} value="Source review required"/>;
    return <LedgerField label={label} value={numeric?uiInputNumber(String(value)):uiInputIdentifier(value)}
      onChangeText={v=>onChange(typeof value==='number'&&/^\d+$/.test(v)?Number(v):v)}/>;
  }
  return <View style={{gap:6}}>{Object.entries(value??{}).map(([key,v])=><InputValues key={key} path={[...path,key]} value={v}
    onChange={changed=>{const copy=Array.isArray(value)?[...value]:{...value};copy[key]=changed;onChange(copy);}}/>)}</View>;
}
const KIND:Record<ReplayItem['kind'],UiCopy>={td:'Term deposits',eligibility_only:'Eligibility',savings_calculation:'Savings',savings_activity_calculation:'Savings activity',mortgage_calculation:'Mortgage'};
function optionLabel(option:ReplayOption,index:number):UiCopy {
  const subject='template'in option.selection?option.selection.template:option.selection.subject;
  if('scope'in subject) return uiJoin('Scope',' ',uiCount(index+1),' · ',uiIdentifier(subject.scope.cohortKey),' / ',uiIdentifier(subject.scope.tierKey),' / ',uiIdentifier(subject.scope.packageKey),
    ' · ',uiDate('from' in subject.scope?subject.scope.from:subject.scope.effectiveFrom),
    ' → ',uiDate('toExclusive' in subject.scope?subject.scope.toExclusive:subject.scope.effectiveToExclusive));
  return uiJoin('Scope',' ',uiCount(index+1),' · ',uiIdentifier(option.id));
}
export function ReplayAccount({item,context,onChange}:{item:ReplayItem;context:EligibilityContext;onChange:(choice:ReplayChoice|null)=>void}){
 const [row,setRow]=useState<RateRow>(),[options,setOptions]=useState<ReplayOption[]>([]),[option,setOption]=useState<ReplayOption|null>(null),[error,setError]=useState<UiCopy|null>(null),[inputs,setInputs]=useState<any>(()=>structuredClone(item.inputs)),[answers,setAnswers]=useState<ReplayChoice['answers']>({}),[confirmed,setConfirmed]=useState(false),[changed,setChanged]=useState(false),[open,setOpen]=useState(false),[variants,setVariants]=useState(false);
 useEffect(()=>{let active=true;setOption(null);setOptions([]);setConfirmed(false);setChanged(false);onChange(null);void resolveReplayItem(item,context,row).then(v=>{if(active){setOptions(v);setError(v.length?null:'No current scope');}},()=>{if(active)setError('Sources unverified');});return()=>{active=false;};},[item,context,row,onChange]);
 useEffect(()=>{onChange(option?{option,inputs,answers,confirmed,sourceChangeConfirmed:changed}:null);},[option,inputs,answers,confirmed,changed,onChange]);
 let requirements:ReturnType<typeof replayRequirements>|null=null;try{if(option)requirements=replayRequirements(option,inputs,answers);}catch{/* Adapter admission reports invalid edited inputs. */}
 let rows:RateRow[]=[];try{rows=currentReplayRows(item,context);}catch{/* Resolver reports bound. */}
 const profile=option?replayProfile(option,answers):null;
 const eligibilitySubject=option&&item.kind==='eligibility_only'?(option.selection as EligibilitySelection).subject:null;
 let scenarioNeeded=eligibilitySubject?.inputDefinitions.slice(0,0)??[];try{if(eligibilitySubject&&profile)scenarioNeeded=eligibilityRequirements(eligibilitySubject,inputs,profile).needed;}catch{/* Current adapter reports malformed local inputs. */}
 return <View style={{gap:8}}><AppText weight="700">{uiJoin(uiIdentifier(item.target.productKey),' · ',KIND[item.kind])}</AppText>
  <InfoRow label="Previous source" value={uiIdentifier(item.sourceId.slice(0,12))}/><InfoRow label="Bank approval" value="Unverified"/>
  {!!rows.length&&<Disclosure title="Choose current rate variant" open={variants} onToggle={()=>setVariants(!variants)}>{rows.map((r,i)=><Chip key={i} label={uiJoin(uiProductName(r),' · ',uiRate(toFraction(r.rate)),' · ','Rate index',': ',uiCount(r.rate_index))} selected={row===r} onPress={()=>setRow(r)}/>)}</Disclosure>}
  {!!error&&<AppText variant="small">{error}</AppText>}
  {options.map((o,index)=><Chip key={o.id} label={optionLabel(o,index)} selected={option===o} onPress={()=>{setOption(o);if(o.id!==item.sourceId){if(item.kind==='mortgage_calculation')setInputs((v:any)=>({...v,customerFacts:[]}));if(item.kind==='savings_activity_calculation'){const p=(o.selection as ActivitySelection).subject.policy;setInputs((v:any)=>({...v,startDate:(o.selection as ActivitySelection).subject.scope.from,endDateExclusive:(o.selection as ActivitySelection).subject.scope.toExclusive,confirmedAt:null,confirmedAnnualRates:p.intervals.flatMap(i=>i.tiers.map(t=>({intervalId:i.id,tierId:t.id,annualRate:''}))),confirmedBonusAnnualRates:p.bonus.tiers.map(t=>({componentId:p.bonus.componentId,tierId:t.id,annualRate:''})),activity:{events:[],coverage:[{accountId:v.accountId,from:p.bonus.assessment.from,toExclusive:p.bonus.assessment.toExclusive,status:'unknown'}]}}));}if(item.kind==='eligibility_only')setInputs((v:any)=>({...v,values:{}}));}setConfirmed(false);setChanged(false);setAnswers({});}}/>)}
  <Disclosure title="Review local inputs" open={open} onToggle={()=>setOpen(!open)}>{item.kind==='eligibility_only'?<LedgerField label="Assessment date" value={uiInputNumber(inputs.assessmentDate??'')} onChangeText={assessmentDate=>{setInputs((v:any)=>({...v,assessmentDate}));setConfirmed(false);}}/>:<InputValues value={item.kind==='savings_activity_calculation'?Object.fromEntries(Object.entries(inputs).filter(([k])=>k!=='activity')):inputs} onChange={v=>{setInputs(item.kind==='savings_activity_calculation'?{...v,activity:inputs.activity}:v);setConfirmed(false);}}/>}</Disclosure>
  {option&&item.kind==='savings_activity_calculation'&&<ActivityEvents assessment={(option.selection as ActivitySelection).subject.policy.bonus.assessment} accountId={inputs.accountId} events={inputs.activity?.events??[]} complete={inputs.activity?.coverage?.[0]?.status==='complete'} onChange={events=>{setInputs((v:any)=>({...v,activity:{...v.activity,events}}));setConfirmed(false);}} onCoverage={complete=>{const a=(option.selection as ActivitySelection).subject.policy.bonus.assessment;setInputs((v:any)=>({...v,activity:{...v.activity,coverage:[{accountId:v.accountId,from:a.from,toExclusive:a.toExclusive,status:complete?'complete':'unknown'}]}}));setConfirmed(false);}}/>}
  {eligibilitySubject&&<EligibilityScenarioFields definitions={eligibilitySubject.inputDefinitions} needed={scenarioNeeded} values={inputs.values??{}} onChange={values=>{setInputs((v:any)=>({...v,values}));setConfirmed(false);}}/>}
  {option&&<>{option.changed&&<><InfoRow label="Source" value="Changed"/><InfoRow label="Transferred answers" value="None"/><Chip label="Use current source" selected={changed} onPress={()=>{setChanged(!changed);setConfirmed(false);}}/></>}
   {requirements?.needed.filter(d=>Object.hasOwn(profile!.definitions,d.id)).map(d=><CustomerAnswerEditor key={d.id} definition={d} questionSource={replayQuestionSource(option,context)} answer={profile!.answers[d.id]} productKey={item.target.productKey} disabled={false} onSave={a=>{setAnswers(v=>({...v,[d.id]:a}));setConfirmed(false);}}/>)}
   {!!requirements?.deferred.length&&<AppText variant="small">{uiJoin('Unresolved inputs',': ',uiCount(requirements.deferred.length))}</AppText>}
   {(requirements?.saved??[]).map(d=><CustomerAnswerEditor key={d.id} definition={d} questionSource={replayQuestionSource(option,context)} answer={profile!.answers[d.id]} productKey={item.target.productKey} disabled={false} onSave={a=>{setAnswers(v=>({...v,[d.id]:a}));setConfirmed(false);}}/>)}
   <Chip label="Inputs reviewed" selected={confirmed} onPress={()=>setConfirmed(!confirmed)}/>
  </>}
 </View>;
}
