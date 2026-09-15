import React,{useCallback,useMemo,useState} from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { ScreenScrollView } from '../src/components/Screen';
import { AppText,Button,Disclosure } from '../src/components/ui';
import { LedgerField } from '../src/components/ledger/LedgerField';
import { useStore } from '../src/data/store';
import { parseReceipt } from '../src/data/receiptReplay/parse';
import { recalculateReceipt,type ReplayChoice } from '../src/data/receiptReplay/recalculate';
import type { ReplayDocument } from '../src/data/receiptReplay/types';
import { ReplayAccount } from '../src/components/receiptReplay/ReplayAccount';
import { hashText,canonical } from '../src/lib/productTermsEngine/validation';
export default function CalculationReceipt(){
 const manifest=useStore(s=>s.manifest),core=useStore(s=>s.core),coreIntegrity=useStore(s=>s.coreIntegrity),details=useStore(s=>s.details),ensureDetails=useStore(s=>s.ensureDetails);
 const [text,setText]=useState(''),[document,setDocument]=useState<ReplayDocument|null>(null),[error,setError]=useState(''),[checked,setChecked]=useState(false),[choices,setChoices]=useState<Record<number,ReplayChoice|null>>({}),[result,setResult]=useState<{identity:string;value:any}|null>(null),[open,setOpen]=useState(false),[copy,setCopy]=useState(''),[savedOpen,setSavedOpen]=useState(false);
 const context=useMemo(()=>({manifest,core,coreIntegrity,details}),[manifest,core,coreIntegrity,details]),edition=hashText(canonical(manifest));
 const identity=hashText(canonical([document?.digest??null,edition,Object.entries(choices).map(([n,c])=>[n,c?{id:c.option.id,inputs:c.inputs,answers:c.answers,confirmed:c.confirmed,changed:c.sourceChangeConfirmed}:null])])),current=result?.identity===identity?result:null;
 const changeChoice=useCallback((n:number,c:ReplayChoice|null)=>setChoices(v=>({...v,[n]:c})),[]);
 const callbacks=useMemo(()=>document?.items.map((_,n)=>(c:ReplayChoice|null)=>changeChoice(n,c))??[],[document,changeChoice]);
 function read(value:string){setText(value);setDocument(null);setChecked(false);setChoices({});setResult(null);try{setDocument(parseReceipt(value));setError('');}catch(e){setError(e instanceof Error?e.message:'Receipt unavailable');}}
 return <ScreenScrollView><Stack.Screen options={{title:'Open calculation receipt'}}/><View style={{gap:12}}>
  <AppText variant="small">Paste a saved receipt to review its local inputs. Imported results are unverified historical records, not current bank approval. Nothing is uploaded or saved to your profile.</AppText>
  <Button title="Paste calculation receipt" onPress={()=>void Clipboard.getStringAsync().then(read,()=>setError('Clipboard unavailable.'))}/>
  <LedgerField label="Receipt text" multiline value={text} onChangeText={value=>{setText(value);setDocument(null);setChecked(false);setChoices({});setResult(null);}}/><Button title="Read receipt" onPress={()=>read(text)}/>
  {!!error&&<AppText variant="small">{error}</AppText>}
  {document&&<><AppText variant="small">Saved {document.kind.replace(/_/g,' ')} record. Internal digest checked; origin has not been authenticated.</AppText><Disclosure title="Saved result (unverified)" open={savedOpen} onToggle={()=>setSavedOpen(!savedOpen)}><AppText variant="small">{resultSummary(document.original)}</AppText></Disclosure>{document.viewOnlyReason?<AppText>{document.viewOnlyReason}</AppText>:<>
   <Button title="Check current sources" onPress={()=>{setError('');void ensureDetails({forProductView:true}).then(()=>setChecked(true),()=>setError('Current details could not be verified. Retry.'));}}/>
   {checked&&<><AppText variant="small">Current publication: {manifest?.run_date}. Accounts use the explicitly selected reviewed scopes below.</AppText>{document.items.map((item,n)=><ReplayAccount key={`${document.digest}:${edition}:${n}`} item={item} context={context} onChange={callbacks[n]}/>)}
    <Button title="Recalculate with current sources" onPress={()=>{try{const selected=document.items.map((_,n)=>choices[n]);if(selected.some(v=>!v))throw Error('Choose a current scope for every account.');setResult({identity,value:recalculateReceipt(document,context,selected as ReplayChoice[])});setError('');}catch(e){setError(e instanceof Error?e.message:'Recalculation unavailable');}}}/>
   </>}
  </>}</>}
  {current&&<><AppText>Recalculated using current verified sources.</AppText><Disclosure title="Result summary" open={open} onToggle={()=>setOpen(!open)}><AppText variant="small">{resultSummary(current.value)}</AppText></Disclosure><Button title="Copy recalculated receipt" onPress={()=>{try{const selected=document!.items.map((_,n)=>choices[n]);const fresh=recalculateReceipt(document!,context,selected as ReplayChoice[]);void Clipboard.setStringAsync(JSON.stringify(fresh,null,2)).then(()=>setCopy('Receipt copied.'),()=>setCopy('Copy failed.'));}catch{setCopy('Source or inputs changed. Recalculate again.');}}}/></>}
  {!!copy&&current&&<AppText variant="small">{copy}</AppText>}
 </View></ScreenScrollView>;
}
export function resultSummary(value:unknown):string{
 const object=(v:any):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
 const scalar=(v:unknown)=>typeof v==='string'?v.slice(0,200):typeof v==='number'&&Number.isFinite(v)?String(v):'unavailable';
 if(!object(value))return 'Recorded result unavailable.';
 const r=value.kind==='private_calculation_export'?value.result:value;if(!object(r))return 'Recorded result unavailable.';
 if(object(r.eligibility))return `Recorded criteria: ${scalar(r.eligibility.status).replace(/_/g,' ')}. Not bank approval.`;
 if(typeof r.rankAvailable==='boolean')return scalar(r.reason);
 const receipt=r.receipt;if(!object(receipt))return 'Recorded calculation details are retained in the copied receipt.';
 if(receipt.claimAvailable===false)return `Incomplete: ${Array.isArray(receipt.issues)?receipt.issues.slice(0,16).map(scalar).join('; '):'reasons unavailable'}`;
 if(object(receipt.totals))return `Closing balance/debt: ${scalar(receipt.loan?.outstandingDebt??receipt.totals.closingBalance)}. Interest accrued: ${scalar(receipt.totals.interestAccrued)}. Fees paid externally: ${scalar(receipt.totals.feesPaidExternal)}. Tax not calculated.`;
 if(Array.isArray(receipt.results))return receipt.results.slice(0,8).map((x:any)=>object(x)?`${scalar(x.id)}: ${scalar(x.receipt?.closingNetWorth)}; rank ${scalar(x.rank)}`:'Result unavailable').join('; ');
 return 'Recorded calculation details are retained in the copied receipt.';
}
