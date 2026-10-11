import { normalizeCoreWithIntegrity } from '../src/data/sectionIntegrity';
import { packedBankRateSnapshots } from '../src/data/bankRateHistory';
import { bankRateScope } from '../src/data/bankRateOverview';
import type { CorePayload } from '../src/types';
import { canonical, hashText } from '../src/lib/productTermsEngine/validation';
test('wire bindings survive Savings quarantine and repeated normalization without changing source rows', () => {
 const raw = {run_date:'2026-09-22', sections:{Mortgage:{rates:[]},Savings:{rates:[
   {provider:'Bank',product_key:'td',product_name:'Term Deposit',rate:'0.09'},
   {provider:'Bank',product_key:'s',product_name:'Savings',rate:'0.02'},
 ]},TD:{rates:[]}},bank_rate_history:{schema_version:1,run_dates:['2026-09-21','2026-09-22'],
 row_tiers:{Mortgage:[],Savings:[0,1],TD:[]},sections:{Mortgage:[],Savings:[[[0,2,[9]]],[[0,2,[2]]]],TD:[]}}} as unknown as CorePayload;
 const core=normalizeCoreWithIntegrity(raw).core;
 expect(raw.sections.Savings.rates).toHaveLength(2);
 expect(raw.sections.Savings.rates[0].bank_rate_tier).toBeUndefined();
 expect(core.sections.Savings.rates[0].bank_rate_tier).toBe(1);
 // Contract/receipt hashes must still identify the exact published row.
 expect(Object.keys(core.sections.Savings.rates[0])).toEqual(Object.keys(raw.sections.Savings.rates[1]));
 expect(hashText(canonical(core.sections.Savings.rates[0]))).toBe(hashText(canonical(raw.sections.Savings.rates[1])));
 expect(JSON.stringify(core.sections.Savings.rates[0])).toBe(JSON.stringify(raw.sections.Savings.rates[1]));
 expect(normalizeCoreWithIntegrity(core).core).toBe(core);
 const snapshots=packedBankRateSnapshots(core,bankRateScope({Mortgage:[],Savings:core.sections.Savings.rates,TD:[]}));
 expect(snapshots['2026-09-21'].Savings!.Bank).toEqual({min:2,mean:2,median:2,max:2,count:1});
});
