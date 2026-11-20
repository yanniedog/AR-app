// Pass/fail for a real-use session. A person judges the app by whether it crashed, froze,
// showed nothing or got slower than last time, not by emulator-scaled millisecond budgets.
// Absolute timings stay in the report as information only.

export const THRESHOLDS = {
  stuckSpinnerMs: 15000,
  noContentMs: 20000,
  jankFailRatio: 0.6,
  jankRegressionDelta: 0.15,
  jankMinFrames: 20,
  regressionFactor: 1.5,
  regressionMinMs: 1500,
  responseRegressionMinMs: 1000,
};

const ms = n => `${(n / 1000).toFixed(1)} s`;
const contentMs = s => (Number.isFinite(s.firstContentMs) ? s.firstContentMs : s.settleMs);

/** Steps that belong to the session (named by the driver) or all steps when none are tagged. */
export function sessionSteps(report) {
  const tagged = (report.steps || []).filter(s => s.session);
  return tagged.length ? tagged : report.steps || [];
}

function jankRatio(s) {
  const f = s.frames || {};
  return f.frames >= THRESHOLDS.jankMinFrames ? f.janky / f.frames : null;
}

/**
 * @param report  explorer report.json
 * @param baseline previous session report.json, or null
 * @returns {{outcome:'pass'|'regression'|'fail', findings:object[], informational:object[], baselineVersion:string|null}}
 */
export function computeVerdict(report, baseline) {
  const t = THRESHOLDS;
  const steps = sessionSteps(report);
  const baseByName = new Map(((baseline && baseline.steps) || []).map(s => [s.name, s]));
  const findings = [];
  const add = (severity, kind, step, text) => findings.push({ severity, kind, step: step.n, name: step.name, text });

  for (const s of steps) {
    if (s.alive === false) add('fail', 'crash', s, `App crashed on "${s.name}"`);
    if (s.anr) add('fail', 'anr', s, `App stopped responding on "${s.name}"`);
    if (s.error) add('fail', 'journey', s, `"${s.name}" could not finish: ${s.error}`);
    if (s.maxLoadingMs >= t.stuckSpinnerMs) add('fail', 'stuck-spinner', s, `Spinner stayed ${ms(s.maxLoadingMs)} on "${s.name}"`);
    else if (s.settleTimedOut && !s.error) add('fail', 'never-settled', s, `Screen never stopped changing on "${s.name}"`);
    if (s.blank) add('fail', 'blank-screen', s, `Blank screen after "${s.name}"`);
    else if (s.firstContentMs == null && s.settleTimedOut === false && s.settleMs >= t.noContentMs) add('fail', 'no-content', s, `No content for ${ms(s.settleMs)} on "${s.name}"`);
    if ((s.visible || []).some(v => /Data unavailable/.test(v))) add('fail', 'data-unavailable', s, `Data unavailable shown on "${s.name}"`);
    const ratio = jankRatio(s);
    const base = baseByName.get(s.name);
    const baseRatio = base ? jankRatio(base) : null;
    if (ratio != null && ratio >= t.jankFailRatio) add('fail', 'jank', s, `${Math.round(ratio * 100)}% dropped frames on "${s.name}"`);
    else if (ratio != null && baseRatio != null && ratio - baseRatio >= t.jankRegressionDelta) add('regression', 'jank', s, `Dropped frames up from ${Math.round(baseRatio * 100)}% to ${Math.round(ratio * 100)}% on "${s.name}"`);
    if (base) {
      const now = contentMs(s);
      const was = contentMs(base);
      if (now >= was * t.regressionFactor && now - was >= t.regressionMinMs) add('regression', 'slower', s, `"${s.name}" shows content in ${ms(now)}, was ${ms(was)}`);
      if (s.responseMs != null && base.responseMs != null && s.responseMs >= base.responseMs * t.regressionFactor && s.responseMs - base.responseMs >= t.responseRegressionMinMs) {
        add('regression', 'slower-response', s, `"${s.name}" reacts to a tap in ${ms(s.responseMs)}, was ${ms(base.responseMs)}`);
      }
    }
  }

  const informational = steps.map(s => ({ step: s.n, name: s.name, responseMs: s.responseMs ?? null, firstContentMs: s.firstContentMs ?? null, settleMs: s.settleMs, jankRatio: jankRatio(s) }));
  const outcome = findings.some(f => f.severity === 'fail') ? 'fail' : findings.length ? 'regression' : 'pass';
  return { outcome, findings, informational, baselineVersion: baseline?.app?.versionName ?? null };
}

export function outcomeLine(verdict) {
  const fails = verdict.findings.filter(f => f.severity === 'fail').length;
  const regs = verdict.findings.length - fails;
  const label = { pass: 'PASS', regression: 'REGRESSION', fail: 'FAIL' }[verdict.outcome];
  const vs = verdict.baselineVersion ? ` vs ${verdict.baselineVersion}` : ' (no earlier session to compare)';
  if (verdict.outcome === 'pass') return `Real-use session ${label}${vs}: no crash, freeze, blank screen or slowdown`;
  return `Real-use session ${label}${vs}: ${fails} user-visible problem${fails === 1 ? '' : 's'}, ${regs} slower than last build`;
}

/** Markdown block that leads reports: outcome first, then what a user would have seen. */
export function renderOutcome(verdict) {
  const lines = [`**${outcomeLine(verdict)}**`, ''];
  for (const f of verdict.findings) lines.push(`- ${f.severity === 'fail' ? 'Broken' : 'Slower'}: ${f.text}`);
  if (verdict.findings.length) lines.push('');
  return lines;
}
