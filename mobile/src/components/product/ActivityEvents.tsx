import React,{useState} from 'react';
import { View } from 'react-native';
import { AppText,Button,Chip,Disclosure } from '../ui';
import { LedgerField } from '../ledger/LedgerField';
import type { ActivityAssessment } from '../../data/activityContracts/types';
import type { SavingsActivityEvent } from '../../lib/productTermsEngine/savingsActivityTypes';
export function ActivityEvents({assessment,accountId,events,complete,onChange,onCoverage}:{assessment:ActivityAssessment;accountId:string;events:SavingsActivityEvent[];complete:boolean;onChange:(events:SavingsActivityEvent[])=>void;onCoverage:(complete:boolean)=>void}){
 const [page,setPage]=useState(0),[open,setOpen]=useState(false),last=Math.max(0,Math.ceil(events.length/25)-1),current=Math.min(page,last);
 const classes=[...new Set(assessment.metrics.flatMap(m=>[...m.includedClassifications,...m.excludedClassifications]))];
 function edit(index:number,patch:Partial<SavingsActivityEvent>){onChange(events.map((e,n)=>n===index?{...e,...patch}:e));}
 return <View style={{gap:8}}><AppText variant="small">Prior activity: {assessment.from} to {assessment.toExclusive} (end excluded), {assessment.dateBasis} dates. These entries affect bonus eligibility, not the calculation-period balance.</AppText>
  <Chip label="My activity list covers the entire prior period" selected={complete} onPress={()=>onCoverage(!complete)}/>
  <Disclosure title={`Prior deposits and withdrawals (${events.length})`} open={open} onToggle={()=>setOpen(!open)}>
   {events.slice(current*25,current*25+25).map((e,n)=>{const index=current*25+n;return <View key={e.id} style={{gap:6}}><AppText weight="700">Entry {index+1}</AppText>
    <LedgerField label={`Entry ${index+1} date`} hint="YYYY-MM-DD" value={e.date} onChangeText={date=>edit(index,{date})}/><LedgerField label={`Entry ${index+1} amount (AUD)`} value={e.amount} keyboardType="decimal-pad" onChangeText={amount=>edit(index,{amount})}/>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{(['deposit','withdrawal','unknown'] as const).map(kind=><Chip key={kind} label={kind} selected={e.kind===kind} onPress={()=>edit(index,{kind})}/>)}</View>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{(['settled','pending','unknown'] as const).map(status=><Chip key={status} label={`Status: ${status}`} selected={e.status===status} onPress={()=>edit(index,{status})}/>)}</View>
    <AppText variant="small">Source category</AppText><View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{classes.map(classification=><Chip key={classification} label={classification} selected={e.classification===classification} onPress={()=>edit(index,{classification})}/>)}<Chip label="Unknown category" selected={e.classification===null} onPress={()=>edit(index,{classification:null})}/></View>
    <Button title={`Remove entry ${index+1}`} variant="secondary" onPress={()=>onChange(events.filter((_,i)=>i!==index))}/>
   </View>;})}
   {!!events.length&&<AppText variant="small">Page {current+1} of {last+1}</AppText>}
   {current>0&&<Button title="Previous activity page" onPress={()=>setPage(current-1)}/>} {current<last&&<Button title="Next activity page" onPress={()=>setPage(current+1)}/>}
   <Button title="Add prior activity" disabled={events.length>=1000} onPress={()=>{let n=1;while(events.some(e=>e.id===`event-${n}`))n++;onChange([...events,{id:`event-${n}`,accountId,date:'',dateBasis:assessment.dateBasis,kind:'unknown',status:'unknown',amount:'',classification:null}]);setPage(Math.floor(events.length/25));}}/>
  </Disclosure></View>;
}
