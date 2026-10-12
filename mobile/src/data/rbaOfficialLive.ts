import type { CorePayload } from '../types';
import { inheritHistoricalBankRateCatalogue } from './historicalBankRateCatalogueStore';
import type { RbaCalendar, RbaDecisionEntry } from './rbaCalendar';
import { rbaCalendarCoverage, sydneyYmd } from './rbaCalendar';

export const RBA_OVERVIEW_URL = 'https://www.rba.gov.au/cash-rate-target-overview.html';
export const RBA_MEDIA_RELEASE_FEED_URL = 'https://www.rba.gov.au/rss/rss-cb-media-releases.xml';

const MONTHS: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
};

function foldAscii(char: string): string {
  const code = char.charCodeAt(0);
  return code >= 65 && code <= 90 ? String.fromCharCode(code + 32) : char;
}

function asciiEqualsAt(html: string, index: number, lowerNeedle: string): boolean {
  if (index < 0 || index + lowerNeedle.length > html.length) return false;
  for (let offset = 0; offset < lowerNeedle.length; offset += 1) {
    if (foldAscii(html[index + offset]) !== lowerNeedle[offset]) return false;
  }
  return true;
}

function indexOfAscii(html: string, lowerNeedle: string, from: number): number {
  const last = html.length - lowerNeedle.length;
  for (let index = Math.max(0, from); index <= last; index += 1) {
    if (asciiEqualsAt(html, index, lowerNeedle)) return index;
  }
  return -1;
}

function readTagName(html: string, start: number, end: number): string {
  let cursor = start;
  while (cursor < end && /\s/.test(html[cursor])) cursor += 1;
  let name = '';
  while (cursor < end && /[A-Za-z0-9:_-]/.test(html[cursor])) {
    name += foldAscii(html[cursor]);
    cursor += 1;
  }
  return name;
}

function stripElements(html: string, blocked: ReadonlySet<string>): string {
  let out = '';
  let index = 0;
  while (index < html.length) {
    const open = html.indexOf('<', index);
    if (open < 0) {
      out += html.slice(index);
      break;
    }
    out += html.slice(index, open);
    if (asciiEqualsAt(html, open + 1, '!--')) {
      const commentEnd = html.indexOf('-->', open + 4);
      index = commentEnd < 0 ? html.length : commentEnd + 3;
      out += ' ';
      continue;
    }
    const close = html.indexOf('>', open + 1);
    if (close < 0) {
      out += html.slice(open);
      break;
    }
    const isClosing = html[open + 1] === '/';
    const name = readTagName(html, open + (isClosing ? 2 : 1), close);
    if (!isClosing && blocked.has(name)) {
      const closer = `</${name}`;
      let searchFrom = close + 1;
      let foundAt = -1;
      while (searchFrom < html.length) {
        const candidate = indexOfAscii(html, closer, searchFrom);
        if (candidate < 0) break;
        let cursor = candidate + closer.length;
        while (cursor < html.length && /\s/.test(html[cursor])) cursor += 1;
        if (html[cursor] === '>') {
          foundAt = cursor + 1;
          break;
        }
        searchFrom = candidate + 1;
      }
      index = foundAt < 0 ? html.length : foundAt;
      out += ' ';
      continue;
    }
    index = close + 1;
    out += ' ';
  }
  return out;
}

function stripTags(html: string): string {
  let out = '';
  let index = 0;
  while (index < html.length) {
    const open = html.indexOf('<', index);
    if (open < 0) {
      out += html.slice(index);
      break;
    }
    out += html.slice(index, open);
    const close = html.indexOf('>', open + 1);
    if (close < 0) {
      out += html.slice(open);
      break;
    }
    index = close + 1;
    out += ' ';
  }
  return out;
}

