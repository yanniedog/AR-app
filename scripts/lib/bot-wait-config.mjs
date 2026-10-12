/**
 * Required-bot aliases for wait-for-bots and pr-bot-feedback-check.
 * Keys are short names; values are GitHub logins to match.
 */
import { isBotNoise, isQuotaBotMessage, isQwenFailureNotice } from './bot-noise.mjs';

export const BOT_ALIASES = {
  gemini: [
    'gemini-code-assist',
    'gemini-code-assist[bot]',
    'google-github-actions-bot[bot]',
    'google-github-actions[bot]',
    // sshnaidm/gemini-code-review-action posts as github-actions[bot]
    // and is matched only via isGeminiCodeReviewBody / eventSatisfiesRequiredKey —
    // do NOT put github-actions[bot] here (login-only consumers would false-positive).
  ],
  codex: [
    'chatgpt-codex-connector',
    'chatgpt-codex-connector[bot]',
  ],
  cursor: [
    'cursor',
    'cursor[bot]',
  ],
  sourcery: ['sourcery-ai', 'sourcery-ai[bot]'],
  copilot: ['copilot-pull-request-reviewer', 'copilot-pull-request-reviewer[bot]'],
  coderabbit: ['coderabbitai', 'coderabbitai[bot]'],
  greptile: ['greptile-apps', 'greptile-apps[bot]'],
  qwen: ['github-actions[bot]'],
};

// No automated reviewer is merge-required by default. Review services remain
// advisory unless an owner explicitly supplies AR_BOT_WAIT_REQUIRED.
export const DEFAULT_REQUIRED_KEYS = [];

export const OPTIONAL_BOT_LOGINS = [
  'github-actions[bot]',
  'copilot-pull-request-reviewer[bot]',
  'coderabbitai',
  'coderabbitai[bot]',
  'greptile-apps[bot]',
];

export function isQwenCodeReviewBody(bodyRaw) {
  return /<!--\s*(qwen-code-review|cursor-auto-review)\s*-->/i.test(String(bodyRaw || ''));
}

export function reviewedCommitFromBody(bodyRaw) {
  return String(bodyRaw || '').match(/\bReviewed commit:\s*`?([0-9a-f]{7,40})`?/i)?.[1]?.toLowerCase() || null;
}

export function isGeminiCodeReviewBody(bodyRaw) {
  const body = String(bodyRaw || '');
  return (
    /<!--\s*gemini-code-review\s*-->/i.test(body) ||
    /#\s*Code Review by Gemini/i.test(body) ||
    /\bCode Review by Gemini\b/i.test(body)
  );
}

/**
 * Body-aware match so github-actions[bot] Qwen and Gemini reviews are not
 * confused with each other, and quota/error notices cannot satisfy presence.
 */
export function eventSatisfiesRequiredKey(login, body, key, opts = {}) {
  const lower = String(login || '').toLowerCase();
  const k = String(key || '').toLowerCase();
  if (!lower) return false;
  if (k === 'qwen') {
    const markerMatches =
      lower === 'github-actions[bot]' &&
      isQwenCodeReviewBody(body) &&
      /\bReview outcome:\s*(completed|no findings|findings)\b/i.test(String(body || '')) &&
      !/did not complete successfully|review failed/i.test(String(body || ''));
    if (!markerMatches) return false;
    if (!opts.expectedHeadSha) return true;
    const reviewed = reviewedCommitFromBody(body);
    const expected = String(opts.expectedHeadSha).toLowerCase();
    return Boolean(reviewed && (reviewed === expected || expected.startsWith(reviewed)));
  }
  if (isReviewerNonsenseFailure(body)) return false;
  if (k === 'gemini') {
    if (lower === 'github-actions[bot]') {
      return isGeminiCodeReviewBody(body) && !/^\s*ERROR:/i.test(String(body || ''));
    }
    return loginMatchesRequiredKey(login, 'gemini');
  }
  return loginMatchesRequiredKey(login, key);
}

const NO_FINDINGS_REVIEW = /^(?:lgtm|looks good(?:\s+to\s+me)?|no (?:comments?|issues?|concerns?)|nothing to (?:report|add)|all good|approved)[\s.!]*$/i;

/** Short no-findings reviews still start the quiet window when they count as presence. */
export function isQuietWindowNoise(login, body) {
  if (body === 'thumbs-up no-findings reaction') return false;
  const text = String(body || '').trim();
  if (NO_FINDINGS_REVIEW.test(text)
    && ['codex', 'sourcery'].some((key) => eventSatisfiesRequiredKey(login, body, key))) {
    return false;
  }
  return isBotNoise(body) || isReviewerNonsenseFailure(body);
}

export function missingRequiredKeysFromEvents(requiredKeys, events, opts = {}) {
  const keys = omitNeverRequiredKeys(requiredKeys);
  return keys.filter(
    (key) => !(events || []).some((e) => eventSatisfiesRequiredKey(e.login, e.body, key, opts)),
  );
}

