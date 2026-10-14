import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const { inspectUiCopy } = require('./check-ui-copy.cjs');

const globals = `
interface Object {} interface Function {} interface CallableFunction {} interface NewableFunction {}
interface IArguments { length:number; [index:number]:unknown; }
interface Boolean {} interface Number {} interface String {} interface RegExp {}
interface Array<T> { length:number; [index:number]:T; }
interface ReadonlyArray<T> { readonly length:number; readonly [index:number]:T; }
interface TemplateStringsArray extends ReadonlyArray<string> { readonly raw:readonly string[]; }
interface PromiseLike<T> { then<R>(callback:(value:T)=>R|PromiseLike<R>):PromiseLike<R>; }
interface Promise<T> { then<R>(callback:(value:T)=>R|PromiseLike<R>):Promise<R>; }
declare const Promise: { new<T>(executor:(resolve:(value:T)=>void,reject:(error:unknown)=>void)=>void):Promise<T>; };
declare const JSON: { stringify(value:unknown,replacer:null,space:number):string; };
declare namespace JSX { interface Element {} interface IntrinsicElements { [tag:string]:any; } }
`;
const policy = `
export const UI_LABELS = ['Save', 'Debug log', 'Rates', 'Rate', 'Unknown', '&', '"Rate"', '<Rate>', '<'] as const;
export type UiLabel = typeof UI_LABELS[number];
export type UiText = string & {readonly __uiText:unique symbol};
export type UiInputText = string & {readonly __uiInputText:unique symbol};
export type UiMarkup = string & {readonly __uiMarkup:unique symbol};
export type UiCopy = UiLabel|UiText;
export type LegalDocumentId = 'general'|'licence';
export declare function uiLabel(value:UiLabel):UiLabel;
export declare function uiCount(value:number):UiText;
export declare function uiMarkup(strings:TemplateStringsArray,...parts:readonly UiMarkup[]):UiMarkup;
export declare function uiMarkupEscape(value:UiCopy):UiMarkup;
export declare function uiMarkupJoin(parts:readonly UiMarkup[]):UiMarkup;
export function legalDocumentText(document:LegalDocumentId,index?:number):string { return 'Required legal document content.'; }
`;
const debugSource = `
export declare const debugLog: {
  readCompleteText():Promise<string>;
  getDisplayText():string;
  subscribe(listener:()=>void):()=>void;
};
export declare function formatVersionedLogExport(log:string,version:string,build:string,context:{},options:{fullEvidence:boolean}):string;
`;
const readEvidence = `
export async function readVersionedDebugEvidence(fullEvidence = false):Promise<string> {
  const completeLog = await debugLog.readCompleteText();
  return formatVersionedLogExport(completeLog, Application.nativeApplicationVersion ?? 'unknown', Application.nativeBuildVersion ?? 'unknown', {}, { fullEvidence });
}
`;
const shareEvidence = `
export async function shareVersionedDebugEvidence(fullEvidence = false):Promise<void> {
  await Share.share({message:await readVersionedDebugEvidence(fullEvidence),title:uiLabel('Debug log')});
}
`;
const evidenceImports = `import * as Application from 'expo-application'; import {Share} from 'react-native';
import {debugLog,formatVersionedLogExport} from './debugLog'; import {uiLabel} from './uiCopy';`;
const rendererImports = `import {Text} from 'react-native';`;
const legalRenderer = `${rendererImports}
import {legalDocumentText,type LegalDocumentId} from '../lib/uiCopy';
export function DocumentText({document,index}:{document:LegalDocumentId;index?:number}) {
  return <Text>{legalDocumentText(document,index)}</Text>;
}`;
const auditRenderer = `${rendererImports}
import type {PerformanceAuditReport} from '../lib/performanceAudit';
export function AuditEvidenceText({report}:{report:PerformanceAuditReport}) {
  return <Text>{JSON.stringify(report,null,2)}</Text>;
}`;
const receiptRenderer = `${rendererImports}
import type {ReplayDocument} from '../data/receiptReplay/types';
export function ReceiptEvidenceText({document}:{document:ReplayDocument}) {
  return <Text>{JSON.stringify(document.original,null,2)}</Text>;
}`;
const debugRenderer = `${rendererImports}
import {useSyncExternalStore} from 'react'; import {debugLog} from '../lib/debugLog';
export function DebugEvidenceText() {
  const text = useSyncExternalStore(debugLog.subscribe,debugLog.getDisplayText,debugLog.getDisplayText);
  return <Text>{text}</Text>;
}`;
const reportContract = `import type {UiCopy,UiLabel} from './uiCopy';
export interface ReportSheet {name:UiLabel;rows:UiCopy[][];}`;
const reportMarkup = `import type {UiCopy} from './uiCopy';
declare function escapeMarkup(value:string):string;
export function escapeReportMarkup(value:UiCopy):string {return escapeMarkup(value);}`;

