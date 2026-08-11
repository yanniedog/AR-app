import {
  integrateRbaCalendarIntoCore,
  parseRbaMediaReleaseFeed,
  parseRbaMediaReleaseFeedDecisions,
  parseRbaOfficialOverview,
  reconcileRbaFeedDecision,
  reconcileRbaFeedDecisions,
  reconcileRbaOfficialOverview,
  refreshRbaCalendarFromOfficial,
} from '../src/data/rbaOfficialLive';
import { normalizeRbaCalendar } from '../src/data/rbaCalendar';
import type { CorePayload } from '../src/types';

const HTML = `
  <h2>Cash rate target</h2><p>4.35 <span>%</span></p>
  <p>Effective date 12 August 2026</p>
  <p>Next update 2.30 pm, 29 September 2026</p>
`;
const FEED = `
  <item rdf:about="https://www.rba.gov.au/media-releases/2026/mr-26-19.html">
    <title>Statement by the Monetary Policy Board: Monetary Policy Decision</title>
    <description>At its meeting today, the Board decided to leave the cash rate target unchanged at 4.35 per cent.</description>
    <dc:date>2026-08-11T14:30:00+10:00</dc:date>
  </item>
`;

const calendar = normalizeRbaCalendar({
  timezone: 'Australia/Sydney',
  decisions: [{ date: '2026-06-16', effective: null, rate: 4.35, delta_bps: 0, outcome: 'hold' }],
  schedule: [
    { date: '2026-08-11', announce_utc: '2026-08-11T04:30:00+00:00' },
    { date: '2026-09-29', announce_utc: '2026-09-29T04:30:00+00:00' },
  ],
})!;

test('parses and reconciles a live official hold before the historical stream updates', () => {
  const overview = parseRbaOfficialOverview(HTML)!;
  expect(overview).toEqual({ rate: 4.35, effectiveDate: '2026-08-12', nextUpdateDate: '2026-09-29' });
  const resolved = reconcileRbaOfficialOverview(
    calendar,
    overview,
    Date.parse('2026-08-11T05:00:00Z'),
  )!;
  expect(resolved.decisions.at(-1)).toEqual({
    date: '2026-08-11', effective: null, rate: 4.35, delta_bps: 0, outcome: 'hold',
  });
  expect(resolved.schedule[0].date).toBe('2026-09-29');
});

test('uses the immediate official media-release feed decision', () => {
  const feed = parseRbaMediaReleaseFeed(FEED);
  expect(feed).toEqual({ date: '2026-08-11', rate: 4.35 });
  const resolved = reconcileRbaFeedDecision(
    calendar,
    feed!,
    Date.parse('2026-08-11T04:30:00Z'),
  )!;
  expect(resolved.decisions.at(-1)?.outcome).toBe('hold');
  expect(resolved.schedule[0].date).toBe('2026-09-29');
});

test('finds the policy decision when another RBA release leads the feed', () => {
  const bulletin = '<item><title>Payments bulletin</title><dc:date>2026-08-11T15:00:00+10:00</dc:date></item>';
  expect(parseRbaMediaReleaseFeed(`${bulletin}${FEED}`)).toEqual({
    date: '2026-08-11',
    rate: 4.35,
  });
});

test('selects the latest policy decision from an unordered feed', () => {
  const older = FEED
    .replaceAll('2026-08-11', '2026-06-16')
    .replaceAll('4.35', '4.10');
  expect(parseRbaMediaReleaseFeed(`${older}${FEED}`)).toEqual({
    date: '2026-08-11',
    rate: 4.35,
  });
});

test('applies multiple missing feed decisions in chronological order', () => {
  const prior = normalizeRbaCalendar({
    timezone: 'Australia/Sydney',
    decisions: [{ date: '2026-06-16', effective: null, rate: 4.35, delta_bps: 0, outcome: 'hold' }],
    schedule: [
      { date: '2026-08-11', announce_utc: '2026-08-11T04:30:00+00:00' },
      { date: '2026-09-29', announce_utc: '2026-09-29T04:30:00+00:00' },
    ],
  })!;
  const august = FEED.replace('4.35', '4.10');
  const september = FEED
    .replaceAll('2026-08-11', '2026-09-29')
    .replace('4.35', '4.10');
  const feed = parseRbaMediaReleaseFeedDecisions(`${september}${august}`);
  const resolved = reconcileRbaFeedDecisions(
    prior,
    feed,
    Date.parse('2026-09-29T05:00:00Z'),
  )!;
  expect(resolved.decisions.slice(-2).map((decision) => ({
    date: decision.date,
    delta: decision.delta_bps,
  }))).toEqual([
    { date: '2026-08-11', delta: -25 },
    { date: '2026-09-29', delta: 0 },
  ]);
  expect(resolved.schedule).toEqual([]);
});

