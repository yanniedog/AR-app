import { parseCashForecastCsv, parseCsv } from './economicOutlookParse';
import type { CashRateForecast } from './economicOutlookTypes';
import type { RbaBondForwards, RbaMarketOutlook } from './rbaMarketOutlookTypes';

const FORWARD_SERIES = ['FZCF0D', 'FZCF25D', 'FZCF50D', 'FZCF75D', 'FZCF100D'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function record(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

/** Source dates are Australian calendar dates, even before midnight UTC. */
export function rbaSourceToday(now = Date.now()): string {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(now));
  const part = (name: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === name)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function csvDate(value: string): string | null {
  const named = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(value);
  const numeric = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  let date = value;
  if (named) {
    const month = MONTHS.indexOf(named[2].toLowerCase()) + 1;
    date = `${named[3]}-${String(month).padStart(2, '0')}-${named[1].padStart(2, '0')}`;
  } else if (numeric) {
    date = `${numeric[3]}-${numeric[2].padStart(2, '0')}-${numeric[1].padStart(2, '0')}`;
  }
  return validDate(date) ? date : null;
}

/** Label quarter-year tenors as calendar months, clamping month-end dates. */
function horizonDate(observationDate: string, months: number): string {
  const base = new Date(`${observationDate}T00:00:00Z`);
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth() + months;
  const day = Math.min(base.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

function validateBond(value: unknown, today: string): RbaBondForwards | null {
  if (!record(value)
    || !validDate(value.observationDate) || value.observationDate > today
    || !validDate(value.publicationDate) || value.publicationDate > today
    || value.publicationDate < value.observationDate
    || !Array.isArray(value.points) || value.points.length !== FORWARD_SERIES.length) return null;
  const observationDate = value.observationDate;
  const points = value.points;
  if (!points.every((point, index) => record(point)
    && point.horizonMonths === index * 3
    && point.date === horizonDate(observationDate, index * 3)
    && typeof point.value === 'number' && Number.isFinite(point.value))) return null;
  return {
    observationDate,
    publicationDate: value.publicationDate,
    points: points.map((point) => ({ date: point.date, value: point.value, horizonMonths: point.horizonMonths })),
  };
}

function validateEconomists(value: unknown, today: string): CashRateForecast | null {
  if (!record(value)
    || !validDate(value.surveyDate) || value.surveyDate > today
    || !validDate(value.publicationDate) || value.publicationDate > today
    || value.publicationDate < value.surveyDate
    || !Array.isArray(value.points) || !value.points.length || value.points.length > 40) return null;
  const surveyDate = value.surveyDate;
  if (!value.points.every((point) => record(point) && validDate(point.date)
    && point.date >= surveyDate && typeof point.value === 'number' && Number.isFinite(point.value))) return null;
  const points = value.points.map((point) => ({ date: point.date as string, value: point.value as number }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (new Set(points.map((point) => point.date)).size !== points.length) return null;
  return { surveyDate, publicationDate: value.publicationDate, points };
}

/** Select one complete, same-date RBA curve; never combine different trading days. */
export function parseRbaBondForwardsCsv(text: string, today = rbaSourceToday()): RbaBondForwards {
  const rows = parseCsv(text);
  const row = (label: string) => rows.find((item) => item[0] === label);
  const ids = row('Series ID');
  const columns = FORWARD_SERIES.map((id) => ids?.indexOf(id) ?? -1);
  if (columns.some((column) => column < 1)) throw new Error('RBA bond forward series are unavailable');
  if (columns.some((column) => row('Source')?.[column] !== 'RBA')) {
    throw new Error('RBA bond forward source has changed');
  }
  const publications = columns.map((column) => csvDate(row('Publication date')?.[column] ?? ''));
  const publicationDate = publications[0];
  if (!publicationDate || publicationDate > today || publications.some((date) => date !== publicationDate)) {
    throw new Error('RBA bond forward publication dates are invalid');
  }
  let latestDate: string | null = null;
  let latestValues: number[] | null = null;
  for (const cells of rows) {
    const observationDate = csvDate(cells[0]);
    if (!observationDate || observationDate > today || observationDate > publicationDate
      || (latestDate && observationDate < latestDate)) continue;
    const values = columns.map((column) => cells[column] ? Number(cells[column]) : NaN);
    if (!values.every(Number.isFinite)) continue;
    latestDate = observationDate;
    latestValues = values;
  }
  if (!latestDate || !latestValues) throw new Error('RBA bond forward table has no complete observations');
  // The source contains years of daily curves; only build dates for the selected one.
  const observationDate = latestDate;
  return {
    observationDate,
    publicationDate,
    points: latestValues.map((value, index) => ({
      date: horizonDate(observationDate, index * 3), value, horizonMonths: index * 3,
    })),
  };
}

/** J1 is a survey, never a substitute for traded money-market expectations. */
export function parseRbaEconomistsCsv(text: string, today = rbaSourceToday()): CashRateForecast {
  const rows = parseCsv(text);
  const ids = rows.find((row) => row[0] === 'Series ID');
  const source = rows.find((row) => row[0] === 'Source');
  const medianColumn = ids?.indexOf('JCRFMED') ?? -1;
  if (medianColumn < 1 || source?.[medianColumn] !== 'RBA') {
    throw new Error('RBA economist survey source is unavailable');
  }
  // Keep the shared J1 parser, filtering invalid/future survey rows first.
  const accepted = rows.filter((row) => {
    if (!/^\d/.test(row[0] ?? '')) return true;
    const date = csvDate(row[0]);
    return date != null && date <= today;
  }).map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
  const parsed = validateEconomists(parseCashForecastCsv(accepted), today);
  if (!parsed) throw new Error('RBA economist survey has no valid forecast');
  return parsed;
}

/** A damaged optional source must not discard the other cached public series. */
export function normalizeRbaMarketOutlook(value: unknown, now = Date.now()): RbaMarketOutlook | null {
  if (!record(value) || value.schema_version !== 1) return null;
  const validInstant = (instant: unknown): instant is string => typeof instant === 'string'
    && Number.isFinite(Date.parse(instant)) && Date.parse(instant) <= now
    && new Date(instant).toISOString() === instant;
  if (!validInstant(value.fetchedAt) || !validInstant(value.checkedAt)
    || value.checkedAt < value.fetchedAt
    || !['current', 'partial', 'offline'].includes(String(value.refreshStatus))) return null;
  const today = rbaSourceToday(now);
  const bondForwards = validateBond(value.bondForwards, today);
  const economists = validateEconomists(value.economists, today);
  if (!bondForwards && !economists) return null;
  return {
    schema_version: 1,
    fetchedAt: value.fetchedAt,
    checkedAt: value.checkedAt,
    refreshStatus: value.refreshStatus === 'offline' ? 'offline'
      : value.refreshStatus === 'partial' || !bondForwards || !economists ? 'partial' : 'current',
    bondForwards,
    economists,
  };
}