/** Every scenario gets isolated virtual modules at the guard's real relative paths. */
function inspectFixture(name, sources) {
  const root = path.resolve(process.cwd(), '.ui-copy-boundaries', name);
  const files = new Map(Object.entries({
    'globals.d.ts': globals,
    'src/lib/uiCopy.ts': policy,
    'src/lib/debugLog.ts': debugSource,
    'src/lib/performanceAudit.ts': `export interface PerformanceAuditReport {schemaVersion:1;records:readonly {id:string;reason:string}[];}`,
    'src/data/receiptReplay/types.ts': `export interface ReplayDocument {digest:string;original:unknown;}`,
    'src/lib/searchReportTables.ts': reportContract,
    'src/lib/searchReportWorkbook.ts': reportMarkup,
    'node_modules/@types/react/index.d.ts': `export interface ReactElement {type:any;props:any;key:string|null;}
export declare function useSyncExternalStore<T>(subscribe:(listener:()=>void)=>()=>void,getSnapshot:()=>T,getServerSnapshot?:()=>T):T;`,
    'node_modules/react-native/index.d.ts': `export declare function Text(props:any):import('react').ReactElement;
export declare const Share:{share(content:{message:string;title?:string}):Promise<void>};`,
    'node_modules/expo-application/index.d.ts': `export declare const nativeApplicationVersion:string|null; export declare const nativeBuildVersion:string|null;`,
    'node_modules/expo-print/index.d.ts': `export declare function printToFileAsync(options:{html:string}):Promise<{uri:string}>;`,
    ...sources,
  }).map(([relative, source]) => [path.resolve(root, relative), source]));
  const options = {strict:true,noLib:true,types:[],jsx:ts.JsxEmit.Preserve,target:ts.ScriptTarget.ES2020};
  const host = ts.createCompilerHost(options);
  host.fileExists = filename => files.has(path.resolve(filename));
  host.readFile = filename => files.get(path.resolve(filename));
  host.getSourceFile = (filename, version) => {
    const source = files.get(path.resolve(filename));
    return source === undefined ? undefined : ts.createSourceFile(filename, source, version, true);
  };
  host.resolveModuleNames = (names, containingFile) => names.map(module => {
    const base = module.startsWith('.') ? path.resolve(path.dirname(containingFile),module)
      : path.join(root,module==='react'?'node_modules/@types/react/index':'node_modules',module==='react'?'':module);
    const candidates = module.startsWith('.') ? [base,`${base}.ts`,`${base}.tsx`,`${base}.d.ts`]
      : module==='react'?[`${base}.d.ts`]:[path.join(base,'index.d.ts')];
    const filename = candidates.find(candidate => files.has(path.resolve(candidate)));
    return filename ? {resolvedFileName:filename,extension:filename.endsWith('.tsx')?ts.Extension.Tsx:filename.endsWith('.d.ts')?ts.Extension.Dts:ts.Extension.Ts} : undefined;
  });
  const program = ts.createProgram([...files.keys()],options,host);
  return {issues:inspectUiCopy({root,program,ts}),diagnostics:ts.getPreEmitDiagnostics(program)};
}