test('rejects an overview that does not correspond to the elapsed meeting', () => {
  expect(reconcileRbaOfficialOverview(
    calendar,
    { rate: 4.35, effectiveDate: '2026-08-13', nextUpdateDate: '2026-09-29' },
    Date.parse('2026-08-11T05:00:00Z'),
  )).toBeNull();
  expect(parseRbaOfficialOverview('<html>not the RBA fields</html>')).toBeNull();
});

test('propagates a reconciled hold into graph-facing core data', () => {
  const core = {
    schema_version: 1, run_date: '2026-08-11', sections: {}, brands: {},
    rba: [{ date: '2026-05-06', rate: 4.35 }], rba_holds: ['2026-06-16'],
  } as unknown as CorePayload;
  const resolved = reconcileRbaOfficialOverview(
    calendar,
    parseRbaOfficialOverview(HTML)!,
    Date.parse('2026-08-11T05:00:00Z'),
  )!;
  expect(integrateRbaCalendarIntoCore(core, resolved).rba_holds).toEqual([
    '2026-06-16', '2026-08-11',
  ]);
});

test('does not make an announced change prevailing before its effective date', () => {
  const core = {
    schema_version: 1, run_date: '2026-08-11', sections: {}, brands: {},
    rba: [{ date: '2026-05-06', rate: 4.35 }], rba_holds: [],
  } as unknown as CorePayload;
  const changed = normalizeRbaCalendar({
    timezone: 'Australia/Sydney',
    decisions: [{
      date: '2026-08-11', effective: '2026-08-12', rate: 4.60,
      delta_bps: 25, outcome: 'hike',
    }],
    schedule: [],
  })!;
  expect(integrateRbaCalendarIntoCore(
    core,
    changed,
    Date.parse('2026-08-11T05:00:00Z'),
  )).toBe(core);
  expect(integrateRbaCalendarIntoCore(
    core,
    changed,
    Date.parse('2026-08-12T05:00:00Z'),
  ).rba.at(-1))
    .toEqual({ date: '2026-08-12', rate: 4.60 });
});

test('integrates every recovered decision into graph-facing core data', () => {
  const core = {
    schema_version: 1, run_date: '2026-09-30', sections: {}, brands: {},
    rba: [{ date: '2026-05-06', rate: 4.35 }], rba_holds: [],
  } as unknown as CorePayload;
  const recovered = normalizeRbaCalendar({
    timezone: 'Australia/Sydney',
    decisions: [
      { date: '2026-08-11', effective: '2026-08-12', rate: 4.10, delta_bps: -25, outcome: 'cut' },
      { date: '2026-09-29', effective: null, rate: 4.10, delta_bps: 0, outcome: 'hold' },
    ],
    schedule: [],
  })!;
  const integrated = integrateRbaCalendarIntoCore(
    core,
    recovered,
    Date.parse('2026-09-30T05:00:00Z'),
  );
  expect(integrated.rba.at(-1)).toEqual({ date: '2026-08-12', rate: 4.10 });
  expect(integrated.rba_holds).toEqual(['2026-09-29']);
});

test('preserves a partial feed reconciliation if the overview fallback fails', async () => {
  const prior = normalizeRbaCalendar({
    timezone: 'Australia/Sydney',
    decisions: [{ date: '2026-06-16', effective: null, rate: 4.35, delta_bps: 0, outcome: 'hold' }],
    schedule: [
      { date: '2026-08-11', announce_utc: '2026-08-11T04:30:00+00:00' },
      { date: '2026-09-29', announce_utc: '2026-09-29T04:30:00+00:00' },
    ],
  })!;
  const fetchMock = jest.spyOn(global, 'fetch')
    .mockResolvedValueOnce({ ok: true, text: async () => FEED } as Response)
    .mockRejectedValueOnce(new Error('overview offline'));
  await expect(refreshRbaCalendarFromOfficial(
    prior,
    Date.parse('2026-09-29T05:00:00Z'),
  )).resolves.toMatchObject({
    decisions: expect.arrayContaining([expect.objectContaining({ date: '2026-08-11' })]),
  });
  fetchMock.mockRestore();
});
