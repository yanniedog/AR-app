import { spawnSync } from 'node:child_process';
import {
  allKnownBotLogins,
  formatRequiredKeys,
  isGeminiCodeReviewBody,
  missingRequiredKeysFromEvents,
  resolveRequiredKeys,
} from './bot-wait-config.mjs';
import { gitRepoRoot, readBotWaitStateFile } from './bot-wait-state.mjs';

export function readBotWaitState(prNumber, cwd) {
  return readBotWaitStateFile(prNumber, cwd || gitRepoRoot());
}

/** Resolve anchor ISO; fall back to fallbackIso when anchor is missing/invalid. */
export function resolveAnchorIso(anchorIso, fallbackIso) {
  const ms = new Date(anchorIso).getTime();
  if (Number.isFinite(ms)) return new Date(ms).toISOString();
  const fbMs = new Date(fallbackIso).getTime();
  if (Number.isFinite(fbMs)) return new Date(fbMs).toISOString();
  throw new Error(`Invalid anchor time: ${anchorIso ?? '(none)'}`);
}

const COMMENTS_QUERY =
  'query($owner:String!,$name:String!,$num:Int!){repository(owner:$owner,name:$name){pullRequest(number:$num){createdAt comments(last:100){nodes{author{login}createdAt body}}reviews(last:30){nodes{author{login}submittedAt body}}reviewThreads(last:100){nodes{comments(last:10){nodes{author{login}createdAt body}}}}}}';

function ghGraphql(owner, name, prNumber) {
  const r = spawnSync(
    'gh',
    [
      'api',
      'graphql',
      '-f',
      `query=${COMMENTS_QUERY}`,
      '-F',
      `owner=${owner}`,
      '-F',
      `name=${name}`,
      '-F',
      `num=${prNumber}`,
    ],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) {
    throw new Error((r.stderr || r.stdout || 'gh api graphql failed').trim());
  }
  try {
    return JSON.parse(r.stdout || '{}');
  } catch (e) {
    throw new Error(`Invalid JSON from gh api graphql: ${e.message}`);
  }
}

export function collectBotEvents(prPayload, knownBots, anchorIso, fallbackIso) {
  const anchorMs = new Date(resolveAnchorIso(anchorIso, fallbackIso)).getTime();
  const events = [];
  const pushEvent = (login, at, body) => {
    if (!login || !at) return;
    if (login.toLowerCase() === 'github-actions[bot]' && !isGeminiCodeReviewBody(body)) return;
    events.push({ login, at, body: body || '' });
  };
  for (const c of prPayload.comments?.nodes || []) {
    pushEvent(c.author?.login, c.createdAt, c.body);
  }
  for (const rev of prPayload.reviews?.nodes || []) {
    pushEvent(rev.author?.login, rev.submittedAt, rev.body);
  }
  for (const t of prPayload.reviewThreads?.nodes || []) {
    for (const c of t.comments?.nodes || []) {
      pushEvent(c.author?.login, c.createdAt, c.body);
    }
  }
  events.sort((a, b) => new Date(a.at) - new Date(b.at));
  const filtered = events.filter(
    (e) => knownBots.has(e.login.toLowerCase()) && new Date(e.at).getTime() >= anchorMs,
  );
  filtered.sort((a, b) => new Date(a.at) - new Date(b.at));
  return filtered;
}

export function checkRequiredBotsOnPr(owner, name, prNumber, { requiredKeys, anchorIso, repoRoot } = {}) {
  const state = readBotWaitState(prNumber, repoRoot);
  const keys =
    requiredKeys?.length ? requiredKeys : state?.requiredKeys?.length ? state.requiredKeys : resolveRequiredKeys();
  const knownBots = allKnownBotLogins(keys);
  const data = ghGraphql(owner, name, prNumber);
  const pr = data?.data?.repository?.pullRequest;
  if (!pr) throw new Error('GraphQL: pull request not found');
  const anchor = resolveAnchorIso(anchorIso || state?.anchor, pr.createdAt);
  const events = collectBotEvents(pr, knownBots, anchor, pr.createdAt);
  const seenLogins = [...new Set(events.map((e) => e.login))];
  const missing = missingRequiredKeysFromEvents(keys, events);
  return {
    requiredKeys: keys,
    anchor,
    missing,
    botsSeen: seenLogins,
    ok: missing.length === 0,
    detail: formatRequiredKeys(keys),
  };
}
