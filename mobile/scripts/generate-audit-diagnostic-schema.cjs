/** Regenerate after changing audit metric producers; no report/user data is read. */
/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
const program = ts.createProgram(parsed.fileNames, parsed.options);
const checker = program.getTypeChecker();
const names = new Set();
const scalars = new Set();
const enums = new Map();
const actionIds = new Set();
const requiredAssets = new Set();
const workerText = new Set(['Starting']);
const metricRecords = new Set();
const recordWrites = [];
const scannedMetrics = new Set();
function finiteNames(expression) {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return [expression.text];
  if (ts.isTemplateExpression(expression)) {
    let values = [expression.head.text];
    for (const span of expression.templateSpans) {
      const options = finiteNames(span.expression);
      if (!options.length) return [];
      if (values.length * options.length > 256) throw new Error('Metric key vocabulary needs an explicit bound');
      values = values.flatMap(prefix => options.map(value => prefix + value + span.literal.text));
    }
    return values;
  }
  const type = checker.getTypeAtLocation(expression);
  const types = type.isUnion() ? type.types : [type];
  return types.every(item => item.isStringLiteral()) ? types.map(item => item.value) : [];
}
function scanActions(expression, seen = new Set()) {
  if (seen.has(expression)) return;
  seen.add(expression);
  const add = name => { if (/^[A-Za-z][A-Za-z0-9._:-]{0,99}$/.test(name)) actionIds.add(name); };
  for (const property of checker.getTypeAtLocation(expression).getProperties()) {
    if (checker.getTypeOfSymbolAtLocation(property, expression).getCallSignatures().length) add(property.getName());
  }
  if (ts.isIdentifier(expression)) {
    const declaration = checker.getSymbolAtLocation(expression)?.valueDeclaration;
    if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer) scanActions(declaration.initializer, seen);
  } else if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression)) scanActions(expression.expression, seen);
  else if (ts.isCallExpression(expression) && /(?:^|\.)useMemo$|^Object\.freeze$/.test(expression.expression.getText()) && expression.arguments[0]) scanActions(expression.arguments[0], seen);
  else if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
    if (!ts.isBlock(expression.body)) scanActions(expression.body, seen);
    else {
      const returns = node => {
        if (ts.isReturnStatement(node) && node.expression) scanActions(node.expression, seen);
        else if (!ts.isFunctionLike(node)) ts.forEachChild(node, returns);
      };
      ts.forEachChild(expression.body, returns);
    }
  } else if (ts.isConditionalExpression(expression)) { scanActions(expression.whenTrue, seen); scanActions(expression.whenFalse, seen); }
  else if (ts.isObjectLiteralExpression(expression)) for (const property of expression.properties) {
    if (ts.isSpreadAssignment(property)) scanActions(property.expression, seen);
    else if (property.name) {
      if (ts.isComputedPropertyName(property.name)) finiteNames(property.name.expression).forEach(add);
      else if (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) add(property.name.text);
    }
  }
}
function record(name, type, expression) {
  names.add(name);
  const types = (type.isUnion() ? type.types : [type]).filter(item => !(item.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)));
  if (types.length && types.every(item => item.flags & (ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike))) scalars.add(name);
  if (types.length && types.every(item => item.isStringLiteral())) {
    const values = enums.get(name) ?? new Set();
    types.forEach(item => values.add(item.value)); enums.set(name, values);
  }
  // Contextual object/spread typing can widen a finite conditional to string.
  if (expression) {
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression)) record(name, checker.getTypeAtLocation(expression.expression), expression.expression);
    else if (ts.isConditionalExpression(expression)) {
      record(name, checker.getTypeAtLocation(expression.whenTrue), expression.whenTrue);
      record(name, checker.getTypeAtLocation(expression.whenFalse), expression.whenFalse);
    }
  }
}
const propertyName = node => ts.isIdentifier(node) || ts.isStringLiteral(node) ? node.text : null;
const isMetrics = node => ts.isIdentifier(node) && node.text === 'metrics' || ts.isPropertyAccessExpression(node) && node.name.text === 'metrics' ||
  ts.isElementAccessExpression(node) && node.argumentExpression && ts.isStringLiteral(node.argumentExpression) && node.argumentExpression.text === 'metrics';
