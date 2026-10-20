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
function record(name, type) {
  names.add(name);
  const types = (type.isUnion() ? type.types : [type]).filter(item => !(item.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)));
  if (types.length && types.every(item => item.flags & (ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike))) scalars.add(name);
  if (types.length && types.every(item => item.isStringLiteral())) {
    const values = enums.get(name) ?? new Set();
    types.forEach(item => values.add(item.value)); enums.set(name, values);
  }
}
for (const source of program.getSourceFiles()) {
  const file = path.relative(root, source.fileName).replaceAll('\\', '/');
  if (file !== 'src/components/PerformanceAuditRunner.tsx' && !/^src\/lib\/performanceAudit[^/]*\.ts$/.test(file)) continue;
  function visit(node) {
    if (ts.isPropertyAssignment(node) && node.name.getText(source) === 'metrics' && ts.isObjectLiteralExpression(node.initializer)) {
      // Include statically known properties supplied by object spreads as well.
      for (const property of checker.getTypeAtLocation(node.initializer).getProperties()) {
        if (!property.getName().startsWith('__@')) record(property.getName(), checker.getTypeOfSymbolAtLocation(property, node.initializer));
      }
      for (const property of node.initializer.properties) {
        if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) continue;
        const name = ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) ? property.name.text : null;
        if (!name) continue;
        const type = checker.getTypeAtLocation(ts.isShorthandPropertyAssignment(property) ? property.name : property.initializer);
        record(name, type);
      }
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
