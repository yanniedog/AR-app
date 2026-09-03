import type { AssetState } from './assetState';
import { coverageFailures, coverageFailureProvenanceReported } from './coverage';
import type { PayloadCoverage, PayloadSource } from '../types';

export type DisplayEvidenceKind =
  | 'current'
  | 'partial'
  | 'saved'
  | 'overdue'
  | 'sample'
  | 'offline'
  | 'unavailable'
  | 'loading';

export type DisplayEvidenceTone = 'positive' | 'caution' | 'neutral' | 'danger';
export type DisplayCoverageState = 'complete' | 'partial' | 'unknown';
export type DisplayAssetStatus = AssetState<unknown>['status'];

export interface DisplayEvidence {
  kind: DisplayEvidenceKind;
  tone: DisplayEvidenceTone;
  label: string;
  detail: string;
  observedOn: string | null;
  coverageState: DisplayCoverageState;
  facts: readonly string[];
}

export interface DisplayEvidenceInput {
  source: PayloadSource;
  offline: boolean;
  runDate?: string | null;
  coverage?: PayloadCoverage | null;
  assetStatus?: DisplayAssetStatus;
  /** Reason from an independently validated asset state. */
  assetReason?: string | null;
  /** Explicitly says whether a usable last-known-good value exists. */
  hasUsableData?: boolean;
  /** Producer/scheduler threshold after which this observation is overdue. */
  overdueAfterUtc?: string | null;
  scheduleLabel?: string | null;
  now?: Date;
}

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

function safeDay(value: string | null | undefined): string | null {
  const day = String(value ?? '').slice(0, 10);
  const match = YMD.exec(day);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, date));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === date
    ? day
    : null;
}

