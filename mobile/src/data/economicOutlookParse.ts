import type { CashRateForecast, EconomicPoint, ParsedSeries } from './economicOutlookTypes';

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(field.trim());
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(field.trim());
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field.trim());
    if (row.some((cell) => cell !== '')) rows.push(row);
  }
  return rows;
}

function isoDate(value: string): string {
  const trimmed = value.trim();
  const numeric = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (numeric) {
    return `${numeric[3]}-${numeric[2].padStart(2, '0')}-${numeric[1].padStart(2, '0')}`;
  }

  const named = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(trimmed);
  if (!named) return '';
  const month = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  }[named[2].toLowerCase()];
  return month ? `${named[3]}-${month}-${named[1].padStart(2, '0')}` : '';
}

function finite(value: string): number | null {
  if (!value) return null;
  const n = Number(value.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function rowByLabel(rows: string[][], label: string): string[] | undefined {
  return rows.find((row) => row[0]?.replace(/^\uFEFF/, '').trim() === label);
}

export function parseRbaSeriesCsv(text: string, seriesId: string): ParsedSeries {
  const rows = parseCsv(text);
  const ids = rowByLabel(rows, 'Series ID');
  if (!ids) throw new Error('RBA table is missing its Series ID row');
  const column = ids.indexOf(seriesId);
  if (column < 1) throw new Error(`RBA series ${seriesId} is unavailable`);
  const publication = rowByLabel(rows, 'Publication date')?.[column] ?? '';
  const parsedPoints = rows.flatMap((row) => {
    const date = isoDate(row[0] ?? '');
    const value = finite(row[column] ?? '');
    return date && value != null ? [{ date, value }] : [];
  });
  const points = [...new Map(parsedPoints.map((point) => [point.date, point])).values()]
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!points.length) throw new Error(`RBA series ${seriesId} has no observations`);
  return { publicationDate: isoDate(publication), points, sourceAgency: 'rba' };
}

/** Last calendar day of an ABS TIME_PERIOD (`YYYY-MM` or `YYYY-Qn`). */
export function absPeriodToIsoDate(period: string): string {
  const month = /^(\d{4})-(\d{2})$/.exec(period.trim());
  if (month) {
    const year = Number(month[1]);
    const monthIndex = Number(month[2]);
    if (monthIndex < 1 || monthIndex > 12) return '';
    const day = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
    return `${month[1]}-${month[2]}-${String(day).padStart(2, '0')}`;
  }
  const quarter = /^(\d{4})-Q([1-4])$/.exec(period.trim());
  if (quarter) {
    const endMonth = Number(quarter[2]) * 3;
    const day = new Date(Date.UTC(Number(quarter[1]), endMonth, 0)).getUTCDate();
    return `${quarter[1]}-${String(endMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return '';
}

export function httpDateToIso(value: string | null | undefined): string {
  if (!value) return '';
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return '';
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Parse ABS Data API CPI CSV (MEASURE=3 year-ended %). Columns include
 * TIME_PERIOD / OBS_VALUE (order-tolerant via header names).
 */
export function parseAbsCpiCsv(
  text: string,
  publicationDate = '',
): ParsedSeries {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('ABS CPI table is empty');
  const header = rows[0].map((cell) => cell.replace(/^\uFEFF/, '').trim().toUpperCase());
  const timeIdx = header.indexOf('TIME_PERIOD');
  const valueIdx = header.indexOf('OBS_VALUE');
  if (timeIdx < 0 || valueIdx < 0) {
    throw new Error('ABS CPI table is missing TIME_PERIOD or OBS_VALUE');
  }
  const parsedPoints = rows.slice(1).flatMap((row) => {
    const date = absPeriodToIsoDate(row[timeIdx] ?? '');
    const value = finite(row[valueIdx] ?? '');
    return date && value != null ? [{ date, value }] : [];
  });
  const points = [...new Map(parsedPoints.map((point) => [point.date, point])).values()]
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!points.length) throw new Error('ABS CPI series has no observations');
  return {
    publicationDate: publicationDate || points.at(-1)!.date,
    points,
    sourceAgency: 'abs',
  };
}

/** Prefer the series whose latest observation is newer; ties keep the primary (ABS) read. */
export function preferNewerSeries(
  primary: ParsedSeries | null,
  fallback: ParsedSeries,
): ParsedSeries {
  if (!primary?.points.length) return fallback;
  const primaryLatest = primary.points.at(-1)?.date ?? '';
  const fallbackLatest = fallback.points.at(-1)?.date ?? '';
  return primaryLatest >= fallbackLatest ? primary : fallback;
}

export function parseCashForecastCsv(text: string): CashRateForecast | null {
  const rows = parseCsv(text);
  const ids = rowByLabel(rows, 'Series ID');
  if (!ids) return null;
  const targetColumn = ids.indexOf('JCRTQF');
  const medianColumn = ids.indexOf('JCRFMED');
  if (targetColumn < 1 || medianColumn < 1) return null;
  const observations = rows.flatMap((row) => {
    const surveyDate = isoDate(row[0] ?? '');
    const targetDate = isoDate(row[targetColumn] ?? '');
    const value = finite(row[medianColumn] ?? '');
    return surveyDate && targetDate && value != null
      ? [{ surveyDate, targetDate, value }]
      : [];
  });
  if (!observations.length) return null;
  const surveyDate = observations.reduce(
    (latest, item) => (item.surveyDate > latest ? item.surveyDate : latest),
    observations[0].surveyDate,
  );
  const points = observations
    .filter((item) => item.surveyDate === surveyDate)
    .map((item) => ({ date: item.targetDate, value: item.value }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return {
    surveyDate,
    publicationDate: isoDate(rowByLabel(rows, 'Publication date')?.[medianColumn] ?? ''),
    points,
  };
}

/**
 * Compress daily cash-rate target observations to decision steps (value changes).
 * Keeps charts readable for 1Y–All while preserving the full F1 history span.
 * Defensively sorts by date so equal values are consecutive.
 */
export function cashRateTargetSteps(points: EconomicPoint[]): EconomicPoint[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const steps: EconomicPoint[] = [];
  for (const point of sorted) {
    const last = steps.at(-1);
    if (!last || last.value !== point.value) steps.push(point);
  }
  return steps;
}

export function parseCashRateTargetCsv(text: string): EconomicPoint[] {
  return cashRateTargetSteps(parseRbaSeriesCsv(text, 'FIRMMCRTD').points);
}
