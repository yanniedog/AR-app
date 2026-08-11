import type { CorePayload } from '../types';
import type { RbaCalendar, RbaDecisionEntry } from './rbaCalendar';
import { rbaCalendarCoverage } from './rbaCalendar';

export const RBA_OVERVIEW_URL = 'https://www.rba.gov.au/cash-rate-target-overview.html';
export const RBA_MEDIA_RELEASE_FEED_URL = 'https://www.rba.gov.au/rss/rss-cb-media-releases.xml';

const MONTHS: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
};

function htmlText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
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
  const response = await fetch(RBA_OVERVIEW_URL, {
    headers: { Accept: 'text/html' },
  });
  if (!response.ok) throw new Error(`official RBA overview returned HTTP ${response.status}`);
  const overview = parseRbaOfficialOverview(await response.text());
  if (!overview) throw new Error('official RBA overview could not be verified');
  return reconcileRbaOfficialOverview(calendar, overview, now) ?? calendar;
}

export function integrateRbaCalendarIntoCore(
  core: CorePayload,
  calendar: RbaCalendar,
): CorePayload {
  const latest = calendar.decisions.at(-1);
  if (!latest) return core;
  if (latest.outcome === 'hold') {
    if (core.rba_holds?.includes(latest.date)) return core;
    const holds = new Set(core.rba_holds ?? []);
    holds.add(latest.date);
    return { ...core, rba_holds: [...holds].sort() };
  }
  // A policy change is announced before it becomes the prevailing cash rate.
  // Keep the result in the decision calendar immediately, but do not put its
  // next-day step into the current-rate graph or "is now" notifications early.
  if (!latest.effective || latest.effective > core.run_date.slice(0, 10)) return core;
  if (core.rba.some((entry) => entry.date === latest.effective && entry.rate === latest.rate)) {
    return core;
  }
  const byDate = new Map(core.rba.map((entry) => [entry.date, entry]));
  byDate.set(latest.effective, { date: latest.effective, rate: latest.rate });
  return { ...core, rba: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}
