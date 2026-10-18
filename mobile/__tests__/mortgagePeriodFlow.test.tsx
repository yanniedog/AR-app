import { MortgageResultDetails } from '../src/components/product/MortgagePeriodForm';
import React from 'react';
import mockReact from 'react';
import TestRenderer,{act} from 'react-test-renderer';
import { MortgagePeriodCalculation } from '../src/components/product/MortgagePeriodCalculation';
import { mortgageHarness } from '../test-support/mortgageHarness';
import { mortgageAnswerId } from '../src/data/mortgageContracts/facts';
import { profile } from '../test-support/executableDepositHarness';
import * as Clipboard from 'expo-clipboard';
let mockState:any,mockProfile:any;
jest.mock('../src/data/store',()=>({useStore:(selector:any)=>selector(mockState)}));
jest.mock('../src/data/payload',()=>({downloadInflate:jest.fn()}));
jest.mock('../src/hooks/useCustomerProfile',()=>({useCustomerProfile:()=>({profile:mockProfile,busy:false})}));
jest.mock('../src/components/CustomerProfilePanel',()=>({CustomerAnswerEditor:'CustomerAnswerEditor'}));
jest.mock('../src/components/ledger/LedgerField',()=>({LedgerField:'LedgerField'}));
jest.mock('../src/components/product/DepositCriteria',()=>({ReviewedCriteria:'ReviewedCriteria'}));
jest.mock('../src/components/ui',()=>({AppText:'AppText',Button:'Button',Chip:'Chip',Row:'Row',Disclosure:({children,open,...props}:any)=>mockReact.createElement('Disclosure',props,open?children:null)}));
jest.mock('expo-clipboard',()=>({setStringAsync:jest.fn(async()=>undefined)}));
test.each([false,true])('actual lazy mortgage flow preserves complete/incomplete records and invalidates edits (unpaid=%s)',async(unpaid)=>{
 const h=await mortgageHarness();mockState={...h.context,ensureDetails:jest.fn(async()=>undefined)};mockProfile={...profile,answers:{[mortgageAnswerId(h.subject,'adult')]:{state:'known',fact:{type:'boolean',value:true},provenance:{source:'user_input',recordedAt:null,productKey:h.target.productKey,effectiveFrom:null,effectiveToExclusive:null}}}};
 let tree:any;await act(async()=>{tree=TestRenderer.create(<MortgagePeriodCalculation productKey={h.target.productKey}/>);});expect(tree.root.findAllByProps({title:'Calculate Mortgage'})).toHaveLength(0);
 await act(async()=>tree.root.findByProps({title:'Mortgage · History'}).props.onToggle());act(()=>tree.root.findAllByType('Chip').find((n:any)=>n.props.label.includes(' / ')).props.onPress());
 for(const label of ['Principal (AUD)','Interest posted (AUD)','Interest unposted (AUD)','Capitalised charges (AUD)','Other debt (AUD)']) {
  const field=tree.root.findByProps({label});expect(field.props.placeholder).toBe('0');expect(field.props.value).toBe('');
 }
 for(const[label,value]of [['Local loan account reference','account'],['Local offer reference','offer'],['Offer version reference','version'],['Opening statement reference','opening'],['Confirmed annual rate (%)','3.65'],['Opening total debt (AUD)','1000'],['Principal (AUD)','1000'],['Interest posted (AUD)','0'],['Interest unposted (AUD)','0'],['Capitalised charges (AUD)','0'],['Other debt (AUD)','0'],['Confirmed monthly amount due (AUD)','30'],['Original monthly due date · YYYY-MM-DD',unpaid?'2023-12-01':'2023-12-15']])act(()=>tree.root.findByProps({label}).props.onChangeText(value));
 act(()=>tree.root.findByProps({label:'Interest posted (AUD)'}).props.onChangeText(''));
 for(const label of ['No arrears / default','No excluded movements','Payments complete','Confirmed'])act(()=>tree.root.findByProps({label}).props.onPress());
 act(()=>tree.root.findByProps({title:'Calculate Mortgage'}).props.onPress());expect(tree.root.findAllByProps({title:'Copy Receipt'})).toHaveLength(0);expect(JSON.stringify(tree.toJSON())).toContain('Unavailable');
 act(()=>tree.root.findByProps({label:'Interest posted (AUD)'}).props.onChangeText('0'));act(()=>tree.root.findByProps({label:'Confirmed'}).props.onPress());
 act(()=>tree.root.findByProps({title:'Calculate Mortgage'}).props.onPress());expect(JSON.stringify(tree.toJSON())).toContain('1000.100000000000');await act(async()=>tree.root.findByProps({title:'Copy Receipt'}).props.onPress());const r=JSON.parse((Clipboard.setStringAsync as jest.Mock).mock.calls.at(-1)[0]);expect(r.receipt.claimAvailable).toBe(!unpaid);if(unpaid){expect(JSON.stringify(tree.toJSON())).toContain('Partial');act(()=>tree.root.findByProps({title:'Debt / Interest / Fees'}).props.onToggle());expect(JSON.stringify(tree.toJSON())).toContain('0.100000000000');expect(JSON.stringify(tree.toJSON())).toContain('Known components');}expect(r.adapterInputs.inputs.accountId).toBe('account');
 act(()=>tree.root.findByProps({label:'Principal (AUD)'}).props.onChangeText('2000'));expect(tree.root.findAllByProps({title:'Copy Receipt'})).toHaveLength(0);
 mockState={...mockState,manifest:{...mockState.manifest}};delete mockState.manifest.executable_v3;await act(async()=>tree.update(<MortgagePeriodCalculation productKey={h.target.productKey}/>));expect(JSON.stringify(tree.toJSON())).toContain('Unavailable');
});
test('a savings rate cannot show the mortgage control',async()=>{mockState={manifest:null,core:null,details:null,coreIntegrity:null};let tree:any;await act(async()=>{tree=TestRenderer.create(<MortgagePeriodCalculation productKey="p" section="Savings" row={{product_key:'p'} as any}/>);});expect(tree.toJSON()).toBeNull();});

test.each([false,true])('incomplete debt presentation preserves known components and nulls (missing totals=%s)', missing => {
 const receipt:any={claimAvailable:false,loan:{outstandingDebt:null,knownComponentDebt:'970.100000000000',closing:{principal:'970.00',capitalizedCharges:'0.00'},principalRepaid:'30.00',interestPaid:'0.00',chargesPaid:'0.00'},totals:missing?null:{interestAccrued:'0.100000000000',feesPaidExternal:null}};
 let tree:any;act(()=>{tree=TestRenderer.create(<MortgageResultDetails receipt={receipt}/>);});
 expect(JSON.stringify(tree.toJSON())).toContain('Known components');
 act(()=>tree.root.findByProps({title:'Debt / Interest / Fees'}).props.onToggle());
 const rendered=JSON.stringify(tree.toJSON());expect(rendered).toContain('970.100000000000');expect(rendered).toContain('970.00');expect(rendered).toContain('Unknown');expect(rendered).not.toContain('Complete for');expect(rendered).not.toContain('best');
 expect(rendered).toContain(missing?'Interest accrued: ':'0.100000000000');
 const fees=tree.root.findAllByType('AppText').find((n:any)=>JSON.stringify(n.props.children).includes('Fees paid externally'));
 expect(JSON.stringify(fees.props.children)).toContain('Unknown');expect(JSON.stringify(fees.props.children)).not.toContain('0.00');
 act(()=>tree.unmount());
});
