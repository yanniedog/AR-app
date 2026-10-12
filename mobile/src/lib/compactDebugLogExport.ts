/** Review exports summarize routine audit evidence; the retained log/sidecar stay unchanged. */
type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => value != null && typeof value === 'object' && !Array.isArray(value);
const stable = (value: unknown) => JSON.stringify(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function clean(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clean);
  if (!record(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, clean(nested)]));
}

function timingTotals(checks: RecordValue[]): RecordValue {
  const totals: RecordValue = {};
  for (const check of checks) {
    const metrics = record(check.metrics) ? check.metrics : {};
    for (const [key, value] of Object.entries({ durationMs: check.durationMs, ...metrics })) {
      if (!finite(value) || !/(Ms|Samples)$/.test(key)) continue;
      const previous = totals[key] as { measured: number; sum: number; max: number } | undefined;
      totals[key] = { measured: (previous?.measured ?? 0) + 1, sum: (previous?.sum ?? 0) + value, max: Math.max(previous?.max ?? value, value) };
    }
  }
  return clean(totals) as RecordValue;
}

/** Store shared metric names/values once, retaining all anomaly fields without abbreviating them. */
function checkTable(checks: RecordValue[]): RecordValue {
  const common: RecordValue = { ...(record(checks[0]?.metrics) ? checks[0].metrics : {}) };
  for (const key of Object.keys(common)) {
    if (!checks.every((check) => record(check.metrics) && stable(check.metrics[key]) === stable(common[key]))) delete common[key];
  }
  const metricColumns = [...new Set(checks.flatMap((check) => record(check.metrics) ? Object.keys(check.metrics) : []))]
    .filter((key) => !(key in common));
  const extraColumns = [...new Set(checks.flatMap(Object.keys))].filter((key) => !['id', 'status', 'durationMs', 'metrics'].includes(key));
  return {
    columns: ['id', 'status', 'durationMs', ...extraColumns, 'metrics'],
    commonMetrics: common,
    metricColumns,
    rows: checks.map((check) => [check.id, check.status, check.durationMs ?? null,
      ...extraColumns.map((key) => check[key] ?? null),
      metricColumns.map((key) => record(check.metrics) ? check.metrics[key] ?? null : null)]),
  };
}

function localLinkWarning(check: RecordValue): boolean {
  const m = check.metrics;
  return check.kind === 'network' && check.status === 'warn' && !check.error && !check.trace && record(m) &&
    m.urlValidation === 'pass' && (m.browserHandler === 'pass' || (m.browserHandler === 'unknown' && m.handlerAttempted === false)) && m.httpReachability === 'unknown' &&
    m.httpAttempted === false && m.nonTimingFailure === false;
}

function hasProbeEvidence(check: RecordValue): boolean {
  const metrics = check.metrics;
  // A successful performance check can still expose a display-health failure.
  // Keep probe evidence independently of the later report, including partial logs.
  return record(metrics) && ['readinessEvidence', 'graphicEvidence', 'readinessActionEvidence']
    .some((key) => metrics[key] != null && metrics[key] !== '');
}

