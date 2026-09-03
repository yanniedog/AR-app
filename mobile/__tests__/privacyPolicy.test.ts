import {
  OPTIONAL_DIAGNOSTICS_TERMS,
  PRIVACY_RUNTIME_POLICY,
} from '../src/lib/privacyPolicy';

describe('privacy disclosure contract', () => {
  it('matches the fail-closed runtime policy', () => {
    expect(PRIVACY_RUNTIME_POLICY).toEqual(expect.objectContaining({
      crashReportsRequireConsent: true,
      crashReportsUseFixedCategoriesOnly: true,
      appHealthAutomaticUpload: false,
      debugLogAutomaticUpload: false,
      sessionReplayCollected: false,
    }));
    expect(OPTIONAL_DIAGNOSTICS_TERMS).toContain('Only after you opt in');
    expect(OPTIONAL_DIAGNOSTICS_TERMS).toContain('fixed technical error categories');
    expect(OPTIONAL_DIAGNOSTICS_TERMS).toContain('app-health results');
    expect(OPTIONAL_DIAGNOSTICS_TERMS).toContain('Session replay is not collected');
    expect(OPTIONAL_DIAGNOSTICS_TERMS).not.toContain('performance-audit summary');
  });
});
