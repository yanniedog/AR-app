import { cache } from './cache';
import {
  ABS_CPI_RELEASE_URL,
  ABS_HEADLINE_CPI_URL,
  ECONOMIC_RECHECK_MS,
  ECONOMIC_SOURCE_KEYS,
  RBA_ECONOMIC_TABLE_URL,
  type CashRateForecast,
  type EconomicIndicator,
  type EconomicIndicatorId,
  type EconomicOutlookPayload,
  type EconomicPoint,
  type ParsedSeries,
  type RequiredSourceKey,
} from './economicOutlookTypes';
import {
  httpDateToIso,
  parseAbsCpiCsv,
  parseCashForecastCsv,
  parseCashRateTargetCsv,
  parseRbaSeriesCsv,
  preferNewerSeries,
} from './economicOutlookParse';
import {
  INDICATOR_DEFINITIONS,
  URLS,
  buildIndicator,
  indicatorIsStale,
} from './economicOutlookSignal';

export type {
  CashRateForecast,
  EconomicIndicator,
  EconomicIndicatorId,
  EconomicOutlookPayload,
  EconomicPoint,
  EconomicPressure,
  EconomicSignal,
} from './economicOutlookTypes';

export {
  ABS_CPI_RELEASE_URL,
  ABS_HEADLINE_CPI_URL,
  ECONOMIC_RECHECK_MS,
  RBA_ECONOMIC_TABLE_URL,
} from './economicOutlookTypes';

export {
  absPeriodToIsoDate,
  cashRateTargetSteps,
  parseAbsCpiCsv,
  parseCashForecastCsv,
  parseCashRateTargetCsv,
  parseRbaSeriesCsv,
  preferNewerSeries,
} from './economicOutlookParse';

export { buildEconomicOutlookFromCsv, economicSignal } from './economicOutlookSignal';


const SOURCE_KEYS = ECONOMIC_SOURCE_KEYS;

function normalizeCachedOutlook(
  cached: EconomicOutlookPayload | null,
): EconomicOutlookPayload | null {
  if (!cached?.indicators?.length) return null;
  const checkedAt = cached.checkedAt || cached.fetchedAt;
  const indicators = cached.indicators.map((indicator) => {
    const definition = INDICATOR_DEFINITIONS.find((item) => item.id === indicator.id);
    const frequency = indicator.frequency ?? definition?.frequency ?? 'quarterly';
    return {
      ...indicator,
      observationDate: indicator.observationDate ?? indicator.points.at(-1)?.date,
      sourceUrl: indicator.sourceUrl || (definition ? URLS[definition.source] : RBA_ECONOMIC_TABLE_URL),
      checkedAt: indicator.checkedAt || checkedAt,
      frequency,
      status: indicatorIsStale(indicator.publicationDate, frequency) ? 'stale' as const : 'current' as const,
      sourceAgency: indicator.sourceAgency ?? 'rba',
    };
  });
  return {
    ...cached,
    schema_version: 2,
    checkedAt,
    refreshStatus: cached.refreshStatus ?? 'current',
    indicators,
  };
}

function newestIndicator(
  fresh: EconomicIndicator,
  cached: EconomicIndicator | undefined,
): EconomicIndicator {
  if (!cached) return fresh;
  const freshDate = fresh.points.at(-1)?.date ?? '';
  const cachedDate = cached.points.at(-1)?.date ?? '';
  if (freshDate > cachedDate) return fresh;
  if (freshDate < cachedDate) return cached;
  // Same observation: never demote a cached ABS read to an RBA fallback (e.g. ABS
  // refresh failed). Prefer fresh ABS over cached RBA; otherwise keep the newer publication.
  if (cached.sourceAgency === 'abs' && fresh.sourceAgency !== 'abs') {
    return cached;
  }
  if (
    (fresh.sourceAgency === 'abs' && cached.sourceAgency !== 'abs')
    || fresh.publicationDate >= cached.publicationDate
  ) {
    return fresh;
  }
  return cached;
}

interface FetchedCsv {
  text: string;
  lastModified: string | null;
}