// AuditCheck, ResponsivenessMetrics and the current runner/link measurements.
// New fields are evidence until explicitly reviewed; a suffix such as "Ms" or a
// scalar value alone never makes an unfamiliar field safe to discard.
const routineNumberMetrics = new Set([
  'preloadedAgeMs', 'statusCode', 'rows', 'visibleRows', 'childNodes', 'rankedRows', 'statsCount',
  'firstScopeMs', 'firstFilterMs', 'firstHierarchyMs', 'firstStatsMs', 'firstRankMs',
  'repeatScopeMs', 'repeatFilterMs', 'repeatHierarchyMs', 'repeatStatsMs', 'repeatRankMs',
  'payloadChars', 'rateRows', 'stringifyMs', 'parseMs', 'traversalMs',
  'inventorySlices', 'inventoryRawCandidates', 'inventoryPolicyValidations', 'inventoryCpuMs',
  'inventoryMaxSliceMs', 'inventoryYieldMs', 'inventoryMaxYieldMs', 'uniqueDestinations', 'observedDestinations',
  'payloadBytes', 'iterations', 'maxWriteMs', 'maxReadMs', 'averageWriteMs', 'averageReadMs',
  'writeMs', 'readMs', 'bytes', 'sampledBytes', 'flushMs', 'attempts',
  'depth', 'readinessQuietWindowMs', 'forwardWorkMs', 'forwardMs', 'backgroundSettleMs',
  'destinationReadinessMs', 'backMs', 'originReadinessMs', 'secondBackMs', 'replaceRecoveryMs', 'returnFallbackMs',
]);
const routineBooleanMetrics = new Set([
  'executionAttempted', 'nonTimingFailure', 'preloaded', 'handlerAttempted', 'httpAttempted',
  'measurementAvailable', 'lenderDetailsLoaded', 'temporaryKeyDeleted', 'temporaryFileDeleted',
  'fullExportMeasured', 'restored', 'actionInvoked', 'actionCompleted', 'backChangedPath',
  'backReturnedToAudit', 'deepSearchAvailable',
]);
for (const prefix of ['', 'forward', 'background', 'back']) {
  const name = (key: string) => prefix ? `${prefix}${key[0].toUpperCase()}${key.slice(1)}` : key;
  for (const key of ['eventLoopSamples', 'eventLoopP95Ms', 'maxEventLoopLagMs', 'stallsOver100Ms',
    'frameSamples', 'frameP95Ms', 'maxFrameGapMs', 'framesOver50Ms']) routineNumberMetrics.add(name(key));
  for (const key of ['eventLoopMeasurementAvailable', 'frameMeasurementAvailable']) routineBooleanMetrics.add(name(key));
}
const routineTextMetrics = new Set([
  'host', 'destinationPath', 'purpose', 'validationDetail', 'handlerDetail', 'reachabilityDetail', 'reason',
  'section', 'responsivenessClassification', 'measurementMode', 'journeyId', 'journeyLabel', 'iteration',
  'passId', 'scenarioId', 'semanticActionId', 'plannedExpectedPath', 'expectedPath', 'expectedSurface',
  'navigationKind', 'backgroundTasks', 'backDestination', 'returnNavigationKind', 'searchMode',
  'renderRevisionBefore', 'renderRevisionAfter',
]);
const routineCheckTextFields = new Set(['id', 'label', 'journalLogPrefix']);
const routineKinds = new Set(['journey', 'runtime', 'storage', 'network', 'data', 'update']);
const routineStatuses = new Set(['pass', 'warn', 'fail', 'skipped']);

function knownRoutineShape(check: RecordValue): boolean {
  return Object.entries(check).every(([key, value]) => {
    if (routineCheckTextFields.has(key)) return typeof value === 'string';
    if (key === 'kind') return typeof value === 'string' && routineKinds.has(value);
    if (key === 'status') return typeof value === 'string' && routineStatuses.has(value);
    if (key === 'durationMs') return value === null || (finite(value) && value >= 0);
    if (key === 'error' || key === 'trace') return value === null || typeof value === 'string';
    if (key !== 'metrics' || !record(value)) return false;
    return Object.entries(value).every(([metric, observation]) => {
      if (routineNumberMetrics.has(metric)) return observation === null || (finite(observation) && observation >= 0);
      if (routineBooleanMetrics.has(metric)) return typeof observation === 'boolean';
      if (routineTextMetrics.has(metric)) return observation === null || typeof observation === 'string';
      if (['urlValidation', 'browserHandler', 'httpReachability'].includes(metric)) {
        return typeof observation === 'string' && ['pass', 'fail', 'unknown'].includes(observation);
      }
      if (['runtimeErrors', 'incidentalRuntimeErrors'].includes(metric)) return observation === 0;
      if (['runtimeErrorMessages', 'incidentalRuntimeErrorMessages',
        'readinessEvidence', 'graphicEvidence', 'readinessActionEvidence'].includes(metric)) return observation === null || observation === '';
      return false;
    });
  });
}

function summarizeTimingWarning(check: RecordValue): RecordValue {
  const m = check.metrics;
  if (!knownRoutineShape(check) || hasProbeEvidence(check) || check.kind !== 'journey' || check.status !== 'warn' || check.error || check.trace ||
    !record(m) || m.nonTimingFailure !== false || m.actionCompleted === false ||
    ['readinessEvidence', 'graphicEvidence'].some((key) => typeof m[key] === 'string' && /error|failed|pending/i.test(m[key]))) return check;
  // Warnings without probe evidence can omit routine identifiers/revision descriptions.
  // Unknown text fields are retained for forward compatibility.
  const routineText = new Set(['journeyId', 'journeyLabel', 'iteration', 'passId', 'scenarioId',
    'semanticActionId', 'plannedExpectedPath', 'renderRevisionBefore', 'renderRevisionAfter',
    'readinessEvidence', 'graphicEvidence', 'readinessActionEvidence']);
  return { ...check, metrics: { ...Object.fromEntries(Object.entries(m).filter(([key]) => !routineText.has(key))),
    successfulProbeTextSummarized: true,
    ...(m.renderRevisionBefore != null && m.renderRevisionAfter != null ? { renderRevisionChanged: m.renderRevisionBefore !== m.renderRevisionAfter } : {}),
    ...(m.plannedExpectedPath !== m.expectedPath ? { plannedExpectedPath: m.plannedExpectedPath } : {}),
  } };
}

