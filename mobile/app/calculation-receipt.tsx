import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { ScreenScrollView } from '../src/components/Screen';
import { AppText, Button, Card, Disclosure } from '../src/components/ui';
import { LedgerField } from '../src/components/ledger/LedgerField';
import { InfoRow } from '../src/components/settings/settingsUi';
import { ReceiptEvidenceText } from '../src/components/ReceiptEvidenceText';
import { useStore } from '../src/data/store';
import { parseReceipt } from '../src/data/receiptReplay/parse';
import { recalculateReceipt, type ReplayChoice } from '../src/data/receiptReplay/recalculate';
import type { ReplayDocument } from '../src/data/receiptReplay/types';
import { ReplayAccount } from '../src/components/receiptReplay/ReplayAccount';
import { hashText, canonical } from '../src/lib/productTermsEngine/validation';
import { useReceiptImportInput, uiCount, uiDate, uiDecimal, uiIdentifier, uiLabel, type UiCopy, type UiText } from '../src/lib/uiCopy';

function record(value:unknown): value is Record<string,unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function recordedMoney(value:unknown): UiText {return uiDecimal(typeof value === 'string' ? value:null);}
export function resultSummary(value:unknown): UiText {
  if (!record(value)) return uiLabel('Unavailable');
  const result=value.kind === 'private_calculation_export' ? value.result:value;
  if (!record(result)) return uiLabel('Unavailable');
  return uiLabel(record(result.receipt) && result.receipt.claimAvailable === false ? 'Incomplete':'Unverified');
}
function RecordedFacts({document}:{document:ReplayDocument}) {
  const value=document.original;
  const result=record(value) && value.kind === 'private_calculation_export' ? value.result:value;
  const receipt=record(result) && record(result.receipt) ? result.receipt:null;
  const totals=receipt && record(receipt.totals) ? receipt.totals:null;
  const loan=receipt && record(receipt.loan) ? receipt.loan:null;
  const children=receipt && Array.isArray(receipt.results) ? receipt.results:[];
  return <View style={{gap:6}}>
    <InfoRow label="Recorded result" value={resultSummary(value)}/>
    {record(result) && record(result.eligibility) ? <InfoRow label="Recorded criteria" value={uiLabel(result.eligibility.status === 'meets' ? 'Meets':result.eligibility.status === 'does_not_meet' ? 'Does not meet':result.eligibility.status === 'needs_information' ? 'Needs information':'Unknown')}/>:null}
    {record(result) && typeof result.rankAvailable === 'boolean' ? <InfoRow label="Rank" value={uiLabel(result.rankAvailable ? 'Available':'Unavailable')}/>:null}
    {totals ? <>
      <InfoRow label={uiLabel(loan ? 'Closing loan balance':'Closing balance')} value={recordedMoney(loan?.outstandingDebt ?? totals.closingBalance)}/>
      <InfoRow label="Interest accrued" value={recordedMoney(totals.interestAccrued)}/>
      <InfoRow label="Fees paid externally" value={recordedMoney(totals.feesPaidExternal)}/>
      <InfoRow label="Tax" value="Not calculated"/>
    </>:null}
    {children.slice(0,8).map((child,index)=>record(child) ? <View key={index}>
      <InfoRow label={uiIdentifier(typeof child.id === 'string' ? child.id:null)} value={record(child.receipt) ? recordedMoney(child.receipt.closingNetWorth):'Unknown'}/>
      <InfoRow label="Rank" value={typeof child.rank === 'number' ? uiCount(child.rank):'Unknown'}/>
    </View>:null)}
  </View>;
}
export default function CalculationReceipt() {
  const manifest=useStore(s=>s.manifest), core=useStore(s=>s.core), coreIntegrity=useStore(s=>s.coreIntegrity), details=useStore(s=>s.details), ensureDetails=useStore(s=>s.ensureDetails);
  const receiptInput=useReceiptImportInput();
  const text=receiptInput.raw;
  const [document,setDocument]=useState<ReplayDocument|null>(null);
  const [error,setError]=useState<UiCopy|null>(null);
  const [checked,setChecked]=useState(false), [choices,setChoices]=useState<Record<number,ReplayChoice|null>>({});
  const [result,setResult]=useState<{identity:string;document:ReplayDocument}|null>(null);
  const [savedOpen,setSavedOpen]=useState(false), [rawOpen,setRawOpen]=useState(false);
  const [copy,setCopy]=useState<UiCopy|null>(null);
  const context=useMemo(()=>({manifest,core,coreIntegrity,details}),[manifest,core,coreIntegrity,details]);
  const edition=hashText(canonical(manifest));
  const identity=hashText(canonical([document?.digest??null,edition,Object.entries(choices).map(([n,c])=>[n,c?{id:c.option.id,inputs:c.inputs,answers:c.answers,confirmed:c.confirmed,changed:c.sourceChangeConfirmed}:null])]));
  const current=result?.identity === identity ? result:null;
  const changeChoice=useCallback((n:number,c:ReplayChoice|null)=>setChoices(v=>({...v,[n]:c})),[]);
  const callbacks=useMemo(()=>document?.items.map((_,n)=>(c:ReplayChoice|null)=>changeChoice(n,c))??[],[document,changeChoice]);
  const edit=(value:string)=>{receiptInput.onChangeText(value);setDocument(null);setChecked(false);setChoices({});setResult(null);setCopy(null);};
  function read(value:string) {
    edit(value);
    try {setDocument(parseReceipt(value));setError(null);} catch {setError('Receipt unavailable');}
  }
  function selectedChoices(): ReplayChoice[] | null {
    if (!document) return null;
    const selected=document.items.map((_,n)=>choices[n]);
    return selected.every((choice):choice is ReplayChoice=>!!choice) ? selected:null;
  }
  return <ScreenScrollView><Stack.Screen options={{title:'Open calculation receipt'}}/><View style={{gap:12}}>
    <Button title="Paste calculation receipt" onPress={()=>void Clipboard.getStringAsync().then(read,()=>setError('Clipboard unavailable'))}/>
    <LedgerField label="Receipt text" multiline value={receiptInput.value} onChangeText={edit}/>
    <Button title="Read receipt" onPress={()=>read(text)}/>
    <InfoRow label="Privacy" value="Local only"/>
    <InfoRow label="Profile" value="Unchanged"/>
    {error ? <AppText color="danger" accessibilityRole="alert">{error}</AppText>:null}
    {document ? <>
      <Card style={{gap:6}}><InfoRow label="Digest" value="Checked"/><InfoRow label="Origin" value="Unauthenticated"/><InfoRow label="Saved result" value="Historical · Unverified"/><InfoRow label="Bank approval" value="Unverified"/></Card>
      <Disclosure title="Saved result" open={savedOpen} onToggle={()=>setSavedOpen(!savedOpen)}><RecordedFacts document={document}/><ReceiptEvidenceText document={document}/></Disclosure>
      {document.viewOnlyReason ? <InfoRow label="Legacy receipt" value="View only"/>:<>
        <Button title="Check current sources" onPress={()=>{setError(null);void ensureDetails({forProductView:true}).then(()=>setChecked(true),()=>setError('Sources unverified'));}}/>
        {checked ? <>
          <InfoRow label="Current publication" value={uiDate(manifest?.run_date)}/>
          {document.items.map((item,n)=><ReplayAccount key={`${document.digest}:${edition}:${n}`} item={item} context={context} onChange={callbacks[n]}/>)}
          <Button title="Recalculate with current sources" onPress={()=>{
            try {
              const selected=selectedChoices();
              if (!selected) {setError('Current scope required');return;}
              const fresh=recalculateReceipt(document,context,selected);
              setResult({identity,document:parseReceipt(JSON.stringify(fresh))});setError(null);
            } catch {setError('Recalculation unavailable');}
          }}/>
        </>:null}
      </>}
    </>:null}
    {current ? <Card style={{gap:10}}><InfoRow label="Sources" value="Current · Verified"/><InfoRow label="Bank approval" value="Unverified"/>
      <RecordedFacts document={current.document}/>
      <Disclosure title="Raw receipt" open={rawOpen} onToggle={()=>setRawOpen(!rawOpen)}><ReceiptEvidenceText document={current.document}/></Disclosure>
      <Button title="Copy recalculated receipt" onPress={()=>{
        try {
          const selected=selectedChoices();
          if (!selected || !document) {setCopy('Source or inputs changed');return;}
          const fresh=recalculateReceipt(document,context,selected);
          void Clipboard.setStringAsync(JSON.stringify(fresh,null,2)).then(()=>setCopy('Copied'),()=>setCopy('Copy failed'));
        } catch {setCopy('Source or inputs changed');}
      }}/>
      {copy ? <AppText>{copy}</AppText>:null}
    </Card>:null}
  </View></ScreenScrollView>;
}
