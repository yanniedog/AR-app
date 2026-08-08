import {
  boundAuditCheckEvidence,
  compactAuditCheckForLog,
  compactAuditLogJson,
  compactPerformanceAuditReportForLog,
  MAX_AUDIT_EVIDENCE_CHARS,
  MAX_AUDIT_METRIC_TEXT_CHARS,
  omitNullishDeep,
  shortenAuditEvidenceText,
  truncateAuditText,
} from '../src/lib/performanceAuditLog';

describe('bounded audit evidence', () => {
  it('leaves a check within budget untouched', () => {
    const check = {
      id: 'c1',
      metrics: { readinessProbes: 'browse.data:ready' },
      error: 'short failure',
      trace: 'short trace',
    };

    expect(boundAuditCheckEvidence(check)).toBe(check);
  });

  it('caps stacks, traces and long string metrics', () => {
    const bounded = boundAuditCheckEvidence({
      id: 'c2',
      metrics: {
        readinessProbes: 'p'.repeat(MAX_AUDIT_METRIC_TEXT_CHARS + 500),
        forwardMs: 12,
        reason: null,
      },
      error: 'e'.repeat(MAX_AUDIT_EVIDENCE_CHARS + 5_000),
      trace: 't'.repeat(MAX_AUDIT_EVIDENCE_CHARS + 5_000),
    });

    expect(bounded.error?.length).toBeLessThan(MAX_AUDIT_EVIDENCE_CHARS + 64);
    expect(bounded.trace?.length).toBeLessThan(MAX_AUDIT_EVIDENCE_CHARS + 64);
    expect(bounded.error).toContain('truncated 5000 chars');
    expect(String(bounded.metrics.readinessProbes).length)
      .toBeLessThan(MAX_AUDIT_METRIC_TEXT_CHARS + 64);
    // Non-string and short metrics survive unchanged.
    expect(bounded.metrics.forwardMs).toBe(12);
    expect(bounded.metrics.reason).toBeNull();
  });

  it('keeps a whole deep-audit report inside a bounded serialized budget', () => {
    const stack = `${'stack frame line\n'.repeat(400)}`;
    const checks = Array.from({ length: 260 }, (_, index) => boundAuditCheckEvidence({
      id: `deep-step-${index}`,
      metrics: { readinessProbes: 'p'.repeat(4_000) },
      error: stack,
      trace: stack,
    }));

    const unbounded = JSON.stringify(
      Array.from({ length: 260 }, () => ({ error: stack, trace: stack })),
    );
    const encoded = JSON.stringify(checks);

    expect(unbounded.length).toBeGreaterThan(3_000_000);
    expect(encoded.length).toBeLessThan(1_500_000);
  });

  it('reports how much evidence was dropped', () => {
    expect(truncateAuditText('abcdef', 3)).toBe('abc…[truncated 3 chars]');
    expect(truncateAuditText('abc', 3)).toBe('abc');
  });
});

describe('performanceAuditLog compaction', () => {
  it('omits nullish fields deeply', () => {
    expect(omitNullishDeep({ a: 1, b: null, c: { d: undefined, e: 2 } })).toEqual({
      a: 1,
      c: { e: 2 },
    });
  });

  it('shortens long content hashes while preserving probe text', () => {
    const sha = 'e5ed9d7c0831dba30dace233f4f9c7a6d943331e3811733b3d495795e4cabe6b';
    expect(shortenAuditEvidenceText(`browse.data:data:ready::${sha}:`)).toBe(
      'browse.data:data:ready::e5ed9d7c0831…:',
    );
  });

  it('keeps fail metrics but skinnies pass rows', () => {
    const pass = compactAuditCheckForLog({
      id: 'p1',
      label: 'pass row',
      kind: 'journey',
      status: 'pass',
      durationMs: 10,
      metrics: {
        iteration: 'cold',
        maxEventLoopLagMs: 12,
        maxFrameGapMs: 14,
        readinessEvidence: 'x',
      },
    });
    expect(pass).toEqual({
      id: 'p1',
      label: 'pass row',
      kind: 'journey',
      status: 'pass',
      durationMs: 10,
      phase: 'cold',
      maxEventLoopLagMs: 12,
      maxFrameGapMs: 14,
    });

    const fail = compactAuditCheckForLog({
      id: 'f1',
      label: 'fail row',
      kind: 'journey',
      status: 'fail',
      durationMs: 20,
      metrics: {
        maxEventLoopLagMs: 400,
        readinessEvidence: null,
        note: 'kept',
      },
      error: 'boom',
      trace: null,
    });
    expect(fail.error).toBe('boom');
    expect(fail.metrics).toEqual({ maxEventLoopLagMs: 400, note: 'kept' });
    expect(fail).not.toHaveProperty('trace');
  });

  it('compacts full reports for paste upload without dropping fail signal', () => {
    const sha = 'e5ed9d7c0831dba30dace233f4f9c7a6d943331e3811733b3d495795e4cabe6b';
    const compact = compactPerformanceAuditReportForLog({
      schemaVersion: 4,
      sessionId: 's1',
      app: { appVersion: '1.0.0', buildVersion: '1' },
      summary: { overall: 'bottleneck', pass: 1, warn: 0, fail: 1 },
      plan: {
        schemaVersion: 1,
        inputs: { provider: 'AFG' },
        passes: [{ steps: [{}, {}] }, { steps: [{}] }],
      },
      checks: [
        {
          id: 'ok',
          label: 'ok',
          kind: 'journey',
          status: 'pass',
          durationMs: 1,
          metrics: { maxEventLoopLagMs: 1, readinessEvidence: `x:${sha}` },
        },
        {
          id: 'bad',
          label: 'bad',
          kind: 'journey',
          status: 'fail',
          durationMs: 2,
          metrics: { maxEventLoopLagMs: 500, readinessEvidence: `y:${sha}` },
          error: 'nope',
        },
      ],
      limitations: ['a', 'b', 'c', 'd', 'e'],
      blob: 'O'.repeat(100_000),
    }) as Record<string, unknown>;

    expect(compact.blob).toBeUndefined();
    expect(compact.limitations).toEqual(['a', 'b', 'c', 'd']);
    expect(compact.plan).toEqual({
      schemaVersion: 1,
      inputs: { provider: 'AFG' },
      passCount: 2,
      stepCount: 3,
    });
    const checks = compact.checks as Record<string, unknown>[];
    expect(checks[0]).not.toHaveProperty('metrics');
    expect((checks[1].metrics as Record<string, unknown>).readinessEvidence).toContain('e5ed9d7c0831…');
    expect(checks[1].error).toBe('nope');

    const encoded = compactAuditLogJson(compact);
    expect(encoded.length).toBeLessThan(2_000);
    expect(encoded).not.toContain(sha);
  });
});