function permitted(name, sources) {
  test(name, () => {
    const {issues,diagnostics} = inspectFixture(name,sources);
    assert.deepEqual(diagnostics.map(issue => ts.flattenDiagnosticMessageText(issue.messageText,' ')),[], 'permitted fixture must be a valid typed program');
    assert.deepEqual(issues,[], 'genuine boundary must admit only its own source');
  });
}
function rejected(name, sources, targetFile, code) {
  test(name, () => {
    const {issues} = inspectFixture(name,sources);
    assert.ok(issues.some(issue => issue.file===targetFile && (!code||issue.code===code)),
      `${name} escaped its boundary: ${JSON.stringify(issues)}`);
  });
}

permitted('legal-fixed-registry', {'src/components/DocumentText.tsx':legalRenderer});
rejected('legal-arbitrary-factory', {'src/components/DocumentText.tsx':`${rendererImports} declare function providerBody():string; <Text>{providerBody()}</Text>`},'src/components/DocumentText.tsx');
rejected('legal-local-lookalike', {'src/components/DocumentText.tsx':`${rendererImports} declare function legalDocumentText():string; <Text>{legalDocumentText()}</Text>`},'src/components/DocumentText.tsx');
rejected('legal-imported-lookalike', {'src/lib/fakeLegal.ts':`export declare function legalDocumentText():string;`,'src/components/DocumentText.tsx':`${rendererImports} import {legalDocumentText} from '../lib/fakeLegal'; <Text>{legalDocumentText()}</Text>`},'src/components/DocumentText.tsx');
rejected('legal-outside-renderer', {'app/legal.tsx':`${rendererImports} import {legalDocumentText} from '../src/lib/uiCopy'; <Text>{legalDocumentText('general')}</Text>`},'app/legal.tsx');
rejected('legal-no-whole-file-exemption', {'src/components/DocumentText.tsx':legalRenderer+`declare const raw:string; <Text>{raw}</Text>`},'src/components/DocumentText.tsx');

permitted('native-debug-source', {'src/lib/debugEvidence.ts':evidenceImports+readEvidence+shareEvidence});
const nativeRejected = (name, source) => rejected(name,{'src/lib/debugEvidence.ts':source},'src/lib/debugEvidence.ts');
nativeRejected('native-debug-wrong-first-argument',evidenceImports+`declare const raw:string;`+readEvidence.replace('formatVersionedLogExport(completeLog,','formatVersionedLogExport(raw,')+shareEvidence);
nativeRejected('native-debug-ignored-read',evidenceImports+`declare const raw:string;`+readEvidence.replace('const completeLog = await debugLog.readCompleteText();','const ignored = await debugLog.readCompleteText(); const completeLog = raw;')+shareEvidence);
nativeRejected('native-debug-string-read-parameter',evidenceImports+readEvidence.replace('fullEvidence = false','fullEvidence:string = \'raw\'')+shareEvidence.replace('readVersionedDebugEvidence(fullEvidence)','readVersionedDebugEvidence(\'raw\')'));
nativeRejected('native-debug-extra-read-string-parameter',evidenceImports+readEvidence.replace('fullEvidence = false','fullEvidence = false, message:string = \'raw\'')+shareEvidence);
nativeRejected('native-debug-extra-share-string-parameter',evidenceImports+readEvidence+shareEvidence.replace('fullEvidence = false','fullEvidence = false, message:string = \'raw\''));
nativeRejected('native-debug-fake-log-source',evidenceImports.replace('debugLog,formatVersionedLogExport','formatVersionedLogExport')+`declare const debugLog:{readCompleteText():Promise<string>};`+readEvidence+shareEvidence);
nativeRejected('native-debug-fake-formatter',evidenceImports.replace('debugLog,formatVersionedLogExport','debugLog')+`declare function formatVersionedLogExport(log:string,version:string,build:string,context:{},options:{fullEvidence:boolean}):string;`+readEvidence+shareEvidence);
nativeRejected('native-debug-fake-installed-metadata',evidenceImports.replace("import * as Application from 'expo-application';",`declare const Application:{nativeApplicationVersion:string|null;nativeBuildVersion:string|null};`)+readEvidence+shareEvidence);
nativeRejected('native-debug-wrong-installed-version',evidenceImports+readEvidence.replace("Application.nativeApplicationVersion ?? 'unknown'","'invented-version'")+shareEvidence);
nativeRejected('native-debug-wrong-installed-build',evidenceImports+readEvidence.replace("Application.nativeBuildVersion ?? 'unknown'","'invented-build'")+shareEvidence);
nativeRejected('native-debug-arbitrary-context',evidenceImports+`declare const raw:string;`+readEvidence.replace('{}, { fullEvidence }','{raw}, { fullEvidence }')+shareEvidence);
nativeRejected('native-debug-any-read-parameter',evidenceImports+readEvidence.replace('fullEvidence = false','fullEvidence:any = false')+shareEvidence);
rejected('native-debug-outside-export-module',{'src/lib/debugEvidence.ts':evidenceImports+readEvidence+shareEvidence,'app/share.tsx':`import {Share} from 'react-native'; import {readVersionedDebugEvidence} from '../src/lib/debugEvidence'; async function share(){await Share.share({message:await readVersionedDebugEvidence(true)});}`},'app/share.tsx');

