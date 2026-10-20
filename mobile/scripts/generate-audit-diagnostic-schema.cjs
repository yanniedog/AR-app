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
  if (file !== 'src/components/PerformanceAuditRunner.tsx' && !/^src\/lib\/performanceAudit[^/]*\.ts$/.test(file)) continue;
  function visit(node) {
    if (ts.isPropertyAssignment(node) && propertyName(node.name) === 'metrics') scanMetrics(node.initializer);
    if (ts.isShorthandPropertyAssignment(node) && node.name.text === 'metrics') scanMetrics(node.name);
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'metrics' && node.initializer) scanMetrics(node.initializer);
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      if (isMetrics(node.left)) scanMetrics(node.right);
      else if (ts.isPropertyAccessExpression(node.left) && isMetrics(node.left.expression)) record(node.left.name.text, checker.getTypeAtLocation(node.right), node.right);
      else if (ts.isElementAccessExpression(node.left) && isMetrics(node.left.expression) && ts.isStringLiteral(node.left.argumentExpression)) record(node.left.argumentExpression.text, checker.getTypeAtLocation(node.right), node.right);
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText(source) === 'Object' && node.expression.name.text === 'assign' && node.arguments.length && isMetrics(node.arguments[0])) {
      node.arguments.slice(1).forEach(scanMetrics);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
const sorted = values => [...values].sort();
const enumValues = Object.fromEntries([...enums].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([name, values]) => [name, sorted(values)]));
const output = '// Generated from audit producers; run node scripts/generate-audit-diagnostic-schema.cjs.\n' +
  `export const AUDIT_PRODUCER_METRIC_FIELDS = new Set<string>(${JSON.stringify(sorted(names), null, 2)});\n` +
  `export const AUDIT_PRODUCER_SCALARS = new Set<string>(${JSON.stringify(sorted(scalars), null, 2)});\n` +
  `export const AUDIT_PRODUCER_ENUMS: Record<string, readonly string[]> = ${JSON.stringify(enumValues, null, 2)};\n`;
const target = path.join(root, 'src/lib/auditDiagnosticProducerFields.ts');
if (process.argv.includes('--check')) {
  if (fs.readFileSync(target, 'utf8') !== output) throw new Error('Audit producer schema is stale; regenerate it.');
} else fs.writeFileSync(target, output);
