/** Closed coverage/status presentation; reason and limitation prose never leaves this adapter. */
export type EvidenceSource = 'remote' | 'cache' | 'sample';
export type EvidenceAssetStatus = 'loading' | 'live' | 'cached' | 'sample' | 'partial' | 'unavailable' | 'error';
export type EvidenceKind = 'current' | 'partial' | 'saved' | 'overdue' | 'sample' | 'offline' | 'unavailable' | 'loading';
export type EvidenceTone = 'positive' | 'caution' | 'neutral' | 'danger';
export type EvidenceCoverageState = 'complete' | 'partial' | 'unknown';
interface CoverageInput {
  providers_attempted?: number;
  providers_succeeded?: number;
  observed_on?: string;
  observed_at?: string;
  counts?: { providers_partial?: number; providers_failed?: number };
  provider_failures?: readonly { provider: string; status?: string; reason?: string }[];
  failures?: readonly { provider: string; status?: string; reason?: string }[];
  limitations?: readonly string[];
}
export interface EvidenceInput {
  source: EvidenceSource;
  offline: boolean;
  runDate?: string | null;
  coverage?: CoverageInput | null;
  assetStatus?: EvidenceAssetStatus;
  assetReason?: string | null;
  hasUsableData?: boolean;
  overdueAfterUtc?: string | null;
  scheduleLabel?: string | null;
  now?: Date;
}

export type EvidenceFact =
  | { readonly kind: 'source'; readonly value: EvidenceSource }
  | { readonly kind: 'observed'; readonly state: 'known'; readonly day: string }
  | { readonly kind: 'observed'; readonly state: 'unknown' }
  | { readonly kind: 'coverage'; readonly value: EvidenceCoverageState }
  | { readonly kind: 'providers-attempted' | 'providers-succeeded' | 'providers-partial' | 'providers-failed'; readonly state: 'known'; readonly count: number }
  | { readonly kind: 'providers-attempted' | 'providers-succeeded' | 'providers-partial' | 'providers-failed'; readonly state: 'unknown' }
  | { readonly kind: 'provider-issue'; readonly ordinal: number; readonly provider: string; readonly state: 'partial' | 'failed' | 'unknown' }
  | { readonly kind: 'coverage-limitations'; readonly count: number }
  | { readonly kind: 'asset-status'; readonly value: EvidenceAssetStatus }
  | { readonly kind: 'update-deadline'; readonly state: 'known'; readonly utc: string }
  | { readonly kind: 'update-deadline'; readonly state: 'unknown' }
  | { readonly kind: 'connection'; readonly value: 'online' | 'offline' };

export interface EvidencePresentation {
  readonly kind: EvidenceKind;
  readonly tone: EvidenceTone;
  readonly observedToday: boolean;
  readonly facts: readonly EvidenceFact[];
}

function safeDay(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}(?:T[\d:.+\-Z]+)?$/.test(value) || !Number.isFinite(Date.parse(value))) return null;
  const day = String(value ?? '').slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]), date = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, date));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === date ? day : null;
}
function safeCount(value: number | undefined): number | null {
  return typeof value === 'number' && value >= 0 && Number.isSafeInteger(value) ? value : null;
}
function safeDeadline(value: string | null | undefined): string | null {
  if (!value || !safeDay(value) || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  const millis = Date.parse(value);
  return Number.isFinite(millis) ? new Date(millis).toISOString() : null;
}

/** Raw reasons/limitations/schedule prose are never returned as display values. */
export function displayEvidenceFacts(input: EvidenceInput): EvidencePresentation {
  const now = input.now ?? new Date();
  const observedOn = safeDay(input.runDate ?? input.coverage?.observed_on ?? input.coverage?.observed_at);
  const coverage = input.coverage;
  const attempted = safeCount(coverage?.providers_attempted);
  const succeeded = safeCount(coverage?.providers_succeeded);
  const partial = safeCount(coverage?.counts?.providers_partial);
  const reportedFailed = safeCount(coverage?.counts?.providers_failed);
  const failures = coverage?.provider_failures ?? coverage?.failures ?? [];
  const failureProvenance = Array.isArray(coverage?.provider_failures) || Array.isArray(coverage?.failures);
  const failed = reportedFailed ?? (failureProvenance ? failures.length : null);
  const partialState = (partial ?? 0) > 0 || (failed ?? 0) > 0
    || (attempted !== null && succeeded !== null && succeeded < attempted);
  const complete = !partialState && attempted !== null && attempted > 0
    && succeeded === attempted && partial === 0
    && (reportedFailed === 0 || (failureProvenance && failures.length === 0));
  const state: EvidenceCoverageState = partialState ? 'partial' : complete ? 'complete' : 'unknown';
  const deadline = safeDeadline(input.overdueAfterUtc);
  const overdue = deadline !== null && now.getTime() > Date.parse(deadline);
  const usable = input.hasUsableData ?? Boolean(observedOn || (input.assetStatus && ['live', 'cached', 'sample', 'partial'].includes(input.assetStatus)));
  const facts: EvidenceFact[] = [{ kind: 'source', value: input.source },
    observedOn === null ? { kind: 'observed', state: 'unknown' } : { kind: 'observed', state: 'known', day: observedOn },
    { kind: 'coverage', value: state }, { kind: 'connection', value: input.offline ? 'offline' : 'online' }];
  for (const [kind, count] of [
    ['providers-attempted', attempted], ['providers-succeeded', succeeded],
    ['providers-partial', partial], ['providers-failed', failed],
  ] as const) facts.push(count === null ? { kind, state: 'unknown' } : { kind, state: 'known', count });
  failures.forEach((failure, ordinal) => facts.push({ kind: 'provider-issue', ordinal, provider: failure.provider,
    state: failure.status === 'partial' || failure.status === 'failed' ? failure.status : 'unknown' }));
  const limitationCount = (coverage?.limitations ?? []).filter(value => typeof value === 'string' && value.trim()).length;
  if (limitationCount > 0) facts.push({ kind: 'coverage-limitations', count: limitationCount });
  if (input.assetStatus) facts.push({ kind: 'asset-status', value: input.assetStatus });
  facts.push(deadline ? { kind: 'update-deadline', state: 'known', utc: deadline } : { kind: 'update-deadline', state: 'unknown' });
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const observedToday = observedOn === localToday;
  const result = (kind: EvidenceKind, tone: EvidenceTone): EvidencePresentation => ({ kind, tone, observedToday, facts });
  if (input.assetStatus === 'loading') return result('loading', 'neutral');
  if (!usable && (input.assetStatus === 'unavailable' || input.assetStatus === 'error')) return result('unavailable', 'danger');
  if (input.source === 'sample' || input.assetStatus === 'sample') return result('sample', 'caution');
  if (!usable) return result('unavailable', 'danger');
  if (state === 'partial' || input.assetStatus === 'partial') return result('partial', 'caution');
  if (input.offline) return result('offline', overdue ? 'danger' : 'neutral');
  if (overdue) return result('overdue', 'danger');
  if (input.source === 'cache' || input.assetStatus === 'cached' || input.assetStatus === 'error') return result('saved', input.assetStatus === 'error' ? 'caution' : 'neutral');
  return result('current', 'positive');
}