permitted('audit-actual-model',{'src/components/AuditEvidenceText.tsx':auditRenderer});
rejected('audit-local-same-name-model',{'src/components/AuditEvidenceText.tsx':auditRenderer.replace("import type {PerformanceAuditReport} from '../lib/performanceAudit';",`interface PerformanceAuditReport {reason:string;}`)},'src/components/AuditEvidenceText.tsx');
rejected('audit-imported-same-name-model',{'src/lib/fakeModels.ts':`export interface PerformanceAuditReport {reason:string;}`,'src/components/AuditEvidenceText.tsx':auditRenderer.replace("'../lib/performanceAudit'","'../lib/fakeModels'")},'src/components/AuditEvidenceText.tsx');
rejected('audit-outside-renderer',{'app/audit.tsx':auditRenderer.replace("'../lib/performanceAudit'","'../src/lib/performanceAudit'")},'app/audit.tsx');
rejected('audit-arbitrary-prop',{'src/components/AuditEvidenceText.tsx':`${rendererImports} export function AuditEvidenceText({report}:{report:string}){return <Text>{JSON.stringify(report,null,2)}</Text>;}`},'src/components/AuditEvidenceText.tsx');
rejected('audit-no-whole-file-exemption',{'src/components/AuditEvidenceText.tsx':auditRenderer+`declare const raw:string; <Text>{raw}</Text>`},'src/components/AuditEvidenceText.tsx');

permitted('receipt-actual-model',{'src/components/ReceiptEvidenceText.tsx':receiptRenderer});
rejected('receipt-local-same-name-model',{'src/components/ReceiptEvidenceText.tsx':receiptRenderer.replace("import type {ReplayDocument} from '../data/receiptReplay/types';",`interface ReplayDocument {original:unknown;}`)},'src/components/ReceiptEvidenceText.tsx');
rejected('receipt-imported-same-name-model',{'src/data/fakeModels.ts':`export interface ReplayDocument {original:unknown;}`,'src/components/ReceiptEvidenceText.tsx':receiptRenderer.replace("'../data/receiptReplay/types'","'../data/fakeModels'")},'src/components/ReceiptEvidenceText.tsx');
rejected('receipt-outside-renderer',{'app/receipt.tsx':receiptRenderer.replace("'../data/receiptReplay/types'","'../src/data/receiptReplay/types'")},'app/receipt.tsx');
rejected('receipt-wrong-serializer-object',{'src/components/ReceiptEvidenceText.tsx':receiptRenderer.replace('JSON.stringify(document.original,null,2)','JSON.stringify(document,null,2)')},'src/components/ReceiptEvidenceText.tsx');
rejected('receipt-no-whole-file-exemption',{'src/components/ReceiptEvidenceText.tsx':receiptRenderer+`declare const raw:string; <Text>{raw}</Text>`},'src/components/ReceiptEvidenceText.tsx');

