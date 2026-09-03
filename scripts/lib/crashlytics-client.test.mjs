#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  buildRecentIntervalFilter,
  fetchIssueEvents,
  flattenMessageQueryParams,
} from './crashlytics-client.mjs';

const filter = buildRecentIntervalFilter(7);
const flat = flattenMessageQueryParams('filter', filter);

assert.equal(flat['filter.issue.state'], 'OPEN');
assert.match(flat['filter.interval.startTime'], /^\d{4}-\d{2}-\d{2}T/);
assert.match(flat['filter.interval.endTime'], /^\d{4}-\d{2}-\d{2}T/);
assert.equal(flat.filter, undefined, 'must not emit a JSON blob filter key');

const nested = flattenMessageQueryParams('filter', {
  issue: { errorTypes: ['FATAL', 'ANR'] },
});
assert.deepEqual(nested['filter.issue.errorTypes'], ['FATAL', 'ANR']);

const originalFetch = globalThis.fetch;
const requestedUrls = [];
globalThis.fetch = async (url) => {
  requestedUrls.push(String(url));
  const secondPage = String(url).includes('pageToken=next-page');
  return {
    ok: true,
    text: async () => JSON.stringify(secondPage
      ? { events: [{ id: 'older' }] }
      : { events: [{ id: 'newest' }], nextPageToken: 'next-page' }),
  };
};
try {
  const events = await fetchIssueEvents('token', 'project name', 'app/id', 'issue-123', {
    lookbackDays: 7,
  });
  assert.deepEqual(events, [{ id: 'newest' }, { id: 'older' }]);
  assert.equal(requestedUrls.length, 2);
  assert.match(requestedUrls[0], /projects\/project%20name\/apps\/app%2Fid\/events\?/);
  assert.match(requestedUrls[0], /filter\.issue\.id=issue-123/);
  assert.match(requestedUrls[0], /filter\.interval\.startTime=/);
  assert.match(requestedUrls[1], /pageToken=next-page/);
} finally {
  globalThis.fetch = originalFetch;
}

console.log('crashlytics-client.test.mjs: ok');
