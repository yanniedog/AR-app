import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const assert = require('node:assert/strict');
const path = require('node:path');

const { inspectUiCopy } = require('./check-ui-copy.cjs');
const ts = require('typescript');
const root = path.resolve(process.cwd(), '.ui-copy-virtual-fixture');
const declarations = path.join(root, 'node_modules/react-native/index.d.ts');
const policy = path.join(root, 'src/lib/uiCopy.ts');
const cases = {
  controlled: `<Text>Save</Text>`,
  rawLiteral: `<Text>Tap here to find better products.</Text>`,
  rawDynamic: `declare const remote: string; <Text>{remote}</Text>`,
  helper: `<Text accessibilityHint="Save" />`,
  nativeAlert: `Alert.alert('Save', 'This explains the next step.');`,
  alertAlias: `const invoke = Alert.alert; invoke('Save', 'This explains the next step.');`,
  alertButtons: `const buttons = [{text: 'An explanatory action sentence', onPress: () => {}}]; Alert.alert('Save', undefined, buttons);`,
  nativeSpread: `const unsafe = { message: 'Explanatory shared text.' }; Share.share({...unsafe});`,
  notificationAlias: `const send = scheduleNotificationAsync; const body = 'Explanatory notification sentence.'; send({content: { title: 'Save', body }});`,
  forgedBrand: `declare const remote: string; <Text>{remote as UiText}</Text>`,
  forgedLabel: `declare const remote: string; <Text>{remote as 'Save'}</Text>`,
  forgedProps: `declare const remote: string; const props = { children: remote } as {children:UiText}; <Text {...props} />`,
  rawTypedProps: `declare const remote: any; const props: {children:UiText} = {children:remote}; <Text {...props} />`,
  nestedSpread: `const props = {title:'Save', body:'Explanatory notification sentence.'}; scheduleNotificationAsync({content:{...props}});`,
  nativeBound: `const invoke = Alert.alert.bind(Alert); invoke('Save', 'Explanatory bound dialog sentence.');`,
  scalarInput: `<TextInput value="Explanatory input sentence." />`,
  anyAssignment: `declare const remote: any; const value: UiText = remote; <Text>{value}</Text>`,
  wrapperReturn: `declare const remote: any; function wrapper(): UiText { return remote; } <Text>{wrapper()}</Text>`,
  unionAnyAssignment: `declare const remote: any; const value: UiCopy = remote; <Text>{value}</Text>`,
  unionAnyReturn: `declare const remote: any; function wrapper(): UiCopy { return remote; } <Text>{wrapper()}</Text>`,
  promiseCast: `declare const remote: Promise<string>; const result = remote as Promise<UiText>; result.then(value => <Text>{value}</Text>);`,
  unknownObjectCast: `declare const remote: unknown; const result = remote as {value:UiText}; <Text>{result.value}</Text>`,
  jsxSpread: `declare const props: any; <Text {...props} />`,
  textInput: `declare const remote: string; <TextInput value={remote} />`,
  createElement: `make(Text, { children: 'Explanatory element sentence.' });`,
  controlledNative: `Alert.alert('Save', undefined, [{text: 'Cancel'}]);`,
  controlledBrand: `declare const identity: UiText; <Text>{identity}</Text>`,
  textAlias: `const Paragraph = Text; declare const remote: string; <Paragraph>{remote}</Paragraph>`,
  literalUnionCast: `declare const remote: string; <Text>{remote as 'Save'|'Cancel'}</Text>`,
  literalUnionAny: `declare const remote: any; const value: 'Save'|'Cancel' = remote; <Text>{value}</Text>`,
  forgedNever: `declare const remote: string; <Text>{remote as never}</Text>`,
  inputToBody: `declare const input: UiInputText; <Text>{input}</Text>`,
  controlledInput: `declare const input: UiInputText; <TextInput value={input}/>`,
  forgedInput: `declare const remote: string; <TextInput value={remote as UiInputText}/>`,
  rawFragment: `declare const remote: string; <>{remote}</>`,
  rawHeading: `declare const remote: string; <h1>{remote}</h1>`,
  nativeHeader: `declare const remote: string; <Text options={{headerTitle:remote}}/>`,
  nativeTab: `<Text screenOptions={{tabBarLabel:'Tap here to explore our app.'}}/>`,
  forgedElement: `declare const remote: string; <Text>{remote as ReactElement}</Text>`,
  forgedElementReturn: `declare const remote: any; function fake(): ReactElement { return remote; } <Text>{fake()}</Text>`,
  forgedElementAlias: `interface ReactElement {props:any;} declare const remote:string; <Text>{remote as ReactElement}</Text>`,
  forgedOptionalDto: `declare const remote:any; const data: {value?:UiText} = {value:remote}; <Text>{data.value}</Text>`,
  rawAccessibilityValue: `declare const remote:string; <Text accessibilityValue={{text:remote}}/>`,
  rawAccessibilitySpread: `declare const remote:string; const props={accessibilityValue:{text:remote}}; <Text {...props}/>`,
  controlledNullableDto: `declare const identity:UiText; const data:{value:UiCopy}|null={value:identity}; <Text>{data.value}</Text>`,
  controlledUnionDto: `declare const identity:UiCopy; const data:{value:UiCopy}={value:identity}; <Text>{data.value}</Text>`,
  controlledOptionalDto: `const data:{value?:UiText}={}; <Text>{data.value}</Text>`,
  controlledLiteralProp: `<Text accessibilityLabel="Save"/>`,
  controlledAccessibilityValue: `declare const identity:UiCopy; const props={accessibilityValue:{min:0,max:10,now:2,text:identity}}; <Text {...props}/>`,
  controlledTimer: `const delay = () => new Promise<void>(resolve => setTimeout(resolve,0));`,
  rawNullable: `declare const remote:string|undefined; const copy:UiCopy=remote??'Save'; <Text>{copy}</Text>`,
  rawArraySpread: `declare const remote:string[]; const copies:UiCopy[]=[...remote]; <Text>{copies}</Text>`,
  anyArraySpread: `declare const remote:any[]; const copies:UiCopy[]=[...remote]; <Text>{copies}</Text>`,
  controlledArraySpread: `declare const identity:UiCopy[]; const copies:UiCopy[]=[...identity]; <Text>{copies}</Text>`,
  controlledNullable: `declare const identity:{value:UiCopy}|undefined; const data:{value:UiCopy}=identity??{value:'Save'}; <Text>{data.value}</Text>`,
};
const files = new Map([
  [policy, `export const UI_LABELS = ['Save', 'Cancel'] as const; export type UiText = string & {readonly __uiText: unique symbol}; export type UiInputText = string & {readonly __uiInputText: unique symbol}; export type UiCopy = UiText|'Save'|'Cancel';`],
  [declarations, `export declare const Text: (props: any) => any; export declare const TextInput: (props: any) => any;
export declare const Alert: {alert(title: string, message?: string, buttons?: {text: string; onPress?: () => void}[]): void};
export declare const Share: {share(content: {message: string}): void}; export declare function scheduleNotificationAsync(request: {content:{title:string;body:string}}):void;`],
  [path.join(root, 'node_modules/@types/react/index.d.ts'), `export interface ReactElement {type:any;props:any;key:string|null;} export declare function createElement(type: any, props: any, ...children: any[]): any;`],
]);
for (const [name, source] of Object.entries(cases)) files.set(path.join(root, `app/${name}.tsx`), `import {Text, TextInput, Alert, Share, scheduleNotificationAsync} from 'react-native'; import { createElement as make, type ReactElement } from 'react'; import type {UiText, UiCopy, UiInputText} from '../src/lib/uiCopy'; ${source}`);
const compilerOptions = {strict: true, jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ES2020};
const host = ts.createCompilerHost(compilerOptions);
const originalGetSourceFile = host.getSourceFile.bind(host);
host.fileExists = name => files.has(path.resolve(name)) || ts.sys.fileExists(name);
host.readFile = name => files.get(path.resolve(name)) ?? ts.sys.readFile(name);
host.getSourceFile = (name, languageVersion) => {
  const text = files.get(path.resolve(name));
  return text == null ? originalGetSourceFile(name, languageVersion) : ts.createSourceFile(name, text, languageVersion, true);
};
host.resolveModuleNames = names => names.map(name => ({resolvedFileName: name === 'react-native' ? declarations : name === 'react' ? path.join(root, 'node_modules/@types/react/index.d.ts') : policy, extension: ts.Extension.Ts}));
const program = ts.createProgram([...files.keys()], compilerOptions, host);
const violations = inspectUiCopy({root, program, ts});
for (const name of Object.keys(cases)) {
  const count = violations.filter(issue => issue.file === `app/${name}.tsx`).length;
  if (name.startsWith('controlled')) assert.equal(count, 0, name);
  else assert.ok(count > 0, `${name} escaped the copy rule`);
}
console.log(`Verified ${Object.keys(cases).length} adversarial and permitted cases.`);