permitted('debug-renderer-actual-hook-source',{'src/components/DebugEvidenceText.tsx':debugRenderer});
rejected('debug-renderer-local-fake-hook',{'src/components/DebugEvidenceText.tsx':debugRenderer.replace("import {useSyncExternalStore} from 'react';",`declare function useSyncExternalStore(subscribe:unknown,snapshot:()=>string,server:()=>string):string;`)},'src/components/DebugEvidenceText.tsx');
rejected('debug-renderer-imported-fake-hook',{'src/lib/fakeReact.ts':`export declare function useSyncExternalStore(subscribe:unknown,snapshot:()=>string,server:()=>string):string;`,'src/components/DebugEvidenceText.tsx':debugRenderer.replace("'react'","'../lib/fakeReact'")},'src/components/DebugEvidenceText.tsx');
rejected('debug-renderer-fake-log-source',{'src/components/DebugEvidenceText.tsx':debugRenderer.replace("import {debugLog} from '../lib/debugLog';",`declare const debugLog:{subscribe(listener:()=>void):()=>void;getDisplayText():string;};`)},'src/components/DebugEvidenceText.tsx');
rejected('debug-renderer-raw-text-prop',{'src/components/DebugEvidenceText.tsx':`${rendererImports} export function DebugEvidenceText({text}:{text:string}){return <Text>{text}</Text>;}`},'src/components/DebugEvidenceText.tsx');
rejected('debug-renderer-outside-component',{'app/log.tsx':debugRenderer.replace("'../lib/debugLog'","'../src/lib/debugLog'")},'app/log.tsx');
rejected('debug-renderer-no-whole-file-exemption',{'src/components/DebugEvidenceText.tsx':debugRenderer+`declare const raw:string; <Text>{raw}</Text>`},'src/components/DebugEvidenceText.tsx');

const reportImports = `import type {ReportSheet} from './searchReportTables'; import {escapeReportMarkup} from './searchReportWorkbook'; import {uiCount,type UiCopy} from './uiCopy';`;
permitted('report-closed-contract',{'src/lib/reportConsumer.ts':reportImports+`export const sheet:ReportSheet={name:'Rates',rows:[['Rate',uiCount(2)]]}; export const encoded=escapeReportMarkup(sheet.rows[0][1]);`});
const reportRejected = (name, body) => rejected(name,{'src/lib/reportConsumer.ts':reportImports+body},'src/lib/reportConsumer.ts');
reportRejected('report-raw-sheet-name',`declare const raw:string; export const sheet:ReportSheet={name:raw,rows:[['Rate']]};`);
reportRejected('report-any-sheet-name',`declare const raw:any; export const sheet:ReportSheet={name:raw,rows:[['Rate']]};`);
reportRejected('report-raw-cell',`declare const raw:string; export const sheet:ReportSheet={name:'Rates',rows:[[raw]]};`);
reportRejected('report-any-cell',`declare const raw:any; export const sheet:ReportSheet={name:'Rates',rows:[[raw]]};`);
reportRejected('report-any-rows',`declare const raw:any; export const sheet:ReportSheet={name:'Rates',rows:raw};`);
reportRejected('report-any-factory-return',`declare const raw:any; export function sheets():ReportSheet[]{return raw;}`);
reportRejected('report-forged-contract',`declare const raw:unknown; export const sheet=raw as ReportSheet;`);
reportRejected('report-escape-raw-input',`declare const raw:string; export const encoded=escapeReportMarkup(raw);`);
reportRejected('report-escape-any-input',`declare const raw:any; export const encoded=escapeReportMarkup(raw);`);
reportRejected('report-escape-forged-input',`declare const raw:string; export const encoded=escapeReportMarkup(raw as UiCopy);`);
rejected('report-markup-not-ui-text',{'app/report.tsx':`${rendererImports} import {escapeReportMarkup} from '../src/lib/searchReportWorkbook'; import {uiCount} from '../src/lib/uiCopy'; <Text>{escapeReportMarkup(uiCount(1))}</Text>`},'app/report.tsx');

