import {
  LENDER_ARTWORK_TERMS,
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

  it('discloses verified remote lender artwork without implying user inputs are sent', () => {
    expect(LENDER_ARTWORK_TERMS).toContain('integrity-checked rates data');
    expect(LENDER_ARTWORK_TERMS).toContain('IP address');
    expect(LENDER_ARTWORK_TERMS).toContain('does not include your searches');
    expect(LENDER_ARTWORK_TERMS).toContain('app-health audit');
  });
});
