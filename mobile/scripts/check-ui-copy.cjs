const path = require('node:path');
const { createRequire } = require('node:module');

const TEXT_PROPS = new Set(['title', 'headerTitle', 'tabBarLabel', 'label', 'text', 'message', 'body', 'children', 'placeholder', 'accessibilityLabel', 'accessibilityValue', 'aria-label', 'aria-valuetext', 'alt', 'promptMessage', 'cancelLabel', 'fallbackLabel', 'dialogTitle', 'buttonTitle', 'actionLabel', 'detail', 'caption', 'html', '__html']);
const REMOVED_APIS = new Set(['description', 'subtitle', 'deck', 'helperText', 'accessibilityHint', 'aria-description', 'summary', 'hint', 'sub']);

/** Type provenance, not sentence length, controls every production text sink. */
function inspectUiCopy({ root, policyFile = 'src/lib/uiCopy.ts', program: providedProgram, ts: providedTs }) {
  const ts = providedTs ?? createRequire(path.join(root, 'package.json'))('typescript');
  const policyPath = path.resolve(root, policyFile).toLowerCase();
  let program = providedProgram;
  if (!program) {
    const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
    if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
    program = ts.createProgram(parsed.fileNames, parsed.options);
  }
  const checker = program.getTypeChecker();
  const approvedLabels = new Set(['']);
  const policy = program.getSourceFiles().find(file => path.resolve(file.fileName).toLowerCase() === policyPath);
  if (policy) {
    function registry(node) {
      if (ts.isVariableDeclaration(node) && node.name.getText() === 'UI_LABELS') {
        let value = node.initializer;
        while (value && (ts.isAsExpression(value) || ts.isSatisfiesExpression(value))) value = value.expression;
        if (!value || !ts.isArrayLiteralExpression(value) || value.elements.some(item => !ts.isStringLiteral(item))) {
          throw new Error('UI_LABELS must be an explicitly reviewed literal array');
        }
        for (const item of value.elements) approvedLabels.add(item.text);
      }
      ts.forEachChild(node, registry);
    }
    registry(policy);
  }
  const violations = [];
  const seen = new Set();
  const sourceRoot = path.resolve(root, 'src').toLowerCase() + path.sep;
  const routeRoot = path.resolve(root, 'app').toLowerCase() + path.sep;

  function report(node, code) {
    const file = node.getSourceFile();
    const position = file.getLineAndCharacterOfPosition(node.getStart(file));
    const key = `${file.fileName}:${node.pos}:${code}`;
    if (seen.has(key)) return;
    seen.add(key);
    violations.push({ file: path.relative(root, file.fileName).split(path.sep).join('/'), line: position.line + 1, column: position.character + 1, code });
  }

  function branded(type) {
    const marker = type.getProperty('__uiText');
    return marker?.getDeclarations()?.some(declaration => path.resolve(declaration.getSourceFile().fileName).toLowerCase() === policyPath) ?? false;
  }
  function inputBranded(type) {
    const marker = type.getProperty('__uiInputText');
    return marker?.getDeclarations()?.some(declaration => path.resolve(declaration.getSourceFile().fileName).toLowerCase() === policyPath) ?? false;
  }
  function markupBranded(type) {
    return type.getProperty('__uiMarkup')?.getDeclarations()?.some(declaration => path.resolve(declaration.getSourceFile().fileName).toLowerCase() === policyPath) ?? false;
  }
  function markupSafe(type) {
    return markupBranded(type) || type.isUnion() && type.types.every(member => markupSafe(member));
  }
  function inputSafe(type) {
    return inputBranded(type) || (type.isUnion() ? type.types.every(member => inputSafe(member)) : safe(type));
  }
  function literalControlled(type) {
    if (type.isStringLiteral()) return approvedLabels.has(type.value);
    return type.isUnion() && type.types.some(member => member.isStringLiteral())
      && type.types.every(member => member.isStringLiteral() ? approvedLabels.has(member.value)
        : Boolean(member.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)));
  }

  const controlledTypes = new Map();
  function controlled(type, visiting = new Set()) {
    if (!visiting.size && controlledTypes.has(type)) return controlledTypes.get(type);
    const result = controlledInner(type, visiting);
    if (!visiting.size) controlledTypes.set(type, result);
    return result;
  }
  function controlledInner(type, visiting) {
    if (visiting.has(type) || visiting.size > 8) return false;
    const next = new Set(visiting).add(type);
    if (branded(type) || inputBranded(type) || markupBranded(type)) return true;
    if (type.isUnion()) return type.types.some(member => controlled(member, next));
    if (type.flags & ts.TypeFlags.Object) {
      if (checker.getTypeArguments(type).some(member => controlled(member, next))) return true;
      return type.getProperties().some(property => {
        const declaration = property.valueDeclaration ?? property.declarations?.[0];
        // Prototype methods are not text-bearing fields; traversing the full
        // standard library graph makes every style expression quadratic.
        return declaration && (ts.isPropertySignature(declaration) || ts.isPropertyDeclaration(declaration) || ts.isPropertyAssignment(declaration))
          && controlled(checker.getTypeOfSymbolAtLocation(property, declaration), next);
      });
    }
    return false;
  }

  function admittedTo(source, destination, location, visiting = new Set()) {
    if (!controlled(destination)) return true;
    if (ts.isStringLiteral(location) && approvedLabels.has(location.text)) return true;
    if (source.flags & ts.TypeFlags.Never) return true;
    if (source.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return false;
    if (inputBranded(destination)) return inputSafe(source);
    if (markupBranded(destination)) return markupSafe(source);
    if (destination.aliasSymbol?.name === 'UiChild') return safe(source, true);
    if (branded(destination) || destination.isStringLiteral()) return safe(source);
    if (source === destination || safe(destination) && safe(source)) return true;
    if (source.isUnion()) return source.types.every(member => admittedTo(member, destination, location, visiting));
    if (destination.isUnion()) return destination.types.some(member => checker.isTypeAssignableTo(source, member) && admittedTo(source, member, location, visiting));
    if (visiting.has(destination)) return false;
    const next = new Set(visiting).add(destination);
    const destinations = checker.getTypeArguments(destination);
    const sources = checker.getTypeArguments(source);
    if (destinations.some(member => controlled(member))) {
      return destinations.every((member, index) => !controlled(member) || (sources[index] && admittedTo(sources[index], member, location, next)));
    }
    return destination.getProperties().every(property => {
      const member = checker.getTypeOfSymbolAtLocation(property, location);
      if (!controlled(member)) return true;
      const counterpart = source.getProperty(property.name);
      if (!counterpart) return Boolean(member.flags & ts.TypeFlags.Undefined) || member.isUnion() && member.types.some(type => type.flags & ts.TypeFlags.Undefined);
      const declaration = counterpart.valueDeclaration;
      return admittedTo(checker.getTypeOfSymbolAtLocation(counterpart, location), member, declaration && ts.isPropertyAssignment(declaration) ? declaration.initializer : location, next);
    });
  }

  const safeTypes = [new Map(), new Map()];
  function safe(type, allowElements = false, visiting = new Set()) {
    const cache = safeTypes[allowElements ? 1 : 0];
    if (!visiting.size && cache.has(type)) return cache.get(type);
    const result = safeInner(type, allowElements, visiting);
    if (!visiting.size) cache.set(type, result);
    return result;
  }
  function safeInner(type, allowElements, visiting) {
    if (allowElements && type.aliasSymbol?.name === 'UiChild' && type.aliasSymbol.getDeclarations()?.some(declaration => path.resolve(declaration.getSourceFile().fileName).toLowerCase() === policyPath)) return true;
    if (visiting.has(type)) return false;
    const next = new Set(visiting).add(type);
    if (type.flags & ts.TypeFlags.Never) return true;
    if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return false;
    if (branded(type)) return true;
    if (type.isStringLiteral()) return approvedLabels.has(type.value);
    if (type.isUnion()) return type.types.every(member => safe(member, allowElements, next));
    if (type.flags & (ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike | ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Void)) return true;
    if (checker.isArrayType(type) || checker.isTupleType(type)) return checker.getTypeArguments(type).every(member => safe(member, allowElements, next));
    if (allowElements && type.flags & ts.TypeFlags.Object) {
      const symbolName = type.aliasSymbol?.name ?? type.symbol?.name;
      if (['Element', 'ReactElement', 'ReactPortal'].includes(symbolName)) {
        const declarations = (type.aliasSymbol ?? type.symbol)?.getDeclarations() ?? [];
        return declarations.some(declaration => /node_modules[\\/]@types[\\/]react[\\/]/.test(declaration.getSourceFile().fileName));
      }
      const signatures = type.getCallSignatures();
      if (signatures.length) return signatures.every(signature => safe(checker.getReturnTypeOfSignature(signature), true, next));
    }
    return false;
  }
  function renderingType(type) {
    if (type.aliasSymbol?.name === 'UiChild' && type.aliasSymbol.getDeclarations()?.some(declaration => path.resolve(declaration.getSourceFile().fileName).toLowerCase() === policyPath)) return true;
    const symbol = type.aliasSymbol ?? type.symbol;
    return ['Element', 'ReactElement', 'ReactPortal'].includes(symbol?.name)
      && symbol.getDeclarations()?.some(declaration => /node_modules[\\/]@types[\\/]react[\\/]/.test(declaration.getSourceFile().fileName));
  }

  function boundaryAdmitted(node) {
    if (ts.isStringLiteral(node) && approvedLabels.has(node.text)) return true;
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) return true;
    // Native sharing is an explicit full-evidence action whose producer owns
    // the local complete-log source and installed application metadata.
    if (path.resolve(node.getSourceFile().fileName).toLowerCase() === path.resolve(root, 'src/lib/debugEvidence.ts').toLowerCase()
      && ts.isAwaitExpression(node) && ts.isCallExpression(node.expression)
      && node.expression.expression.getText() === 'readVersionedDebugEvidence') {
      const symbol = checker.getSymbolAtLocation(node.expression.expression);
      const declaration = symbol?.getDeclarations()?.find(item => ts.isFunctionDeclaration(item));
      const statements = declaration?.body?.statements ?? [];
      const logDeclaration = statements.filter(ts.isVariableStatement).flatMap(statement => [...statement.declarationList.declarations]).find(item => item.name.getText() === 'completeLog');
      const read = logDeclaration?.initializer;
      const returned = statements.find(ts.isReturnStatement)?.expression;
      const method = read && ts.isAwaitExpression(read) && ts.isCallExpression(read.expression) && ts.isPropertyAccessExpression(read.expression.expression) ? read.expression.expression.name : undefined;
      const methodSymbol = method && checker.getSymbolAtLocation(method);
      const formatter = returned && ts.isCallExpression(returned) ? checker.getSymbolAtLocation(returned.expression) : undefined;
      const formatterActual = formatter && formatter.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(formatter) : formatter;
      const logPath = path.resolve(root, 'src/lib/debugLog.ts').toLowerCase();
      let sharingFunction = node.parent;
      while (sharingFunction && !ts.isFunctionDeclaration(sharingFunction)) sharingFunction = sharingFunction.parent;
      const nativeMetadata = returned && ts.isCallExpression(returned) ? returned.arguments.slice(1, 3).map(argument => ts.isBinaryExpression(argument) && ts.isPropertyAccessExpression(argument.left) ? checker.getSymbolAtLocation(argument.left.name) : undefined) : [];
      if (declaration && path.resolve(declaration.getSourceFile().fileName).toLowerCase() === path.resolve(root, 'src/lib/debugEvidence.ts').toLowerCase()
        && sharingFunction?.name?.getText() === 'shareVersionedDebugEvidence' && sharingFunction.parameters.length === 1 && sharingFunction.parameters[0].name.getText() === 'fullEvidence' && checker.getTypeAtLocation(sharingFunction.parameters[0].name).flags & ts.TypeFlags.BooleanLike
        && declaration.parameters.length === 1 && declaration.parameters[0].name.getText() === 'fullEvidence' && checker.getTypeAtLocation(declaration.parameters[0].name).flags & ts.TypeFlags.BooleanLike
        && node.expression.arguments.every(argument => checker.getTypeAtLocation(argument).flags & ts.TypeFlags.BooleanLike)
        && read && ts.isAwaitExpression(read) && ts.isCallExpression(read.expression) && read.expression.arguments.length === 0
        && method?.getText() === 'readCompleteText' && methodSymbol?.getDeclarations()?.some(item => path.resolve(item.getSourceFile().fileName).toLowerCase() === logPath)
        && formatterActual?.getDeclarations()?.some(item => path.resolve(item.getSourceFile().fileName).toLowerCase() === logPath && item.name?.getText() === 'formatVersionedLogExport')
        && returned.arguments[0]?.getText() === 'completeLog'
        && returned.arguments[1]?.getText() === "Application.nativeApplicationVersion ?? 'unknown'"
        && returned.arguments[2]?.getText() === "Application.nativeBuildVersion ?? 'unknown'"
        && nativeMetadata.length === 2 && nativeMetadata.every(symbol => symbol?.getDeclarations()?.some(item => /node_modules[\\/]expo-application[\\/]/.test(item.getSourceFile().fileName)))
        && returned.arguments[3] && ts.isObjectLiteralExpression(returned.arguments[3]) && returned.arguments[3].properties.length === 0
        && returned.arguments[4]?.getText() === '{ fullEvidence }') return true;
    }
    if (path.resolve(node.getSourceFile().fileName).toLowerCase() === path.resolve(root, 'src/components/ReceiptEvidenceText.tsx').toLowerCase()
      && ts.isCallExpression(node) && node.expression.getText() === 'JSON.stringify'
      && node.arguments[0]?.getText() === 'document.original' && node.arguments[1]?.kind === ts.SyntaxKind.NullKeyword && node.arguments[2]?.getText() === '2') {
      const type = checker.getTypeAtLocation(node.arguments[0].expression);
      if (type.symbol?.name === 'ReplayDocument' && type.symbol.getDeclarations()?.some(declaration =>
        path.resolve(declaration.getSourceFile().fileName).toLowerCase() === path.resolve(root, 'src/data/receiptReplay/types.ts').toLowerCase())) return true;
    }
    if (path.resolve(node.getSourceFile().fileName).toLowerCase() === path.resolve(root, 'src/components/AuditEvidenceText.tsx').toLowerCase()
      && ts.isCallExpression(node) && node.expression.getText() === 'JSON.stringify'
      && node.arguments[0]?.getText() === 'report' && node.arguments[1]?.kind === ts.SyntaxKind.NullKeyword && node.arguments[2]?.getText() === '2') {
      const type = checker.getTypeAtLocation(node.arguments[0]);
      if (type.symbol?.name === 'PerformanceAuditReport' && type.symbol.getDeclarations()?.some(declaration =>
        path.resolve(declaration.getSourceFile().fileName).toLowerCase() === path.resolve(root, 'src/lib/performanceAudit.ts').toLowerCase())) return true;
    }
    // This renderer owns its source: no text prop, only the bounded local log
    // selected by useSyncExternalStore from debugLog.getDisplayText.
    if (path.resolve(node.getSourceFile().fileName).toLowerCase() === path.resolve(root, 'src/components/DebugEvidenceText.tsx').toLowerCase()
      && ts.isIdentifier(node) && node.text === 'text') {
      const symbol = checker.getSymbolAtLocation(node);
      const declaration = symbol?.getDeclarations()?.find(item => ts.isBindingElement(item) || ts.isVariableDeclaration(item));
      const initializer = declaration && ts.isVariableDeclaration(declaration) ? declaration.initializer : declaration?.parent?.parent?.initializer;
      const snapshot = initializer && ts.isCallExpression(initializer) ? initializer.arguments[1] : undefined;
      const snapshotSymbol = snapshot && ts.isPropertyAccessExpression(snapshot) ? checker.getSymbolAtLocation(snapshot.name) : undefined;
      const hookSymbol = initializer && ts.isCallExpression(initializer) ? checker.getSymbolAtLocation(initializer.expression) : undefined;
      const hookActual = hookSymbol && hookSymbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(hookSymbol) : hookSymbol;
      if (initializer && ts.isCallExpression(initializer) && initializer.expression.getText() === 'useSyncExternalStore'
        && hookActual?.getDeclarations()?.some(item => /node_modules[\\/]@types[\\/]react[\\/]/.test(item.getSourceFile().fileName))
        && initializer.arguments[0]?.getText() === 'debugLog.subscribe' && initializer.arguments[1]?.getText() === 'debugLog.getDisplayText'
        && initializer.arguments[2]?.getText() === 'debugLog.getDisplayText'
        && snapshotSymbol?.getDeclarations()?.some(item => path.resolve(item.getSourceFile().fileName).toLowerCase() === path.resolve(root, 'src/lib/debugLog.ts').toLowerCase())) return true;
    }
    // A single fixed-registry legal/licence renderer, never a route exemption.
    if (path.resolve(node.getSourceFile().fileName).toLowerCase() === path.resolve(root, 'src/components/DocumentText.tsx').toLowerCase()
      && ts.isCallExpression(node) && node.expression.getText() === 'legalDocumentText') {
      const symbol = checker.getSymbolAtLocation(node.expression);
      const actual = symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
      if (actual?.getDeclarations()?.some(declaration => path.resolve(declaration.getSourceFile().fileName).toLowerCase() === policyPath && declaration.name?.getText() === 'legalDocumentText')) return true;
    }
    return false;
  }
  function textExpression(node, allowElements = false, allowInput = false, allowMarkup = false) {
    if (allowMarkup) { if (!markupSafe(checker.getTypeAtLocation(node))) report(node, 'uncontrolled-markup'); return; }
    if (boundaryAdmitted(node)) return;
    if (!(allowInput ? inputSafe(checker.getTypeAtLocation(node)) : safe(checker.getTypeAtLocation(node), allowElements))) report(node, 'uncontrolled-text');
  }

  function textComponent(tag) {
    if (!tag) return false;
    const symbol = checker.getSymbolAtLocation(tag);
    const actual = symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    return ['Text', 'TSpan', 'AppText', 'LedgerText', 'ChartText', 'span', 'p', 'div', 'label', 'button', 'a', 'h1', 'h2', 'h3'].includes(actual?.name ?? tag.getText());
  }
  function inputComponent(tag) {
    if (!tag) return false;
    const symbol = checker.getSymbolAtLocation(tag);
    const actual = symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    return ['TextInput', 'LedgerField', 'input', 'textarea'].includes(actual?.name ?? tag.getText());
  }

  function humanFields(object, visiting = new Set()) {
    if (ts.isArrayLiteralExpression(object)) {
      object.elements.forEach(item => humanFields(item, visiting));
      return;
    }
    if (!ts.isObjectLiteralExpression(object)) {
      const type = checker.getTypeAtLocation(object);
      if (branded(type) || inputBranded(type) || type.isUnion() && type.types.every(member => branded(member) || member.flags & (ts.TypeFlags.StringLike | ts.TypeFlags.Null | ts.TypeFlags.Undefined))) return;
      if (type.flags & (ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike | ts.TypeFlags.Null | ts.TypeFlags.Undefined)) return;
      if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) { report(object, 'uncontrolled-native-object'); return; }
      if (visiting.has(type)) return;
      const next = new Set(visiting).add(type);
      if (checker.isArrayType(type) || checker.isTupleType(type)) {
        for (const member of checker.getTypeArguments(type)) typedFields(member, object, next);
        return;
      }
      for (const prop of type.getProperties()) {
        const value = checker.getTypeOfSymbolAtLocation(prop, object);
        if (['html', '__html'].includes(prop.name) && !markupSafe(value)) report(object, 'uncontrolled-markup');
        else if (TEXT_PROPS.has(prop.name) && !['html', '__html'].includes(prop.name) && !safe(value, ['children', 'headerTitle', 'tabBarLabel'].includes(prop.name))) report(object, 'uncontrolled-native-field');
        else if (REMOVED_APIS.has(prop.name) && !(value.flags & (ts.TypeFlags.Never | ts.TypeFlags.Undefined))) report(object, 'removed-copy-api-native');
        else if (prop.name === 'content') {
          for (const nested of value.getProperties()) {
            if (TEXT_PROPS.has(nested.name) && !safe(checker.getTypeOfSymbolAtLocation(nested, object))) report(object, 'uncontrolled-native-content');
          }
        }
      }
      return;
    }
    for (const item of object.properties) {
      if (ts.isSpreadAssignment(item)) {
        humanFields(item.expression, visiting);
        continue;
      }
      if (ts.isShorthandPropertyAssignment(item)) {
        const name = item.name.text;
        if (TEXT_PROPS.has(name)) textExpression(item.name, ['children', 'headerTitle', 'tabBarLabel'].includes(name), false, ['html', '__html'].includes(name));
        else if (REMOVED_APIS.has(name)) report(item, 'removed-copy-api');
        else if (name === 'content') humanFields(item.name, visiting);
        continue;
      }
      if (!ts.isPropertyAssignment(item)) continue;
      const name = item.name.getText().replace(/^['"]|['"]$/g, '');
      if (REMOVED_APIS.has(name)) report(item, 'removed-copy-api');
      else if (TEXT_PROPS.has(name)) {
        if (name === 'accessibilityValue' && ts.isObjectLiteralExpression(item.initializer)) humanFields(item.initializer);
        else textExpression(item.initializer, ['children', 'headerTitle', 'tabBarLabel'].includes(name), false, ['html', '__html'].includes(name));
      } else if (ts.isObjectLiteralExpression(item.initializer)) humanFields(item.initializer);
    }
  }

  function typedFields(type, node, visiting) {
    if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) { report(node, 'uncontrolled-native-object'); return; }
    for (const property of type.getProperties()) {
      const value = checker.getTypeOfSymbolAtLocation(property, node);
      if (['html', '__html'].includes(property.name) && !markupSafe(value)) report(node, 'uncontrolled-markup');
      else if (TEXT_PROPS.has(property.name) && !['html', '__html'].includes(property.name) && !safe(value, ['children', 'headerTitle', 'tabBarLabel'].includes(property.name))) report(node, 'uncontrolled-native-field');
      if (REMOVED_APIS.has(property.name) && !(value.flags & (ts.TypeFlags.Never | ts.TypeFlags.Undefined))) report(node, 'removed-copy-api-native');
      if (property.name === 'content' && !visiting.has(value)) typedFields(value, node, new Set(visiting).add(value));
    }
  }
  function humanFieldsFromType(type, node) {
    if (type.isUnion()) { type.types.filter(member => !(member.flags & ts.TypeFlags.Undefined)).forEach(member => humanFieldsFromType(member, node)); return; }
    if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) { report(node, 'uncontrolled-native-object'); return; }
    typedFields(type, node, new Set());
  }

  function nativeCallName(expression) {
    const symbol = checker.getSymbolAtLocation(ts.isPropertyAccessExpression(expression) ? expression.name : expression);
    const declarations = symbol?.getDeclarations() ?? [];
    const signatures = checker.getTypeAtLocation(expression).getCallSignatures();
    const declaration = [...declarations, ...signatures.map(signature => signature.declaration).filter(Boolean)]
      .find(item => /node_modules[\\/](?:react-native|expo-|@expo[\\/]|@types[\\/]react)/.test(item.getSourceFile().fileName));
    if (declaration) return declaration.name?.getText() ?? symbol?.name ?? null;
    if (symbol && !(symbol.flags & ts.SymbolFlags.Alias)) {
      const variable = declarations.find(item => ts.isVariableDeclaration(item));
      if (variable?.initializer && (ts.isPropertyAccessExpression(variable.initializer) || ts.isIdentifier(variable.initializer))) return nativeCallName(variable.initializer);
      if (variable?.initializer && ts.isCallExpression(variable.initializer)
        && ts.isPropertyAccessExpression(variable.initializer.expression)
        && variable.initializer.expression.name.text === 'bind') return nativeCallName(variable.initializer.expression.expression);
    }
    return null;
  }
  function policyFunction(expression, name, visited = new Set()) {
    const symbol = checker.getSymbolAtLocation(expression);
    if (!symbol || visited.has(symbol)) return false;
    const next = new Set(visited).add(symbol);
    const actual = symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    const variable = actual?.getDeclarations()?.find(ts.isVariableDeclaration);
    if (variable?.initializer && (ts.isIdentifier(variable.initializer) || ts.isPropertyAccessExpression(variable.initializer))) return policyFunction(variable.initializer, name, next);
    if (variable?.initializer && ts.isCallExpression(variable.initializer) && ts.isPropertyAccessExpression(variable.initializer.expression) && variable.initializer.expression.name.text === 'bind') return policyFunction(variable.initializer.expression.expression, name, next);
    return actual?.getDeclarations()?.some(declaration => path.resolve(declaration.getSourceFile().fileName).toLowerCase() === policyPath && declaration.name?.getText() === name);
  }
  // This scanner reviews source-literal copy. It never emits sanitised HTML.
  // Entity replacement is simultaneous: &amp;quot; remains &quot;, not a quote.
  function decodeMarkupEntities(value) {
    const named = { nbsp: ' ', amp: '&', apos: "'", quot: '"', lt: '<', gt: '>' };
    return value.replace(/&(?:nbsp|amp|apos|quot|lt|gt|#\d+|#x[\da-f]+);/gi, entity => {
      const name = entity.slice(1, -1).toLowerCase();
      if (Object.hasOwn(named, name)) return named[name];
      const code = name.startsWith('#x') ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : entity;
    });
  }
  function markupLiteral(node) {
    const pieces = ts.isTemplateExpression(node) ? [node.head.text, ...node.templateSpans.map(span => span.literal.text)] : [node.text];
    if (pieces.reduce((length, piece) => length + piece.length, 0) > 1024 * 1024) {
      report(node, 'markup-literal-too-large');
      return;
    }
    const malformed = () => report(node, 'malformed-markup-literal');
    const removedAttributes = new Set([...REMOVED_APIS].map(name => name.toLowerCase()));
    const textAttributes = new Set(['title', 'alt', 'aria-label', 'aria-valuetext', 'placeholder', 'value']);
    const whitespace = character => character !== undefined && /\s/.test(character);
    function reviewCss(css) {
      let cursor = 0;
      while (cursor < css.length) {
        if (css.startsWith('/*', cursor)) {
          const end = css.indexOf('*/', cursor + 2);
          if (end < 0 || css.slice(cursor + 2, end).includes('/*')) { malformed(); return; }
          cursor = end + 2;
        } else if (css[cursor] === '\\' || css[cursor] === '<') {
          malformed(); return;
        } else if (css[cursor] === '"' || css[cursor] === "'") {
          const end = css.indexOf(css[cursor], cursor + 1);
          if (end < 0 || /[\\\r\n]/.test(css.slice(cursor + 1, end))) { malformed(); return; }
          cursor = end + 1;
        } else if (/[A-Za-z_-]/.test(css[cursor])) {
          const start = cursor++;
          while (cursor < css.length && /[A-Za-z\d_-]/.test(css[cursor])) cursor++;
          const property = css.slice(start, cursor).toLowerCase();
          while (whitespace(css[cursor])) cursor++;
          if (property !== 'content' || css[cursor] !== ':') continue;
          cursor++;
          while (whitespace(css[cursor])) cursor++;
          let value;
          if (css[cursor] === '"' || css[cursor] === "'") {
            const end = css.indexOf(css[cursor], cursor + 1);
            if (end < 0 || /[\\\r\n]/.test(css.slice(cursor + 1, end))) { malformed(); return; }
            // Raw style text does not interpret HTML entities a second time.
            value = css.slice(cursor + 1, end);
            cursor = end + 1;
            if (!approvedLabels.has(value)) report(node, 'unregistered-markup-content');
          } else {
            const startValue = cursor;
            while (cursor < css.length && ![';', '}'].includes(css[cursor])) cursor++;
            value = css.slice(startValue, cursor).trim();
            if (!['none', 'normal'].includes(value)) report(node, 'unregistered-markup-content');
          }
          while (whitespace(css[cursor])) cursor++;
          if (cursor < css.length && ![';', '}'].includes(css[cursor])) { malformed(); return; }
        } else cursor++;
      }
    }
    function tagAt(piece, start) {
      let cursor = start + 1;
      const closing = piece[cursor] === '/';
      if (closing) cursor++;
      if (!/[A-Za-z]/.test(piece[cursor] ?? '')) return null;
      const nameStart = cursor++;
      while (cursor < piece.length && /[A-Za-z\d:-]/.test(piece[cursor])) cursor++;
      const name = piece.slice(nameStart, cursor).toLowerCase();
      const attributes = new Set();
      while (cursor < piece.length) {
        const gapStart = cursor;
        while (whitespace(piece[cursor])) cursor++;
        if (piece[cursor] === '>') return { name, closing, selfClosing: false, end: cursor + 1 };
        if (piece.startsWith('/>', cursor) && !closing) return { name, closing, selfClosing: true, end: cursor + 2 };
        if (closing || cursor === gapStart || !/[A-Za-z_:]/.test(piece[cursor] ?? '')) return null;
        const attributeStart = cursor++;
        while (cursor < piece.length && /[A-Za-z\d_.:-]/.test(piece[cursor])) cursor++;
        const attribute = piece.slice(attributeStart, cursor).toLowerCase();
        if (attributes.has(attribute)) return null;
        attributes.add(attribute);
        if (removedAttributes.has(attribute)) report(node, 'removed-copy-api-markup');
        const nameEnd = cursor;
        while (whitespace(piece[cursor])) cursor++;
        if (piece[cursor] !== '=') {
          if (textAttributes.has(attribute)) return null;
          cursor = nameEnd;
          continue;
        }
        cursor++;
        while (whitespace(piece[cursor])) cursor++;
        let value;
        if (piece[cursor] === '"' || piece[cursor] === "'") {
          const end = piece.indexOf(piece[cursor], cursor + 1);
          if (end < 0 || piece.slice(cursor + 1, end).includes('<')) return null;
          value = piece.slice(cursor + 1, end);
          cursor = end + 1;
        } else {
          const valueStart = cursor;
          while (cursor < piece.length && !whitespace(piece[cursor]) && piece[cursor] !== '>') {
            if (/["'<=`]/.test(piece[cursor])) return null;
            cursor++;
          }
          if (valueStart === cursor) return null;
          value = piece.slice(valueStart, cursor);
        }
        const decoded = decodeMarkupEntities(value);
        if (textAttributes.has(attribute) && !approvedLabels.has(decoded)) report(node, 'unregistered-markup-attribute');
        if (attribute === 'style') reviewCss(decoded);
      }
      return null;
    }
    for (const piece of pieces) {
      const textParts = [];
      let cursor = 0;
      while (cursor < piece.length) {
        if (piece[cursor] !== '<') {
          const next = piece.indexOf('<', cursor);
          const end = next < 0 ? piece.length : next;
          textParts.push(decodeMarkupEntities(piece.slice(cursor, end)));
          cursor = end;
        } else if (piece.startsWith('<!--', cursor)) {
          const end = piece.indexOf('-->', cursor + 4);
          if (end < 0 || piece.slice(cursor + 4, end).includes('--')) { malformed(); break; }
          cursor = end + 3;
        } else if (/^<!doctype\s+html\s*>/i.test(piece.slice(cursor))) {
          cursor = piece.indexOf('>', cursor) + 1;
        } else {
          const token = tagAt(piece, cursor);
          if (!token) { malformed(); break; }
          if (token.name === 'script') { report(node, 'script-markup-prohibited'); break; }
          if (token.name === 'style') {
            if (token.closing || token.selfClosing) { malformed(); break; }
            const closingStart = piece.indexOf('<', token.end);
            const closing = closingStart < 0 ? null : tagAt(piece, closingStart);
            if (!closing || closing.name !== 'style' || !closing.closing) { malformed(); break; }
            reviewCss(piece.slice(token.end, closingStart));
            cursor = closing.end;
          } else cursor = token.end;
        }
      }
      const text = textParts.join('').replace(/\s+/g, ' ').trim();
      if (text && !approvedLabels.has(text)) report(node, 'unregistered-markup-text');
    }
  }
  function booleanPosition(node) {
    let current = node;
    while (current.parent) {
      const parent = current.parent;
      if (ts.isConditionalExpression(parent) && parent.condition === current) return true;
      if (ts.isPrefixUnaryExpression(parent) && parent.operator === ts.SyntaxKind.ExclamationToken) return true;
      if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && parent.left === current) return true;
      if (ts.isParenthesizedExpression(parent) || ts.isBinaryExpression(parent) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(parent.operatorToken.kind)) { current = parent; continue; }
      return false;
    }
    return false;
  }

  for (const file of program.getSourceFiles()) {
    const full = path.resolve(file.fileName).toLowerCase();
    if (file.isDeclarationFile || /[\\/]__tests__[\\/]|\.test\.[cm]?[jt]sx?$/.test(full) || !(full.startsWith(sourceRoot) || full.startsWith(routeRoot))) continue;
    const factoryBoundary = full === policyPath;
    function walk(node) {
      if (ts.isTaggedTemplateExpression(node) && policyFunction(node.tag, 'uiMarkup')) {
        markupLiteral(node.template);
        if (ts.isTemplateExpression(node.template)) node.template.templateSpans.forEach(span => textExpression(span.expression, false, false, true));
      }
      if (ts.isJsxText(node) && node.text.trim() && !approvedLabels.has(node.text.replace(/\s+/g, ' ').trim())) report(node, 'unregistered-jsx-text');
      if (ts.isJsxExpression(node) && node.expression) {
        const parent = node.parent;
        if (ts.isJsxElement(parent) || ts.isJsxFragment(parent)) textExpression(node.expression, true);
      }
      if (ts.isJsxAttribute(node)) {
        const name = node.name.getText(file);
        if (REMOVED_APIS.has(name)) report(node, 'removed-copy-api');
        else if (['value', 'defaultValue'].includes(name) && inputComponent(node.parent.parent.tagName) && node.initializer) {
          if (ts.isJsxExpression(node.initializer) && node.initializer.expression) textExpression(node.initializer.expression, false, true);
          else textExpression(node.initializer, false, true);
        }
        else if (TEXT_PROPS.has(name) && node.initializer) {
          if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
            if (name === 'accessibilityValue') humanFields(node.initializer.expression);
            else textExpression(node.initializer.expression, ['children', 'headerTitle', 'tabBarLabel'].includes(name), false, ['html', '__html'].includes(name));
          } else textExpression(node.initializer, ['headerTitle', 'tabBarLabel'].includes(name), false, ['html', '__html'].includes(name));
        }
      }
      if (ts.isJsxSpreadAttribute(node)) {
        const type = checker.getTypeAtLocation(node.expression);
        if (type.flags & ts.TypeFlags.Any) report(node, 'uncontrolled-jsx-spread');
        for (const prop of type.getProperties()) {
          if (prop.name === 'children' && !textComponent(node.parent.parent.tagName)) continue;
          if (['value', 'defaultValue'].includes(prop.name) && inputComponent(node.parent.parent.tagName) && !inputSafe(checker.getTypeOfSymbolAtLocation(prop, node))) report(node, 'uncontrolled-input-spread');
          if (REMOVED_APIS.has(prop.name) && !(checker.getTypeOfSymbolAtLocation(prop, node).flags & (ts.TypeFlags.Never | ts.TypeFlags.Undefined))) report(node, 'removed-copy-api-spread');
          else if (prop.name === 'accessibilityValue') humanFieldsFromType(checker.getTypeOfSymbolAtLocation(prop, node), node);
          else if (['html', '__html'].includes(prop.name) && !markupSafe(checker.getTypeOfSymbolAtLocation(prop, node))) report(node, 'uncontrolled-markup');
          else if (TEXT_PROPS.has(prop.name) && !['html', '__html'].includes(prop.name) && !safe(checker.getTypeOfSymbolAtLocation(prop, node), ['children', 'headerTitle', 'tabBarLabel'].includes(prop.name))) report(node, 'uncontrolled-text-spread');
        }
      }
      if (!factoryBoundary && (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node))) {
        const destination = checker.getTypeAtLocation(node);
        if (destination.flags & ts.TypeFlags.Never && !(checker.getTypeAtLocation(node.expression).flags & ts.TypeFlags.Never)) report(node, 'forged-never-text');
        if ((controlled(destination) && !admittedTo(checker.getTypeAtLocation(node.expression), destination, node))
          || (renderingType(destination) && !safe(checker.getTypeAtLocation(node.expression), true))
          || (literalControlled(destination) && !safe(checker.getTypeAtLocation(node.expression)))) report(node, 'forged-ui-text');
      }
      if (!factoryBoundary && ts.isExpression(node) && !boundaryAdmitted(node)
        && !booleanPosition(node)
        && !(ts.isJsxAttribute(node.parent) && node.parent.initializer === node)) {
        const context = ts.isSpreadElement(node) && ts.isArrayLiteralExpression(node.parent) ? checker.getContextualType(node.parent) : checker.getContextualType(node);
        let source = ts.isSpreadElement(node) && ts.isArrayLiteralExpression(node.parent) ? checker.getTypeAtLocation(node.expression) : checker.getTypeAtLocation(node);
        // Only a present value flows out of the left operand of ??; the
        // fallback is independently checked against the same destination.
        if (ts.isBinaryExpression(node.parent) && node.parent.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken && node.parent.left === node) source = checker.getNonNullableType(source);
        if (context && ((controlled(context) && !admittedTo(source, context, node))
          || (renderingType(context) && !safe(checker.getTypeAtLocation(node), true))
          || (literalControlled(context) && !(ts.isStringLiteral(node) && approvedLabels.has(node.text)) && !safe(checker.getTypeAtLocation(node))))) report(node, 'uncontrolled-ui-assignment');
      }
      if (ts.isCallExpression(node)) {
        if (policyFunction(node.expression, 'uiMarkup')) report(node, 'non-tagged-markup-construction');
        const name = nativeCallName(node.expression);
        if (name === 'alert') node.arguments.slice(0, 2).forEach(argument => textExpression(argument));
        if (name && ['alert', 'share', 'shareAsync', 'authenticateAsync', 'scheduleNotificationAsync', 'setNotificationContentAsync', 'setNotificationChannelAsync', 'setNotificationCategoryAsync', 'printToFileAsync', 'printAsync'].includes(name)) node.arguments.forEach(argument => humanFields(argument));
        if (name && ['createElement', 'cloneElement', 'jsx', 'jsxs'].includes(name)) {
          if (node.arguments[1]) humanFields(node.arguments[1]);
          node.arguments.slice(2).forEach(argument => textExpression(argument, true));
        }
      }
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        // Object-valued options also carry screen titles and native labels.
        node.attributes.properties.forEach(attribute => {
          if (ts.isJsxAttribute(attribute) && ['options', 'screenOptions'].includes(attribute.name.getText())
            && attribute.initializer && ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression) humanFields(attribute.initializer.expression);
        });
      }
      ts.forEachChild(node, walk);
    }
    walk(file);
  }
  return violations;
}

module.exports = { inspectUiCopy };
if (require.main === module) {
  const root = path.resolve(process.argv[2] ?? process.cwd());
  const violations = inspectUiCopy({ root });
  console.log(JSON.stringify({ violations: violations.length, examples: violations.slice(0, 12) }, null, 2));
  process.exitCode = violations.length ? 1 : 0;
}