const htmlImports = `import {uiMarkup,uiMarkupEscape,uiMarkupJoin,uiLabel,uiCount,type UiMarkup,type UiCopy} from './uiCopy'; import * as Print from 'expo-print';`;
const htmlSource = body => ({'src/lib/htmlConsumer.ts':htmlImports+body});
const htmlRejected = (name, body) => rejected(name,htmlSource(body),'src/lib/htmlConsumer.ts');

permitted('html-tagged-escaped-cell',htmlSource('export const html=uiMarkup`<!DOCTYPE html><html><head><style>td{padding:8px;color:#123}</style></head><body><table><tr><th>Rate</th><td>${uiMarkupEscape(uiCount(3))}</td></tr></table></body></html>`;'));
permitted('html-typed-fragments-join',htmlSource('const cells=uiMarkupJoin([uiMarkup`<td>${uiMarkupEscape(uiCount(3))}</td>`,uiMarkup`<td>Unknown</td>`]); export const html=uiMarkup`<table><tr>${cells}</tr></table>`;'));
permitted('html-reviewed-attributes',htmlSource('export const html=uiMarkup`<div title="Rates" aria-label="Rate"><img alt="Unknown"/></div>`;'));
permitted('html-native-typed-print',htmlSource('const html=uiMarkup`<table><tr><td>${uiMarkupEscape(uiCount(4))}</td></tr></table>`; export async function print(){await Print.printToFileAsync({html});}'));

htmlRejected('html-static-paragraph','export const html=uiMarkup`<p>This paragraph explains how to use the chart.</p>`;');
htmlRejected('html-raw-interpolation','declare const raw:string; export const html=uiMarkup`<td>${raw}</td>`;');
htmlRejected('html-any-interpolation','declare const raw:any; export const html=uiMarkup`<td>${raw}</td>`;');
htmlRejected('html-unescaped-factual-interpolation','export const html=uiMarkup`<td>${uiCount(3)}</td>`;');
htmlRejected('html-ordinary-array-invocation',"export const html=uiMarkup(['<p>An explanatory sentence.</p>']);");
htmlRejected('html-ordinary-typed-array-invocation',"declare const chunks:TemplateStringsArray; export const html=uiMarkup(chunks,uiMarkupEscape(uiCount(3)));");
htmlRejected('html-forged-string-markup',"declare const raw:string; export const html=raw as UiMarkup;");
htmlRejected('html-forged-any-markup',"declare const raw:any; export const html=raw as UiMarkup;");
htmlRejected('html-any-markup-assignment',"declare const raw:any; export const html:UiMarkup=raw;");
htmlRejected('html-raw-markup-factory',"declare const raw:any; export function markup():UiMarkup{return raw;}");
htmlRejected('html-any-joined-fragments',"declare const raw:any; export const html=uiMarkupJoin([raw]);");
htmlRejected('html-raw-escaped-input',"declare const raw:string; export const html=uiMarkupEscape(raw);");
htmlRejected('html-any-escaped-input',"declare const raw:any; export const html=uiMarkupEscape(raw);");
htmlRejected('html-explanatory-title','export const html=uiMarkup`<div title="Open this to learn how the chart works."></div>`;');
htmlRejected('html-explanatory-alt','export const html=uiMarkup`<img alt="This image explains how to compare your rate."/>`;');
htmlRejected('html-explanatory-aria-label','export const html=uiMarkup`<div aria-label="Tap here to open the detailed comparison."></div>`;');
htmlRejected('html-aria-description-always-removed','export const html=uiMarkup`<div aria-description="Rate"></div>`;');
htmlRejected('html-accessibility-hint-always-removed','export const html=uiMarkup`<div accessibilityHint="Rate"></div>`;');
htmlRejected('html-css-explanatory-content','export const html=uiMarkup`<style>td::before{content:"This describes the results below."}</style><table></table>`;');
htmlRejected('html-inline-css-explanatory-content','export const html=uiMarkup`<div style="content:\'This describes the chart.\'"></div>`;');
htmlRejected('html-native-raw-paragraph',"export async function print(){await Print.printToFileAsync({html:'<p>This explains the selected rate.</p>'});}");
htmlRejected('html-native-raw-closed-literal',"export async function print(){await Print.printToFileAsync({html:'<td>Rate</td>'});}");
htmlRejected('html-native-any-payload',"declare const raw:any; export async function print(){await Print.printToFileAsync({html:raw});}");
htmlRejected('html-native-copy-is-not-markup',"export async function print(){await Print.printToFileAsync({html:uiLabel('Rate')});}");
htmlRejected('html-native-raw-alias',"const invoke=Print.printToFileAsync; declare const raw:string; export async function print(){await invoke({html:raw});}");
rejected('html-fake-same-name-brand',{'src/lib/fakeMarkup.ts':`export type UiMarkup=string & {readonly __uiMarkup:unique symbol}; export declare const markup:UiMarkup;`,'src/lib/htmlConsumer.ts':`import * as Print from 'expo-print'; import {markup} from './fakeMarkup'; export async function print(){await Print.printToFileAsync({html:markup});}`},'src/lib/htmlConsumer.ts');
rejected('html-markup-not-normal-text',{'app/markup.tsx':`${rendererImports} import {uiMarkup,uiMarkupEscape,uiCount} from '../src/lib/uiCopy'; const html=uiMarkup\`<td>\${uiMarkupEscape(uiCount(3))}</td>\`; <Text>{html}</Text>`},'app/markup.tsx');