function htmlText(html: string): string {
  const withoutEmbedded = stripElements(html, new Set(['script', 'style']));
  return stripTags(withoutEmbedded)
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseLongDate(day: string, month: string, year: string): string | null {
  const mm = MONTHS[month.toLowerCase()];
  const dd = Number.parseInt(day, 10);
  if (!mm || !Number.isInteger(dd) || dd < 1 || dd > 31) return null;
  return `${year}-${mm}-${String(dd).padStart(2, '0')}`;
}

function addUtcDays(ymd: string, days: number): string | null {
  const ms = Date.parse(`${ymd}T00:00:00Z`);
  return Number.isFinite(ms) ? new Date(ms + days * 86_400_000).toISOString().slice(0, 10) : null;
}

export interface RbaOfficialOverview {
  rate: number;
  effectiveDate: string;
  nextUpdateDate: string;
}

export interface RbaOfficialFeedDecision {
  date: string;
  rate: number;
}

export function parseRbaMediaReleaseFeedDecisions(xml: string): RbaOfficialFeedDecision[] {
  const byDate = new Map<string, RbaOfficialFeedDecision>();
  for (const item of xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? []) {
    if (!/Monetary Policy Decision/i.test(item)) continue;
    const description = item.match(/<description>([\s\S]*?)<\/description>/i)?.[1]
      ?.replace(/<!\[CDATA\[|\]\]>/g, '') ?? '';
    const date = item.match(/<dc:date>(\d{4}-\d{2}-\d{2})T/i)?.[1];
    const rate = description.match(/cash rate target[^.]*?\b(?:at|to)\s+(\d+(?:\.\d+)?)\s+per cent/i)?.[1];
    const parsedRate = Number(rate);
    if (date && Number.isFinite(parsedRate)) byDate.set(date, { date, rate: parsedRate });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function parseRbaMediaReleaseFeed(xml: string): RbaOfficialFeedDecision | null {
  return parseRbaMediaReleaseFeedDecisions(xml).at(-1) ?? null;
}

export function parseRbaOfficialOverview(html: string): RbaOfficialOverview | null {
  const text = htmlText(html);
  const rate = text.match(/Cash rate target\s+(\d+(?:\.\d+)?)\s*%/i);
  const effective = text.match(/Effective date\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i);
  const next = text.match(/Next update\s+[^,]*,\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i);
  if (!rate || !effective || !next) return null;
  const effectiveDate = parseLongDate(effective[1], effective[2], effective[3]);
  const nextUpdateDate = parseLongDate(next[1], next[2], next[3]);
  const parsedRate = Number(rate[1]);
  if (!effectiveDate || !nextUpdateDate || !Number.isFinite(parsedRate)) return null;
  return { rate: parsedRate, effectiveDate, nextUpdateDate };
}

export function reconcileRbaOfficialOverview(
  calendar: RbaCalendar,
  overview: RbaOfficialOverview,
  now: number = Date.now(),
): RbaCalendar | null {
  const unresolved = rbaCalendarCoverage(calendar, now).unresolvedMeeting;
  if (!unresolved || addUtcDays(unresolved.date, 1) !== overview.effectiveDate) return null;
  const previous = calendar.decisions.at(-1);
  if (!previous) return null;
  const deltaBps = Math.round((overview.rate - previous.rate) * 100);
  const decision: RbaDecisionEntry = {
    date: unresolved.date,
    effective: deltaBps === 0 ? null : overview.effectiveDate,
    rate: overview.rate,
    delta_bps: deltaBps,
    outcome: deltaBps > 0 ? 'hike' : deltaBps < 0 ? 'cut' : 'hold',
  };
  return {
    ...calendar,
    decisions: [...calendar.decisions, decision].sort((a, b) => a.date.localeCompare(b.date)),
    schedule: calendar.schedule.filter((meeting) => meeting.date !== unresolved.date),
  };
}

export function reconcileRbaFeedDecision(
  calendar: RbaCalendar,
  feed: RbaOfficialFeedDecision,
  now: number = Date.now(),
): RbaCalendar | null {
  const unresolved = rbaCalendarCoverage(calendar, now).unresolvedMeeting;
  if (!unresolved || unresolved.date !== feed.date) return null;
  const previous = calendar.decisions.at(-1);
  if (!previous) return null;
  const deltaBps = Math.round((feed.rate - previous.rate) * 100);
  const decision: RbaDecisionEntry = {
    date: feed.date,
    effective: deltaBps === 0 ? null : addUtcDays(feed.date, 1),
    rate: feed.rate,
    delta_bps: deltaBps,
    outcome: deltaBps > 0 ? 'hike' : deltaBps < 0 ? 'cut' : 'hold',
  };
  return {
    ...calendar,
    decisions: [...calendar.decisions, decision].sort((a, b) => a.date.localeCompare(b.date)),
    schedule: calendar.schedule.filter((meeting) => meeting.date !== unresolved.date),
  };
}

export function reconcileRbaFeedDecisions(
  calendar: RbaCalendar,
  feed: readonly RbaOfficialFeedDecision[],
  now: number = Date.now(),
): RbaCalendar | null {
  let reconciled = calendar;
  for (const decision of [...feed].sort((a, b) => a.date.localeCompare(b.date))) {
    reconciled = reconcileRbaFeedDecision(reconciled, decision, now) ?? reconciled;
  }
  return reconciled === calendar ? null : reconciled;
}

export async function refreshRbaCalendarFromOfficial(
  calendar: RbaCalendar,
  now: number = Date.now(),
): Promise<RbaCalendar> {
  if (!rbaCalendarCoverage(calendar, now).unresolvedMeeting) return calendar;
  const original = calendar;
  try {
    const feedResponse = await fetch(RBA_MEDIA_RELEASE_FEED_URL, {
      headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
    });
    if (feedResponse.ok) {
      const feed = parseRbaMediaReleaseFeedDecisions(await feedResponse.text());
      const reconciled = reconcileRbaFeedDecisions(calendar, feed, now);
      if (reconciled) {
        calendar = reconciled;
        if (!rbaCalendarCoverage(calendar, now).unresolvedMeeting) return calendar;
      }
    }
  } catch {
    // The independently published overview below remains authoritative fallback.
  }
  try {
    const response = await fetch(RBA_OVERVIEW_URL, {
      headers: { Accept: 'text/html' },
    });
    if (!response.ok) throw new Error(`official RBA overview returned HTTP ${response.status}`);
    const overview = parseRbaOfficialOverview(await response.text());
    if (!overview) throw new Error('official RBA overview could not be verified');
    return reconcileRbaOfficialOverview(calendar, overview, now) ?? calendar;
  } catch (error) {
    if (calendar !== original) return calendar;
    throw error;
  }
}

export function integrateRbaCalendarIntoCore(
  core: CorePayload,
  calendar: RbaCalendar,
  now: number = Date.now(),
): CorePayload {
  const asOf = sydneyYmd(now);
  const holds = new Set(core.rba_holds ?? []);
  const byDate = new Map(core.rba.map((entry) => [entry.date, entry]));
  let changed = false;
  for (const decision of calendar.decisions) {
    if (decision.outcome === 'hold') {
      if (!holds.has(decision.date)) {
        holds.add(decision.date);
        changed = true;
      }
      continue;
    }
    // A policy change is announced before it becomes the prevailing cash rate.
    // Keep it in decision history immediately, but gate graphs/current-rate
    // notifications against today's date in the RBA's Sydney frame.
    if (!decision.effective || decision.effective > asOf) continue;
    const existing = byDate.get(decision.effective);
    if (!existing || existing.rate !== decision.rate) {
      byDate.set(decision.effective, { date: decision.effective, rate: decision.rate });
      changed = true;
    }
  }
  if (!changed) return core;
  const replacement = {
    ...core,
    rba: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    rba_holds: [...holds].sort(),
  };
  inheritHistoricalBankRateCatalogue(core, replacement);
  return replacement;
}