function localDay(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatEvidenceDate(value: string | null | undefined): string {
  const day = safeDay(value);
  if (!day) return 'Date not provided';
  const match = YMD.exec(day)!;
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  ).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function safeCount(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : null;
}

function coverageSummary(coverage: PayloadCoverage | null | undefined): {
  state: DisplayCoverageState;
  attempted: number | null;
  succeeded: number | null;
  partial: number;
  failed: number;
  failures: ReturnType<typeof coverageFailures>;
} {
  const attempted = safeCount(coverage?.providers_attempted);
  const succeeded = safeCount(coverage?.providers_succeeded);
  const reportedPartial = safeCount(coverage?.counts?.providers_partial);
  const reportedFailed = safeCount(coverage?.counts?.providers_failed);
  const partial = reportedPartial ?? 0;
  const failures = coverageFailures(coverage);
  // Current payloads list every affected provider in `provider_failures`,
  // including providers whose observation was only partial. Prefer the
  // producer's reconciled split count when it is present; the list length is
  // only a legacy fallback when no failed-provider count was published.
  const failed = reportedFailed ?? failures.length;
  const partialState = partial > 0
    || failed > 0
    || (attempted !== null && succeeded !== null && succeeded < attempted);
  const completeState = !partialState
    && attempted !== null
    && attempted > 0
    && succeeded !== null
    && succeeded === attempted
    && reportedPartial === 0
    && (reportedFailed === 0
      || (coverageFailureProvenanceReported(coverage) && failures.length === 0));
  return {
    state: partialState ? 'partial' : completeState ? 'complete' : 'unknown',
    attempted,
    succeeded,
    partial,
    failed,
    failures,
  };
}

function sourceLabel(source: PayloadSource): string {
  if (source === 'remote') return 'Verified remote payload';
  if (source === 'cache') return 'Saved on-device copy';
  return 'Bundled sample data';
}

function isOverdue(value: string | null | undefined, now: Date): boolean {
  if (!value) return false;
  const deadline = Date.parse(value);
  return Number.isFinite(deadline) && now.getTime() > deadline;
}

/** Align product surfaces with the app-health freshness contract. */
export function freshnessDeadlineUtc(
  nextDueUtc: string | null | undefined,
  graceMs: number,
): string | null {
  if (!nextDueUtc || !Number.isFinite(graceMs) || graceMs < 0) return null;
  const dueMs = Date.parse(nextDueUtc);
  if (!Number.isFinite(dueMs)) return null;
  return new Date(dueMs + graceMs).toISOString();
}

/**
 * Convert transport, freshness and coverage truth into one reusable disclosure.
 * It never infers full coverage merely from the absence of a displayed error.
 */
export function mapDisplayEvidence(input: DisplayEvidenceInput): DisplayEvidence {
  const now = input.now ?? new Date();
  const observedOn = safeDay(input.runDate ?? input.coverage?.observed_on ?? input.coverage?.observed_at);
  const coverage = coverageSummary(input.coverage);
  const hasUsableData = input.hasUsableData
    ?? Boolean(observedOn || (input.assetStatus && ['live', 'cached', 'sample', 'partial'].includes(input.assetStatus)));
  const facts: string[] = [
    `Source: ${sourceLabel(input.source)}`,
    observedOn ? `Observed: ${formatEvidenceDate(observedOn)}` : 'Observed: date not provided',
  ];

  if (coverage.attempted !== null) facts.push(`Providers attempted: ${coverage.attempted}`);
  if (coverage.succeeded !== null) facts.push(`Providers succeeded: ${coverage.succeeded}`);
  if (coverage.partial > 0) facts.push(`Partial provider observations: ${coverage.partial}`);
  if (coverage.failed > 0) facts.push(`Failed provider observations: ${coverage.failed}`);
  const namedFailureLimit = 12;
  for (const failure of coverage.failures.slice(0, namedFailureLimit)) {
    facts.push(`Coverage issue: ${failure.provider}${failure.reason ? ` — ${failure.reason}` : ''}`);
  }
  if (coverage.failures.length > namedFailureLimit) {
    facts.push(`Additional named coverage issues: ${coverage.failures.length - namedFailureLimit}`);
  }
  for (const limitation of input.coverage?.limitations ?? []) {
    if (limitation.trim()) facts.push(`Limitation: ${limitation.trim()}`);
  }
  if (input.scheduleLabel) facts.push(`Update schedule: ${input.scheduleLabel}`);
  if (input.assetReason) facts.push(`Asset state: ${input.assetReason}`);

  if (input.assetStatus === 'loading') {
    return {
      kind: 'loading', tone: 'neutral',
      label: hasUsableData ? 'Checking for update' : 'Checking data',
      detail: hasUsableData
        ? 'Showing the last verified observation while a newer publication is checked.'
        : 'Waiting for a verified data set.',
      observedOn, coverageState: coverage.state, facts,
    };
  }

  if (!hasUsableData && (input.assetStatus === 'unavailable' || input.assetStatus === 'error')) {
    return {
      kind: 'unavailable', tone: 'danger', label: 'Data unavailable',
      detail: input.assetReason || 'No verified data is available for this view.',
      observedOn, coverageState: coverage.state, facts,
    };
  }

  if (input.source === 'sample' || input.assetStatus === 'sample') {
    return {
      kind: 'sample', tone: 'caution', label: 'Sample data',
      detail: 'Illustrative figures only; they are not the latest published rates.',
      observedOn, coverageState: coverage.state, facts,
    };
  }

  if (!hasUsableData) {
    return {
      kind: 'unavailable', tone: 'danger', label: 'Data unavailable',
      detail: input.assetReason || 'No verified data is available for this view.',
      observedOn, coverageState: coverage.state, facts,
    };
  }

  if (coverage.state === 'partial' || input.assetStatus === 'partial') {
    const issue = [
      coverage.partial > 0 ? `${coverage.partial} partial` : null,
      coverage.failed > 0 ? `${coverage.failed} failed` : null,
    ].filter(Boolean).join(' · ');
    return {
      kind: 'partial', tone: 'caution', label: 'Partial coverage',
      detail: `${observedOn ? `Observed ${formatEvidenceDate(observedOn)}` : 'Observation date not provided'}${issue ? ` · ${issue}` : ''}.`,
      observedOn, coverageState: 'partial', facts,
    };
  }

  const overdue = isOverdue(input.overdueAfterUtc, now);
  if (input.offline) {
    return {
      kind: 'offline', tone: overdue ? 'danger' : 'neutral',
      label: overdue ? 'Offline · update overdue' : 'Offline',
      detail: observedOn
        ? `Showing a saved copy from ${formatEvidenceDate(observedOn)}${overdue ? '; its scheduled update is overdue' : ''}.`
        : overdue
          ? 'Showing saved data; its scheduled update is overdue and no observation date was provided.'
          : 'Showing saved data; its observation date was not provided.',
      observedOn, coverageState: coverage.state, facts,
    };
  }

  if (overdue) {
    return {
      kind: 'overdue', tone: 'danger', label: 'Update overdue',
      detail: observedOn
        ? `Latest verified observation is ${formatEvidenceDate(observedOn)}.`
        : 'A scheduled update is late and no observation date was provided.',
      observedOn, coverageState: coverage.state, facts,
    };
  }

  if (input.source === 'cache' || input.assetStatus === 'cached' || input.assetStatus === 'error') {
    return {
      kind: 'saved', tone: input.assetStatus === 'error' ? 'caution' : 'neutral', label: 'Saved copy',
      detail: observedOn
        ? `Observed ${formatEvidenceDate(observedOn)}.`
        : 'The observation date was not provided.',
      observedOn, coverageState: coverage.state, facts,
    };
  }

  const today = observedOn === localDay(now);
  const coverageSuffix = coverage.state === 'complete' ? ' · full coverage' : '';
  return {
    kind: 'current', tone: 'positive',
    label: today ? `Updated today${coverageSuffix}` : 'Latest verified data',
    detail: observedOn
      ? `Observed ${formatEvidenceDate(observedOn)}${coverage.state === 'complete' ? ' · all attempted providers succeeded' : ''}.`
      : 'Observation date not provided; coverage is not claimed.',
    observedOn,
    coverageState: coverage.state,
    facts,
  };
}