permitted('html-genuine-import-variable-alias',{'src/lib/htmlConsumer.ts':'import {uiMarkup as Markup,uiMarkupEscape as escape,uiCount} from "./uiCopy"; const alias=Markup; export const html=alias`<td>${escape(uiCount(3))}</td>`;'});
permitted('html-native-genuine-identifier-alias',htmlSource('const html=uiMarkup`<td>${uiMarkupEscape(uiCount(3))}</td>`; const original=Print.printToFileAsync; const invoke=original; export async function print(){await invoke({html});}'));
htmlRejected('html-tagged-variable-alias-prose','const original=uiMarkup; const alias=original; export const html=alias`<p>This explains how to read the display.</p>`;');
rejected('html-tagged-import-alias-prose',{'src/lib/htmlConsumer.ts':'import {uiMarkup as Markup} from "./uiCopy"; export const html=Markup`<p>This explains how to read the display.</p>`;'},'src/lib/htmlConsumer.ts');
htmlRejected('html-tagged-bound-alias-prose','const bound=uiMarkup.bind(undefined); const alias=bound; export const html=alias`<p>This explains how to read the display.</p>`;');
htmlRejected('html-ordinary-variable-alias-construction','const original=uiMarkup; const alias=original; declare const chunks:TemplateStringsArray; export const html=alias(chunks);');
rejected('html-ordinary-import-alias-construction',{'src/lib/htmlConsumer.ts':'import {uiMarkup as Markup} from "./uiCopy"; declare const chunks:TemplateStringsArray; export const html=Markup(chunks);'},'src/lib/htmlConsumer.ts');
htmlRejected('html-ordinary-bound-construction','const bound=uiMarkup.bind(undefined); declare const chunks:TemplateStringsArray; export const html=bound(chunks);');
htmlRejected('html-native-raw-identifier-chain','const original=Print.printToFileAsync; const invoke=original; declare const raw:string; export async function print(){await invoke({html:raw});}');
rejected('html-native-raw-import-alias',{'src/lib/htmlConsumer.ts':'import {printToFileAsync as print} from "expo-print"; declare const raw:string; export async function exportFile(){await print({html:raw});}'},'src/lib/htmlConsumer.ts');
htmlRejected('html-native-raw-bound-alias','const bound=Print.printToFileAsync.bind(undefined); const invoke=bound; declare const raw:string; export async function print(){await invoke({html:raw});}');