const REVIEWER_NONSENSE_PATTERNS = [
  /^(?:ERROR:\s*)?empty review[.!]*$/i,
];

/**
 * Quota, API errors, empty reviews, and "could not review" notices are not a
 * completed review. A blank body is the same kind of non-substantive failure.
 */
function isSuccessfulQwenReview(body) {
  return isQwenCodeReviewBody(body)
    && /\bReview outcome:\s*(completed|no findings|findings)\b/i.test(body)
    && !/did not complete successfully|review failed/i.test(body);
}

export function isReviewerNonsenseFailure(bodyRaw) {
  const body = String(bodyRaw ?? '').trim();
  if (!body) return true;
  // A completed Qwen review stays required even when a finding mentions quota
  // or an HTTP status. Only an actual failed or quota-only notice is nonsense.
  if (isSuccessfulQwenReview(body)) return false;
  return isQuotaBotMessage(body) || isQwenFailureNotice(body)
    || REVIEWER_NONSENSE_PATTERNS.some((pattern) => pattern.test(body));
}

function eventsForRequiredKey(key, events) {
  const normalized = String(key || '').toLowerCase();
  return (events || []).filter((event) => {
    const login = String(event?.login || '');
    const body = event?.body || '';
    if (normalized === 'qwen') {
      return login.toLowerCase() === 'github-actions[bot]' && isQwenCodeReviewBody(body);
    }
    if (normalized === 'gemini') {
      if (login.toLowerCase() === 'github-actions[bot]') return isGeminiCodeReviewBody(body);
      return loginMatchesRequiredKey(login, 'gemini');
    }
    return loginMatchesRequiredKey(login, normalized);
  });
}

/**
 * Gemini absence, quota, and other non-substantive failures never block.
 * Qwen, including a missing review, never blocks. Codex and Sourcery still
 * block when they have not posted. A quota-only or nonsense-only post from
 * those reviewers does not block. Substantive Gemini threads stay on the
 * feedback gate.
 */
export function blockingMissingRequiredKeys(missing, events) {
  return omitNeverRequiredKeys(missing).filter((key) => {
    const normalized = String(key || '').toLowerCase();
    if (normalized === 'gemini' || normalized === 'qwen') return false;
    const related = eventsForRequiredKey(normalized, events);
    if (related.length === 0) return true;
    return !related.every((event) => isReviewerNonsenseFailure(event.body));
  });
}

export function parseRequiredKeys(raw) {
  if (!raw || !String(raw).trim()) return [...DEFAULT_REQUIRED_KEYS];
  if (/^(?:off|none|disabled)$/i.test(String(raw).trim())) return [];
  return omitNeverRequiredKeys(String(raw)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean));
}

const NEVER_REQUIRED_KEYS = new Set(['qwen', ...BOT_ALIASES.qwen]);

export function omitNeverRequiredKeys(keys) {
  return (keys || []).filter((key) => !NEVER_REQUIRED_KEYS.has(String(key || '').trim().toLowerCase()));
}

export function resolveRequiredKeys(argvKeys, envRaw) {
  if (argvKeys !== null && argvKeys !== undefined) return omitNeverRequiredKeys(argvKeys);
  const fromEnv = envRaw ?? process.env.AR_BOT_WAIT_REQUIRED ?? process.env.BOT_WAIT_REQUIRED ?? '';
  return parseRequiredKeys(fromEnv);
}

/**
 * Fork PRs cannot run the secret-backed Gemini Actions workflow, so require
 * gemini only for same-repo heads.
 * @param {string[]} requiredKeys
 * @param {{ isFork?: boolean }} opts
 */
export function adjustRequiredKeysForPrContext(requiredKeys, opts = {}) {
  let keys = omitNeverRequiredKeys(requiredKeys);
  if (opts.isFork) keys = keys.filter((k) => k.toLowerCase() !== 'gemini');
  return keys;
}

export function loginsForKey(key) {
  const k = key.toLowerCase();
  if (BOT_ALIASES[k]) return BOT_ALIASES[k].slice();
  if (k.includes('[') || k.includes('-')) return [key];
  return [key];
}

export function allKnownBotLogins(requiredKeys) {
  const set = new Set();
  for (const key of requiredKeys) {
    for (const login of loginsForKey(key)) set.add(login.toLowerCase());
  }
  for (const login of OPTIONAL_BOT_LOGINS) set.add(login.toLowerCase());
  return set;
}

export function loginMatchesRequiredKey(login, key) {
  if (!login) return false;
  const lower = login.toLowerCase();
  return loginsForKey(key).some((alias) => lower === alias.toLowerCase());
}

export function missingRequiredKeys(requiredKeys, seenLogins) {
  const seen = [...(seenLogins || [])];
  return omitNeverRequiredKeys(requiredKeys).filter(
    (key) => !seen.some((login) => loginMatchesRequiredKey(login, key)),
  );
}

export function formatRequiredKeys(keys) {
  return keys.length
    ? keys.map((k) => `${k} (${loginsForKey(k).join(' | ')})`).join(', ')
    : 'none (review bots are advisory)';
}