function routineCheck(check: RecordValue): boolean {
  return knownRoutineShape(check) && !hasProbeEvidence(check) && ((check.status === 'pass' && !check.error && !check.trace &&
    record(check.metrics) && check.metrics.nonTimingFailure !== true &&
    !(finite(check.durationMs) && check.durationMs > 10_000)) || localLinkWarning(check));
}

function compactChecks(checks: unknown[]): RecordValue {
  const groups = new Map<string, RecordValue[]>();
  const detailed = new Map<string, RecordValue[]>();
  const detailedIndexes = new Map<string, number[]>();
  const unknown: unknown[] = [];
  for (const [index, value] of checks.entries()) {
    if (!record(value) || typeof value.id !== 'string' || typeof value.kind !== 'string' || typeof value.status !== 'string' || !record(value.metrics)) {
      unknown.push(value); continue;
    }
    // Probes, unexpected errors, traces and non-timing failures retain individual evidence.
    if (routineCheck(value)) {
      const m = record(value.metrics) ? value.metrics : {};
      const key = stable([value.kind, value.status, localLinkWarning(value) ?
        [m.purpose, m.validationDetail, m.handlerDetail, m.reachabilityDetail] : null]);
      const group = groups.get(key) ?? []; group.push(value); groups.set(key, group);
    } else {
      const summarized = summarizeTimingWarning(value);
      const key = stable([value.kind, value.status, Object.keys(summarized).sort(),
        record(summarized.metrics) ? Object.keys(summarized.metrics).sort() : []]);
      const group = detailed.get(key) ?? []; group.push(summarized); detailed.set(key, group);
      const indexes = detailedIndexes.get(key) ?? []; indexes.push(index); detailedIndexes.set(key, indexes);
    }
  }
  return {
    total: checks.length,
    routineGroups: [...groups.values()].map((group) => ({
      kind: group[0].kind, status: group[0].status, count: group.length,
      firstId: group[0].id, lastId: group[group.length - 1].id,
      timing: timingTotals(group),
      // One actual, slowest result gives policy/measurement context. Target lists stay local.
      slowestExample: group.reduce((a, b) => Number(a.durationMs ?? 0) >= Number(b.durationMs ?? 0) ? a : b),
    })),
    detailGroups: [...detailed].map(([key, group]) => ({ ...checkTable(group), checkIndexes: detailedIndexes.get(key) })),
    ...(unknown.length ? { unrecognized: unknown } : {}),
  };
}

function compactReport(source: RecordValue): RecordValue {
  const { checks, plan, appHealth, ...rest } = source;
  const result: RecordValue = { ...rest };
  if (Array.isArray(checks)) result.checks = compactChecks(checks);
  else if (checks !== undefined) result.checks = checks;
  if (record(plan) && Array.isArray(plan.passes)) {
    const { passes, ...planMeta } = plan;
    result.plan = { ...planMeta, passes: passes.map((pass) => {
      if (!record(pass) || !Array.isArray(pass.steps)) return pass;
      const { steps, ...passMeta } = pass;
      return { ...passMeta, plannedSteps: steps.length };
    }) };
  } else if (plan !== undefined) result.plan = plan;
  if (record(appHealth) && Array.isArray(appHealth.checks)) {
    result.appHealth = { ...appHealth, checks: appHealth.checks.map((check) => {
      // A passing reconciliation can still describe upstream failures or exclusions.
      // Preserve all evidence, encoding repeated provider count fields as a table.
      if (!record(check) || !record(check.localEvidence) || !Array.isArray(check.localEvidence.sections)) return check;
      return { ...check, localEvidence: { ...check.localEvidence, sections: check.localEvidence.sections.map((section) => {
        if (!record(section) || !Array.isArray(section.providers) || !section.providers.every(record)) return section;
        const rows = section.providers.map((provider) => Object.fromEntries(Object.entries(provider).flatMap(([key, value]) =>
          record(value) ? Object.entries(value).map(([nestedKey, nested]) => [`${key}.${nestedKey}`, nested]) : [[key, value]],
        )));
        const columns = [...new Set(rows.flatMap(Object.keys))];
        const { providers, ...rest } = section;
        return { ...rest, providerTable: { count: providers.length, columns, rows: rows.map((row) => columns.map((key) => row[key] ?? null)) } };
      }) } };
    }) };
  } else if (appHealth !== undefined) result.appHealth = appHealth;
  return result;
}