permitted('html-complete-comment-token',htmlSource('export const html=uiMarkup`<td><!-- non-rendered evidence note -->Rate</td>`;'));
permitted('html-boolean-attribute-token',htmlSource('export const html=uiMarkup`<input disabled title="Rate"/>`;'));
permitted('html-one-pass-amp-entity',htmlSource('export const html=uiMarkup`<td>&amp;</td>`;'));
permitted('html-one-pass-quote-entity',htmlSource('export const html=uiMarkup`<td>&quot;Rate&quot;</td>`;'));
permitted('html-one-pass-angle-entities',htmlSource('export const html=uiMarkup`<td>&lt;Rate&gt;</td>`;'));
permitted('html-one-pass-numeric-entities',htmlSource('export const html=uiMarkup`<td>&#82;&#97;&#116;&#101;</td>`;'));
permitted('html-one-pass-attribute-entity',htmlSource('export const html=uiMarkup`<td title="&quot;Rate&quot;"></td>`;'));
permitted('html-reviewed-css-content',htmlSource('export const html=uiMarkup`<style>td::before{content:"Rate"}</style><table></table>`;'));
permitted('html-one-pass-inline-css-attribute',htmlSource('export const html=uiMarkup`<div style=\'content:&quot;Rate&quot;\'></div>`;'));
htmlRejected('html-nested-style-tokens','export const html=uiMarkup`<style><style>td{color:red}</style></style>`;');
htmlRejected('html-nested-tag-looking-style','export const html=uiMarkup`<<style>td{color:red}</style>`;');
htmlRejected('html-nested-tag-looking-comment','export const html=uiMarkup`<<!-- non-rendered evidence note -->`;');
htmlRejected('html-nested-comment-token','export const html=uiMarkup`<!-- outer <!-- inner --> -->`;');
htmlRejected('html-unterminated-comment-token','export const html=uiMarkup`<!-- missing terminator`;');
htmlRejected('html-unterminated-style-token','export const html=uiMarkup`<style>td{color:red}`;');
htmlRejected('html-interrupted-style-token','export const html=uiMarkup`<style>${uiMarkupEscape(uiLabel("Rate"))}</style>`;');
htmlRejected('html-interrupted-comment-token','export const html=uiMarkup`<!-- ${uiMarkupEscape(uiLabel("Rate"))} -->`;');
htmlRejected('html-interrupted-tag-token','export const html=uiMarkup`<td title="${uiMarkupEscape(uiLabel("Rate"))}"></td>`;');
htmlRejected('html-malformed-tag-attribute','export const html=uiMarkup`<td class="<style>td{color:red}</style>"></td>`;');
htmlRejected('html-malformed-closing-tag','export const html=uiMarkup`<td>Rate</td class="row">`;');
htmlRejected('html-malformed-doctype','export const html=uiMarkup`<!DOCTYPE html <style>td{color:red}</style>>`;');
htmlRejected('html-unquoted-explanatory-attribute','export const html=uiMarkup`<td title=Explanation></td>`;');
htmlRejected('html-incomplete-css-string','export const html=uiMarkup`<style>td{content:"Rate}</style>`;');
htmlRejected('html-css-concatenated-content','export const html=uiMarkup`<style>td{content:"Rate" "Unknown"}</style>`;');
htmlRejected('html-css-dynamic-content','export const html=uiMarkup`<style>td{content:attr(data-label)}</style><td data-label="Explanatory sentence."></td>`;');
htmlRejected('html-css-escaped-property','export const html=uiMarkup`<style>td{co\\\\6e tent:"Explanatory sentence."}</style>`;');
htmlRejected('html-script-token','export const html=uiMarkup`<script></script>`;');
htmlRejected('html-case-insensitive-script-token','export const html=uiMarkup`<ScRiPt></ScRiPt>`;');
htmlRejected('html-nested-quote-entities','export const html=uiMarkup`<td>&amp;quot;Rate&amp;quot;</td>`;');
htmlRejected('html-nested-attribute-entities','export const html=uiMarkup`<td title="&amp;quot;Rate&amp;quot;"></td>`;');
htmlRejected('html-nested-inline-css-entities','export const html=uiMarkup`<div style=\'content:&amp;quot;Rate&amp;quot;\'></div>`;');
htmlRejected('html-entity-cannot-cross-tag-token','export const html=uiMarkup`<td>&l<span></span>t;</td>`;');
htmlRejected('html-static-literal-budget','export const html=uiMarkup`'+ ' '.repeat(1024*1024+1)+'`;');
