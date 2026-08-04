import type { CoverageFailure, PayloadCoverage } from '../types';

export function coverageFailures(coverage: PayloadCoverage | null | undefined): CoverageFailure[] {
  if (coverage?.provider_failures?.length) return coverage.provider_failures;
  return coverage?.failures ?? [];
}

export function coverageObservedAt(coverage: PayloadCoverage | null | undefined): string | null {
  const value = coverage?.observed_on ?? coverage?.observed_at ?? '';
  const observedDate = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(observedDate) ? observedDate : null;
}

export function coverageProvidersSucceeded(
  coverage: PayloadCoverage | null | undefined,
): number | null {
  return coverage?.providers_succeeded ?? coverage?.counts?.brands_observed ?? null;
}

export function coverageProvidersAttempted(
  coverage: PayloadCoverage | null | undefined,
): number | null {
  if (coverage?.providers_attempted != null) return coverage.providers_attempted;
  const succeeded = coverageProvidersSucceeded(coverage);
  if (succeeded == null) return null;
  return succeeded + (coverage?.counts?.providers_failed ?? 0);
}
