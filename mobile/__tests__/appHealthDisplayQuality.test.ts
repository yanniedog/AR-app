import { makeCompleteDisplayFixture } from '../__fixtures__/appHealth';
import { evaluateAppHealthDisplayQuality } from '../src/lib/appHealth/displayQuality';
import { APP_HEALTH_CHECK_CODES, type AppHealthCheck } from '../src/lib/appHealth/types';

function byCode(checks: readonly AppHealthCheck[], code: AppHealthCheck['code']): AppHealthCheck {
  const found = checks.find((check) => check.code === code);
  if (!found) throw new Error(`Missing check: ${code}`);
  return found;
}

describe('app-health display quality', () => {
  it('accepts independent source, model, render, visibility, layout, chart, and logo evidence', () => {
    const { contracts, observations } = makeCompleteDisplayFixture();
    const checks = evaluateAppHealthDisplayQuality(contracts, observations);

    expect(checks).toHaveLength(8);
    expect(checks.every((check) => check.status === 'pass')).toBe(true);
  });

  it('fails when source data exists but the model and list are empty', () => {
    const { contracts, observations } = makeCompleteDisplayFixture();
    observations[0].evidence = observations[0].evidence.map((evidence) => {
      if (evidence.role === 'model') return { ...evidence, modelCount: 0 };
      if (evidence.role === 'list') return { ...evidence, modelCount: 3, renderedCount: 0 };
      return evidence;
    });

    const checks = evaluateAppHealthDisplayQuality(contracts, observations);

    expect(byCode(checks, APP_HEALTH_CHECK_CODES.DISPLAY_MODEL).status).toBe('fail');
    expect(byCode(checks, APP_HEALTH_CHECK_CODES.DISPLAY_LIST).status).toBe('fail');
  });

  it('detects content that rendered off-screen or clipped and missing chart accessibility', () => {
    const { contracts, observations } = makeCompleteDisplayFixture();
    observations[0].evidence = observations[0].evidence.map((evidence) => {
      if (evidence.role === 'visible') return { ...evidence, visibleCount: 0 };
      if (evidence.role === 'critical-layout') return { ...evidence, clipped: true };
      if (evidence.role === 'chart') return { ...evidence, accessibleSummary: false };
      return evidence;
    });

    const checks = evaluateAppHealthDisplayQuality(contracts, observations);

    expect(byCode(checks, APP_HEALTH_CHECK_CODES.DISPLAY_VISIBILITY).status).toBe('fail');
    expect(byCode(checks, APP_HEALTH_CHECK_CODES.DISPLAY_LAYOUT).status).toBe('fail');
    expect(byCode(checks, APP_HEALTH_CHECK_CODES.DISPLAY_CHART).status).toBe('fail');
  });

  it('accepts callback-backed layout evidence without dimensions but rejects invalid supplied dimensions', () => {
    const callbackFixture = makeCompleteDisplayFixture();
    callbackFixture.observations[0].evidence = callbackFixture.observations[0].evidence.map(
      (evidence) => evidence.role === 'critical-layout'
        ? { ...evidence, width: null, height: null }
        : evidence,
    );
    expect(
      byCode(
        evaluateAppHealthDisplayQuality(callbackFixture.contracts, callbackFixture.observations),
        APP_HEALTH_CHECK_CODES.DISPLAY_LAYOUT,
      ).status,
    ).toBe('pass');

    const invalidFixture = makeCompleteDisplayFixture();
    invalidFixture.observations[0].evidence = invalidFixture.observations[0].evidence.map(
      (evidence) => evidence.role === 'critical-layout'
        ? { ...evidence, width: 0, height: 480 }
        : evidence,
    );
    expect(
      byCode(
        evaluateAppHealthDisplayQuality(invalidFixture.contracts, invalidFixture.observations),
        APP_HEALTH_CHECK_CODES.DISPLAY_LAYOUT,
      ).status,
    ).toBe('fail');
  });

  it('distinguishes a decoded logo from a fallback and a missing asset', () => {
    const fallbackFixture = makeCompleteDisplayFixture();
    fallbackFixture.observations[0].evidence = fallbackFixture.observations[0].evidence.map(
      (evidence) =>
        evidence.role === 'logo'
          ? { ...evidence, decodedCount: 2, fallbackCount: 1 }
          : evidence,
    );
    expect(
      byCode(
        evaluateAppHealthDisplayQuality(
          fallbackFixture.contracts,
          fallbackFixture.observations,
        ),
        APP_HEALTH_CHECK_CODES.DISPLAY_LOGO,
      ).status,
    ).toBe('warn');

    const missingFixture = makeCompleteDisplayFixture();
    missingFixture.observations[0].evidence = missingFixture.observations[0].evidence.map(
      (evidence) =>
        evidence.role === 'logo'
          ? { ...evidence, decodedCount: 2, missingCount: 1 }
          : evidence,
    );
    expect(
      byCode(
        evaluateAppHealthDisplayQuality(
          missingFixture.contracts,
          missingFixture.observations,
        ),
        APP_HEALTH_CHECK_CODES.DISPLAY_LOGO,
      ).status,
    ).toBe('fail');
  });

  it('fails closed on missing surfaces or duplicate evidence roles', () => {
    const { contracts, observations } = makeCompleteDisplayFixture();
    const missing = evaluateAppHealthDisplayQuality(contracts, []);
    expect(byCode(missing, APP_HEALTH_CHECK_CODES.DISPLAY_CONTRACT).status).toBe('fail');

    observations[0].evidence = [observations[0].evidence[0], ...observations[0].evidence];
    const duplicate = evaluateAppHealthDisplayQuality(contracts, observations);
    expect(byCode(duplicate, APP_HEALTH_CHECK_CODES.DISPLAY_CONTRACT).status).toBe('fail');
  });
});
