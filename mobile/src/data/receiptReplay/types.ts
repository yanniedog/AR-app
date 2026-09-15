import type { CustomerAnswer } from '../customerProfile';
import type { SectionKey } from '../../types';
export type ReplayKind='td'|'td_comparison'|'eligibility_only'|'savings_calculation'|'mortgage_calculation'|'historical_savings_holdings'|'historical_mortgage_comparison';
export interface ReplayTarget {kind:'product'|'rate_variant';productKey:string;section?:SectionKey;coreRowIndex?:number;rateIndex?:number;rowSha256?:string;productRecordSha256?:string}
export interface ReplayItem {id:string;kind:'td'|'eligibility_only'|'savings_calculation'|'mortgage_calculation';sourceId:string;edition:string;target:ReplayTarget;inputs:any;answers:Record<string,CustomerAnswer>}
export interface ReplayDocument {kind:ReplayKind|'legacy';digest:string;original:unknown;items:ReplayItem[];frame?:any;viewOnlyReason?:string}
