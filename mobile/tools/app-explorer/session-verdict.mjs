// Pass/fail for a real-use session. A person judges the app by whether it crashed, froze,
// showed nothing, made them tap twice or got slower than last time, not by emulator-scaled
// millisecond budgets. Absolute timings stay in the report as information only.

export const THRESHOLDS = {
  stuckSpinnerMs: 15000,
  emptyFailMs: 15000,
  emptyFrictionMs: 5000,
  unresponsiveMs: 3000,
  layoutJumps: 2,
  jankFailRatio: 0.95,
  jankRegressionDelta: 0.15,
  jankMinFrames: 20,
  regressionFactor: 1.5,
  regressionMinMs: 1500,
  responseRegressionMinMs: 1000,
};

const ms = n => `${(n / 1000).toFixed(1)} s`;
const contentMs = s => (Number.isFinite(s.firstContentMs) ? s.firstContentMs : s.settleMs);

/** Steps that belong to the session (tagged by the driver), or all steps when none are tagged. */
export function sessionSteps(report) {
  const tagged = (report.steps || []).filter(s => s.session);
  return tagged.length ? tagged : report.steps || [];
}

function jankRatio(s) {
  const f = s.frames || {};
  return f.frames >= THRESHOLDS.jankMinFrames ? f.janky / f.frames : null;
}

/** Time the screen had changed but still showed no real content (blank or spinner only). */
export function emptyMs(s) {
  return Number.isFinite(s.firstContentMs) && Number.isFinite(s.responseMs) ? Math.max(0, s.firstContentMs - s.responseMs) : null;
}

/**
 * @param report   explorer report.json
 * @param baseline previous real-use session report.json, or null
 * @returns {{outcome:'pass'|'attention'|'fail', findings:object[], informational:object[], baselineVersion:string|null}}
 */
export function computeVerdict(report, baseline) {
  const t = THRESHOLDS;
  const steps = sessionSteps(report);
  const baseByName = new Map(((baseline && baseline.steps) || []).map(s => [s.name, s]));
  const findings = [];
  const add = (severity, kind, step, text) => findings.push({ severity, kind, step: step.n, name: step.name, text });

  // A scroll step can move the screen's one refresh action out of view; the user still has it.
  let actionOnScreen = false;
  for (const s of steps) {
    const launch = s.activityStartMs != null;
    if (s.alive === false) add('fail', 'crash', s, `Crashed on "${s.name}"`);
    if (s.anr) add('fail', 'anr', s, `Stopped responding on "${s.name}"`);
    if (s.error) add('fail', 'journey', s, `"${s.name}" failed: ${s.error}`);
    if (s.deadEnd) add('fail', 'dead-end', s, `No way back on "${s.name}"`);
    if (s.maxLoadingMs >= t.stuckSpinnerMs) add('fail', 'stuck-spinner', s, `Spinner ${ms(s.maxLoadingMs)} on "${s.name}"`);
    else if (s.settleTimedOut && !s.error) add('fail', 'never-settled', s, `Screen never settled on "${s.name}"`);
    if (s.blank) add('fail', 'blank-screen', s, `Blank screen after "${s.name}"`);
    if ((s.visible || []).some(v => /Data unavailable/.test(v))) add('fail', 'data-unavailable', s, `Data unavailable on "${s.name}"`);
    const empty = emptyMs(s);
    if (empty != null && empty >= t.emptyFailMs) add('fail', 'no-content', s, `Nothing to read for ${ms(empty)} on "${s.name}"`);
    else if (empty != null && empty >= t.emptyFrictionMs) add('friction', 'empty-wait', s, `Nothing to read for ${ms(empty)} on "${s.name}"`);
    if (!launch && s.responseMs >= t.unresponsiveMs) add('friction', 'unresponsive', s, `No reaction for ${ms(s.responseMs)} after "${s.name}"`);
    if (s.retapped) add('friction', 'repeated-tap', s, `"${s.name}" needed a second tap`);
    if (s.shifts >= t.layoutJumps) add('friction', 'layout-jump', s, `Layout moved ${s.shifts} times after content showed on "${s.name}"`);
    if (s.errorState) {
      if (s.errorState.action || (actionOnScreen && /^scroll /.test(s.name))) add('friction', 'error-shown', s, `"${s.errorState.text}" shown on "${s.name}"`);
      else add('fail', 'error-no-action', s, `"${s.errorState.text}" with no action on "${s.name}"`);
    }
    actionOnScreen = /^scroll /.test(s.name) ? actionOnScreen || Boolean(s.errorState?.action) : Boolean(s.errorState?.action);
    const ratio = jankRatio(s);
    const base = baseByName.get(s.name);
    const baseRatio = base ? jankRatio(base) : null;
    if (ratio != null && ratio >= t.jankFailRatio) add('fail', 'jank', s, `${Math.round(ratio * 100)}% dropped frames on "${s.name}"`);
    else if (ratio != null && baseRatio != null && ratio - baseRatio >= t.jankRegressionDelta) add('regression', 'jank', s, `Dropped frames ${Math.round(baseRatio * 100)}% to ${Math.round(ratio * 100)}% on "${s.name}"`);
    if (base) {
      const now = contentMs(s);
      const was = contentMs(base);
      if (now >= was * t.regressionFactor && now - was >= t.regressionMinMs) add('regression', 'slower', s, `"${s.name}" content ${ms(was)} to ${ms(now)}`);
      if (s.responseMs != null && base.responseMs != null && s.responseMs >= base.responseMs * t.regressionFactor && s.responseMs - base.responseMs >= t.responseRegressionMinMs) {
        add('regression', 'slower-response', s, `"${s.name}" reaction ${ms(base.responseMs)} to ${ms(s.responseMs)}`);
      }
    }
  }

  const informational = steps.map(s => ({ step: s.n, name: s.name, responseMs: s.responseMs ?? null, firstContentMs: s.firstContentMs ?? null, settleMs: s.settleMs, jankRatio: jankRatio(s) }));
  const outcome = findings.some(f => f.severity === 'fail') ? 'fail' : findings.length ? 'attention' : 'pass';
  return { outcome, findings, informational, baselineVersion: baseline?.app?.versionName ?? null };
}