function scanMetrics(expression) {
  if (scannedMetrics.has(expression)) return;
  scannedMetrics.add(expression);
  if (ts.isIdentifier(expression)) {
    const symbol = checker.getSymbolAtLocation(expression);
    if (symbol) {
      metricRecords.add(symbol);
      const declaration = symbol.valueDeclaration;
      if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer) scanMetrics(declaration.initializer);
    }
  }
  if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
    if (!ts.isBlock(expression.body)) scanMetrics(expression.body);
    else {
      const returns = node => {
        if (ts.isReturnStatement(node) && node.expression) scanMetrics(node.expression);
        else if (!ts.isFunctionLike(node)) ts.forEachChild(node, returns);
      };
      ts.forEachChild(expression.body, returns);
    }
    return;
  }
  const type = checker.getTypeAtLocation(expression);
  const objectTypes = (type.isUnion() ? type.types : [type]).filter(item => item.flags & (ts.TypeFlags.Object | ts.TypeFlags.Intersection));
  for (const objectType of objectTypes) for (const property of objectType.getProperties()) {
    if (!property.getName().startsWith('__@')) record(property.getName(), checker.getTypeOfSymbolAtLocation(property, expression));
  }
  if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression)) scanMetrics(expression.expression);
  else if (ts.isConditionalExpression(expression)) { scanMetrics(expression.whenTrue); scanMetrics(expression.whenFalse); }
  else if (ts.isBinaryExpression(expression) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(expression.operatorToken.kind)) {
    scanMetrics(expression.left); scanMetrics(expression.right);
  } else if (ts.isObjectLiteralExpression(expression)) {
    for (const property of expression.properties) {
      if (ts.isSpreadAssignment(property)) { scanMetrics(property.expression); continue; }
      if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) continue;
      const name = propertyName(property.name);
      if (!name) continue;
      const value = ts.isShorthandPropertyAssignment(property) ? property.name : property.initializer;
      record(name, checker.getTypeAtLocation(value), value);
    }
  }
}
for (const source of program.getSourceFiles()) {
  const file = path.relative(root, source.fileName).replaceAll('\\', '/');
  if (/^(?:src|app)\/.*\.tsx?$/.test(file)) {
    const visitActions = node => {
      if (ts.isCallExpression(node) && /(?:^|\.)usePerformanceAuditSurface$/.test(node.expression.getText(source)) && node.arguments[0] && ts.isObjectLiteralExpression(node.arguments[0])) {
        for (const property of node.arguments[0].properties) if (ts.isPropertyAssignment(property) && propertyName(property.name) === 'actions') scanActions(property.initializer);
      }
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ['begin', 'stage'].includes(node.expression.name.text)) {
        const declaration = checker.getResolvedSignature(node)?.declaration;
        if (declaration && path.relative(root, declaration.getSourceFile().fileName).replaceAll('\\', '/') === 'src/lib/backgroundPayloadWork.ts') {
          for (const index of node.expression.name.text === 'begin' ? [0, 2] : [0]) {
            if (node.arguments[index]) finiteNames(node.arguments[index]).forEach(value => workerText.add(value));
          }
        }
      }
      ts.forEachChild(node, visitActions);
    };
    visitActions(source);
  }
  if (file !== 'src/components/PerformanceAuditRunner.tsx' && !/^src\/lib\/performanceAudit[^/]*\.ts$/.test(file)) continue;
  function visit(node) {
    if (ts.isPropertyAssignment(node) && propertyName(node.name) === 'metrics') scanMetrics(node.initializer);
    if (ts.isPropertyAssignment(node) && propertyName(node.name) === 'skipReason') record('reason', checker.getTypeAtLocation(node.initializer), node.initializer);
    if (ts.isShorthandPropertyAssignment(node) && node.name.text === 'metrics') scanMetrics(node.name);
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'metrics' && node.initializer) scanMetrics(node.initializer);
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'requiredAssets' && node.initializer) {
      checker.getTypeAtLocation(node.initializer).getProperties().forEach(property => requiredAssets.add(property.getName()));
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      recordWrites.push(node);
      if (isMetrics(node.left)) scanMetrics(node.right);
      else if (ts.isPropertyAccessExpression(node.left) && isMetrics(node.left.expression)) record(node.left.name.text, checker.getTypeAtLocation(node.right), node.right);
      else if (ts.isElementAccessExpression(node.left) && isMetrics(node.left.expression) && ts.isStringLiteral(node.left.argumentExpression)) record(node.left.argumentExpression.text, checker.getTypeAtLocation(node.right), node.right);
      if (ts.isElementAccessExpression(node.left) && ts.isIdentifier(node.left.expression) && node.left.expression.text === 'stageDurations') {
        finiteNames(node.left.argumentExpression).forEach(name => record(name, checker.getTypeAtLocation(node.right), node.right));
      }
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText(source) === 'Object' && node.expression.name.text === 'assign' && node.arguments.length && isMetrics(node.arguments[0])) {
      node.arguments.slice(1).forEach(scanMetrics);
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText(source) === 'Object' && node.expression.name.text === 'assign' && node.arguments.length && ts.isIdentifier(node.arguments[0])) recordWrites.push(node);
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'runSetupStage' && node.arguments[2]) scanMetrics(node.arguments[2]);
    ts.forEachChild(node, visit);
  }
  visit(source);
}
const scannedWrites = new Set();
let changed = true;
while (changed) {
  changed = false;
  for (const write of recordWrites) {
    if (scannedWrites.has(write)) continue;
    const target = ts.isCallExpression(write) ? write.arguments[0] : ts.isIdentifier(write.left) ? write.left :
      ts.isPropertyAccessExpression(write.left) || ts.isElementAccessExpression(write.left) ? write.left.expression : null;
    if (!target || !ts.isIdentifier(target) || !metricRecords.has(checker.getSymbolAtLocation(target))) continue;
    scannedWrites.add(write); changed = true;
    if (ts.isCallExpression(write)) write.arguments.slice(1).forEach(scanMetrics);
    else if (ts.isIdentifier(write.left)) scanMetrics(write.right);
    else {
      const keys = ts.isPropertyAccessExpression(write.left) ? [write.left.name.text] : finiteNames(write.left.argumentExpression);
      keys.forEach(name => record(name, checker.getTypeAtLocation(write.right), write.right));
    }
  }
}
const sorted = values => [...values].sort();
const enumValues = Object.fromEntries([...enums].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([name, values]) => [name, sorted(values)]));
const output = '// Generated from audit producers; run node scripts/generate-audit-diagnostic-schema.cjs.\n' +
  `export const AUDIT_PRODUCER_METRIC_FIELDS = new Set<string>(${JSON.stringify(sorted(names), null, 2)});\n` +
  `export const AUDIT_PRODUCER_SCALARS = new Set<string>(${JSON.stringify(sorted(scalars), null, 2)});\n` +
  `export const AUDIT_REGISTERED_ACTION_IDS = new Set<string>(${JSON.stringify(sorted(actionIds), null, 2)});\n` +
  `export const AUDIT_REQUIRED_ASSET_IDS = new Set<string>(${JSON.stringify(sorted(requiredAssets), null, 2)});\n` +
  `export const AUDIT_WORKER_TEXT = new Set<string>(${JSON.stringify(sorted(workerText), null, 2)});\n` +
  `export const AUDIT_PRODUCER_ENUMS: Record<string, readonly string[]> = ${JSON.stringify(enumValues, null, 2)};\n`;
const target = path.join(root, 'src/lib/auditDiagnosticProducerFields.ts');
if (process.argv.includes('--check')) {
  if (fs.readFileSync(target, 'utf8') !== output) throw new Error('Audit producer schema is stale; regenerate it.');
} else fs.writeFileSync(target, output);