async function fetchCsv(url: string, timeoutMs = 15_000): Promise<FetchedCsv> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'text/csv' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Official data request failed (${response.status})`);
    const text = await response.text();
    const lastModified = response.headers?.get?.('last-modified')
      ?? response.headers?.get?.('Last-Modified')
      ?? null;
    return { text, lastModified };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url: string, timeoutMs = 15_000): Promise<string> {
  return (await fetchCsv(url, timeoutMs)).text;
}

let inFlight: {
  promise: Promise<EconomicOutlookPayload>;
  force: boolean;
} | null = null;
let requestSequence = 0;
let latestSuccessful: {
  sequence: number;
  payload: EconomicOutlookPayload;
} | null = null;
let commitQueue: Promise<void> = Promise.resolve();

async function commitEconomicResult(
  sequence: number,
  payload: EconomicOutlookPayload,
  persist: boolean,
): Promise<EconomicOutlookPayload> {
  let accepted = payload;
  const commit = commitQueue.then(async () => {
    if (latestSuccessful && latestSuccessful.sequence > sequence) {
      accepted = latestSuccessful.payload;
      return;
    }
    if (persist) await cache.writeEconomicOutlook(payload);
    latestSuccessful = { sequence, payload };
  });
  commitQueue = commit.catch(() => undefined);
  await commit;
  return accepted;
}

export async function loadEconomicOutlook(force = false): Promise<EconomicOutlookPayload> {
  if (inFlight && (!force || inFlight.force)) return inFlight.promise;
  const sequence = ++requestSequence;
  const run = (async () => {
    const cached = normalizeCachedOutlook(await cache.readEconomicOutlook());
    const cacheAge = cached
      ? Date.now() - Date.parse(cached.checkedAt ?? cached.fetchedAt)
      : Number.POSITIVE_INFINITY;
    if (
      !force &&
      cached?.refreshStatus === 'current' &&
      Number.isFinite(cacheAge) &&
      cacheAge < ECONOMIC_RECHECK_MS
    ) {
      return commitEconomicResult(sequence, cached, false);
    }

    const checkedAt = new Date().toISOString();
    const [sourceEntries, forecastSettled, cashRateSettled, absHeadlineSettled] = await Promise.all([
      Promise.all(
        SOURCE_KEYS.map(async (source) => {
          try {
            return { source, text: await fetchText(URLS[source]), error: null as string | null };
          } catch (error) {
            return {
              source,
              text: null as string | null,
              error: String((error as Error)?.message ?? error),
            };
          }
        }),
      ),
      (async () => {
        try {
          return {
            forecast: parseCashForecastCsv(await fetchText(URLS.cashForecast, 5_000)),
            error: null as string | null,
          };
        } catch (error) {
          return {
            forecast: null as CashRateForecast | null,
            error: `Cash-rate forecast: ${String((error as Error)?.message ?? error)}`,
          };
        }
      })(),
      (async () => {
        try {
          return {
            history: parseCashRateTargetCsv(await fetchText(URLS.cashRate)),
            error: null as string | null,
          };
        } catch (error) {
          return {
            history: null as EconomicPoint[] | null,
            error: `Cash-rate history: ${String((error as Error)?.message ?? error)}`,
          };
        }
      })(),
      (async () => {
        try {
          const fetched = await fetchCsv(ABS_HEADLINE_CPI_URL);
          const publicationDate = httpDateToIso(fetched.lastModified)
            || checkedAt.slice(0, 10);
          return {
            series: parseAbsCpiCsv(fetched.text, publicationDate),
            error: null as string | null,
          };
        } catch (error) {
          return {
            series: null as ParsedSeries | null,
            error: `ABS headline CPI: ${String((error as Error)?.message ?? error)}`,
          };
        }
      })(),
    ]);
    const textBySource = new Map(
      sourceEntries
        .filter((entry): entry is { source: RequiredSourceKey; text: string; error: null } => !!entry.text)
        .map((entry) => [entry.source, entry.text] as const),
    );
    const sourceErrorByKey = new Map(
      sourceEntries
        .filter((entry) => entry.error)
        .map((entry) => [entry.source, entry.error!] as const),
    );

    const indicatorEntries = INDICATOR_DEFINITIONS.map((definition) => {
      const text = textBySource.get(definition.source);
      if (!text) {
        return {
          definition,
          indicator: null as EconomicIndicator | null,
          error: `${definition.label}: ${sourceErrorByKey.get(definition.source) ?? 'unavailable'}`,
        };
      }
      try {
        let parsed = parseRbaSeriesCsv(text, definition.seriesId);
        let sourceUrl: string = URLS[definition.source];
        let frequency = definition.frequency;
        let shortLabel = definition.shortLabel;
        if (definition.id === 'headline_inflation' && absHeadlineSettled.series) {
          parsed = preferNewerSeries(absHeadlineSettled.series, parsed);
          if (parsed.sourceAgency === 'abs') {
            sourceUrl = ABS_CPI_RELEASE_URL;
            frequency = 'monthly';
            shortLabel = 'All groups · year-ended · monthly';
          }
        }
        return {
          definition,
          indicator: buildIndicator(definition, parsed, checkedAt, {
            sourceUrl,
            frequency,
            shortLabel,
          }),
          error: null as string | null,
        };
      } catch (error) {
        return {
          definition,
          indicator: null,
          error: `${definition.label}: ${String((error as Error)?.message ?? error)}`,
        };
      }
    });

    const forecastEntry = forecastSettled;
    const cashRateEntry = cashRateSettled;

    const errors = indicatorEntries.flatMap((entry) => (entry.error ? [entry.error] : []));
    if (forecastEntry.error) errors.push(forecastEntry.error);
    if (cashRateEntry.error) errors.push(cashRateEntry.error);
    if (absHeadlineSettled.error) errors.push(absHeadlineSettled.error);
    const refreshedCount = indicatorEntries.filter((entry) => entry.indicator).length;

    if (refreshedCount === 0) {
      if (force || !cached) {
        throw new Error(errors.join(' · ') || 'Official economic data could not be refreshed');
      }
      return commitEconomicResult(sequence, {
        ...cached,
        checkedAt,
        refreshStatus: 'offline' as const,
        refreshErrors: errors,
      }, false);
    }

    const cachedById = new Map(cached?.indicators.map((indicator) => [indicator.id, indicator]));
    const regressedIds = new Set<EconomicIndicatorId>();
    for (const entry of indicatorEntries) {
      if (!entry.indicator) continue;
      const previous = cachedById.get(entry.definition.id);
      const freshDate = entry.indicator.points.at(-1)?.date ?? '';
      const previousDate = previous?.points.at(-1)?.date ?? '';
      if (previous && freshDate < previousDate) {
        regressedIds.add(entry.definition.id);
        errors.push(`${entry.definition.label}: older official response ignored`);
      }
    }
    const indicators = indicatorEntries.flatMap((entry) => {
      const previous = cachedById.get(entry.definition.id);
      if (!entry.indicator) return previous ? [previous] : [];
      if (regressedIds.has(entry.definition.id) && previous) return [previous];
      return [newestIndicator(entry.indicator, previous)];
    });
    const acceptedCount = refreshedCount - regressedIds.size;
    const cashRateHistory = cashRateEntry.history?.length
      ? cashRateEntry.history
      : cached?.cashRateHistory;
    const refreshStatus = acceptedCount === INDICATOR_DEFINITIONS.length
      && !forecastEntry.error
      && !cashRateEntry.error
      ? 'current'
      : 'partial';
    const fresh: EconomicOutlookPayload = {
      schema_version: 2,
      fetchedAt: checkedAt,
      checkedAt,
      refreshStatus,
      refreshErrors: errors.length ? errors : undefined,
      indicators,
      cashRateForecast: forecastEntry.forecast ?? cached?.cashRateForecast ?? null,
      cashRateHistory,
    };
    return commitEconomicResult(sequence, fresh, true);
  })();
  const tracked = run.finally(() => {
    if (inFlight?.promise === tracked) inFlight = null;
  });
  inFlight = { promise: tracked, force };
  return tracked;
}