export function outcomeLine(verdict) {
  const count = sev => verdict.findings.filter(f => f.severity === sev).length;
  const label = { pass: 'PASS', attention: 'ATTENTION', fail: 'FAIL' }[verdict.outcome];
  const vs = verdict.baselineVersion ? ` vs ${verdict.baselineVersion}` : ' (no earlier session)';
  if (verdict.outcome === 'pass') return `Real-use session ${label}${vs}`;
  return `Real-use session ${label}${vs}: ${count('fail')} broken, ${count('friction')} friction, ${count('regression')} slower`;
}

/** Lines that lead a report: outcome first, then what a user would have hit. */
export function renderOutcome(verdict) {
  const lines = [`**${outcomeLine(verdict)}**`, ''];
  const word = { fail: 'Broken', friction: 'Friction', regression: 'Slower' };
  for (const sev of ['fail', 'friction', 'regression']) {
    for (const f of verdict.findings.filter(x => x.severity === sev)) lines.push(`- ${word[sev]}: ${f.text}`);
  }
  if (verdict.findings.length) lines.push('');
  return lines;
}

export function renderSessionCoverage(report) {
  const lines = [];
  const steps = report.steps || [];
  const launch = steps.findIndex(step => step.session && step.name === 'open app');
  if (launch >= 0) {
    const nextLaunch = steps.findIndex((step, index) => index > launch && step.activityStartMs != null);
    // Rates can finish after the launch screenshot. Attribute the trace to the same process launch.
    const boot = steps.slice(launch, nextLaunch < 0 ? steps.length : nextLaunch).find(step => step.boot)?.boot;
    const start = boot?.['js-start'];
    const ready = boot?.['rates-ready'];
    if (Number.isFinite(start) && Number.isFinite(ready) && ready >= start) {
      const elapsed = ready - start;
      const lastBlocker = Object.keys(boot).reverse().find(mark => mark.startsWith('last-'));
      lines.push(`**Initial Rates readiness:** ${ms(elapsed)} from JS start (${elapsed < 3000 ? 'under' : 'at or above'} the 3 s target)${lastBlocker ? ` · last blocker: ${lastBlocker.slice(5)}` : ''}`);
    } else {
      lines.push('**Initial Rates readiness:** no complete boot trace captured');
    }
    lines.push('');
  }
  const journeys = Object.entries(report.journeyCoverage || {});
  if (journeys.length) {
    lines.push('**Extended journeys**', '');
    for (const [name, counts] of journeys) {
      lines.push(`- ${name}: ${counts.passed} passed, ${counts.failed} failed, ${counts.blocked} blocked`);
    }
    lines.push('');
  }
  return lines;
}
