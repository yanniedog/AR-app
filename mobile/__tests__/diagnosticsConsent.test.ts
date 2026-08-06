import { isDiagnosticsConsentTap } from '../src/lib/diagnosticsConsent';

describe('diagnostics consent tap detection', () => {
  it('accepts stationary taps but ignores scrolling and cancelled starts', () => {
    expect(isDiagnosticsConsentTap({ x: 100, y: 200 }, { x: 104, y: 205 })).toBe(true);
    expect(isDiagnosticsConsentTap({ x: 100, y: 200 }, { x: 100, y: 220 })).toBe(false);
    expect(isDiagnosticsConsentTap(null, { x: 100, y: 200 })).toBe(false);
  });
});