/** Repeated long evidence is stored once; explicit references are resolved using the texts table. */
function internEvidence(value: unknown): RecordValue {
  const counts = new Map<string, number>();
  const visit = (node: unknown) => {
    if (typeof node === 'string' && node.length >= 80) counts.set(node, (counts.get(node) ?? 0) + 1);
    else if (Array.isArray(node)) node.forEach(visit);
    else if (record(node)) Object.values(node).forEach(visit);
  };
  visit(value);
  const texts = [...counts].filter(([, count]) => count > 1).map(([text]) => text);
  const indexes = new Map(texts.map((text, index) => [text, index]));
  const replace = (node: unknown): unknown => {
    if (typeof node === 'string' && indexes.has(node)) return { $text: indexes.get(node) };
    if (Array.isArray(node)) return node.map(replace);
    if (record(node)) return Object.fromEntries(Object.entries(node).map(([key, nested]) => [key, replace(nested)]));
    return node;
  };
  return { ...(texts.length ? { texts } : {}), report: replace(value) };
}

function journalCoveredByReport(check: RecordValue, final: RecordValue): boolean {
  // Journal-only fields may carry evidence unknown to this exporter version.
  // A sidecar covers a journal entry only when it retains every original field.
  for (const [key, value] of Object.entries(check)) {
    if (key === 'journalLogPrefix') continue;
    if (key === 'metrics' && record(value)) {
      if (!record(final.metrics)) return false;
      for (const [metric, observation] of Object.entries(value)) {
        if (stable(observation) !== stable(final.metrics[metric])) return false;
      }
    } else if (stable(value) !== stable(final[key])) {
      return false;
    }
  }
  return true;
}

const checkpointKinds = new Set(['checkpoint', 'plan-step-start', 'deep-step-start', 'route-start', 'route-complete']);
const checkpointTextFields = new Set(['kind', 'sessionId', 'stepId', 'passId', 'scenarioId',
  'semanticActionId', 'expectedPath', 'expectedSurface', 'route', 'path']);
const checkpointCountFields = new Set(['depth', 'storedChecks', 'plannedChecks', 'completed', 'total']);

function routineCheckpoint(value: RecordValue, logPrefix: string): boolean {
  // Only known, low-severity progress records may replace earlier evidence.
  // Older/future schemas and nested payloads are retained rather than guessing
  // that an unfamiliar error/status field is safe to discard.
  return checkpointKinds.has(String(value.kind)) && /\[(?:INFO|DEBUG|TRACE)\s*\]$/i.test(logPrefix) &&
    !/\[(?:WARN|ERROR|FATAL)\s*\]/i.test(logPrefix) &&
    Object.entries(value).every(([key, nested]) => {
      if (checkpointTextFields.has(key)) return typeof nested === 'string';
      if (checkpointCountFields.has(key)) return finite(nested) && Number.isInteger(nested) && nested >= 0;
      return key === 'durationMs' && finite(nested) && nested >= 0 && nested <= 10_000;
    });
}

/** Only recognized audit JSON is summarized; unrelated/crash lines and malformed records survive verbatim. */
export function compactDebugLogExport(text: string): string {
  const sessions = new Map<string, { checks: Map<string, RecordValue[]>; journalChecks: RecordValue[]; report?: RecordValue; events: RecordValue[]; checkpoints: Map<string, RecordValue>; checkLocations: unknown[][] }>();
  type AuditRun = { sessionId: string; lines: [number, number]; first: string; last: string };
  const retained: (string | AuditRun)[] = [];
  const sessionFor = (id: string) => {
    let session = sessions.get(id);
    if (!session) { session = { checks: new Map(), journalChecks: [], events: [], checkpoints: new Map(), checkLocations: [] }; sessions.set(id, session); }
    return session;
  };
  let sourceLine = 0;
  for (const line of text.split('\n')) {
    sourceLine += 1;
    const eventStart = line.indexOf('perf-audit: {');
    const json = eventStart >= 0 ? line.slice(eventStart + 'perf-audit: '.length) : line;
    let value: unknown;
    try { value = JSON.parse(json); } catch { retained.push(line); continue; }
    if (!record(value) || typeof value.sessionId !== 'string') { retained.push(line); continue; }
    if (eventStart < 0 && !Array.isArray(value.checks)) { retained.push(line); continue; }
    const logPrefix = eventStart < 0 ? '' : line.slice(0, eventStart).trim();
    const description = `${eventStart < 0 ? 'saved-report' : value.kind === 'check' && record(value.check) ? value.check.id : value.kind} ${logPrefix}`.trim();
    const last = retained.at(-1);
    if (typeof last === 'object' && last.sessionId === value.sessionId && last.lines[1] === sourceLine - 1) {
      last.lines[1] = sourceLine;
      last.last = description;
    } else {
      retained.push({ sessionId: value.sessionId, lines: [sourceLine, sourceLine], first: description, last: description });
    }
    const session = sessionFor(value.sessionId);
    if (eventStart < 0) { session.report = value; continue; }
    if (value.kind === 'check' && record(value.check) && typeof value.check.id === 'string') {
      const prior = session.checks.get(value.check.id) ?? [];
      const journalCheck = { ...value.check, journalLogPrefix: logPrefix };
      prior.push(journalCheck);
      session.journalChecks.push(journalCheck);
      if (!routineCheck(value.check)) session.checkLocations.push([value.check.id, sourceLine, logPrefix]);
      session.checks.set(value.check.id, prior); continue;
    }
    // Collapse routine progress only. Anomalous or unfamiliar checkpoints must
    // survive a later successful checkpoint of the same kind.
    const event = { ...value, sourceLine, logPrefix,
      ...(value.kind === 'report-fallback' && record(value.report) ? { report: compactReport(value.report) } : {}),
    };
    if (routineCheckpoint(value, logPrefix)) {
      session.checkpoints.set(String(value.kind), event);
    } else session.events.push(event);
  }
  if (!sessions.size) return text;
  const output = [...retained.map((entry) => typeof entry === 'string' ? entry : `# Audit source ${JSON.stringify(entry)}`),
    '', '# Compact diagnostic export v1',
    '# Only known-shape routine passes and local-only link warnings are grouped with counts/timing; unfamiliar fields remain detailed; every failure, warning and skip outcome is retained.',
    '# Tables: columns describe rows; metricColumns describe metrics; commonMetrics apply to every row; checkIndexes retain original collection order; {$text:N} references texts[N].',
    '# Audit source markers preserve input order and original line ranges. Check locations retain anomaly and probe timestamps even when the saved report contains the check.',
    '# Readiness, graphic and action probe checks retain every field regardless of outcome. Plan steps are summarized; provider tables retain source accounting and failure evidence. Full evidence remains on the device.',
  ];
  for (const [sessionId, session] of sessions) {
    const canonical = session.report;
    const finalChecks = new Map(Array.isArray(canonical?.checks) ? canonical.checks.filter(record).map((c) => [c.id, c]) : []);
    const journalChecks = session.journalChecks;
    const additionalChecks = journalChecks.filter((check) => {
      const final = finalChecks.get(check.id);
      return !final || !journalCoveredByReport(check, final);
    });
    const report = canonical ? compactReport(canonical) : { sessionId, partial: true, checks: compactChecks(journalChecks) };
    const duplicateJournalIds = [...session.checks].filter(([, variants]) => variants.length > 1).map(([id]) => id);
    if (duplicateJournalIds.length) report.duplicateJournalIds = duplicateJournalIds;
    const duplicateIdSet = new Set(duplicateJournalIds);
    if (duplicateJournalIds.length) report.duplicateJournalChecks = compactChecks(
      journalChecks.filter((check) => duplicateIdSet.has(String(check.id))),
    );
    if (canonical && additionalChecks.length) report.additionalJournalChecks = compactChecks(additionalChecks);
    output.push(JSON.stringify(internEvidence(clean({ ...report,
      journalEvents: session.events, lastCheckpoints: [...session.checkpoints.values()],
      ...(session.checkLocations.length ? { checkLocations: { columns: ['id', 'sourceLine', 'logPrefix'], rows: session.checkLocations } } : {}),
    }))));
  }
  return output.join('\n');
}
