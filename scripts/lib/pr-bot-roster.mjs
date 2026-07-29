/**
 * Bot column roster for the PR bot spreadsheet (rows = PRs, columns = bots).
 * Extends bot-wait-config.mjs with optional reviewers tracked in the matrix.
 */
import {
  BOT_ALIASES,
  eventSatisfiesRequiredKey,
  isGeminiCodeReviewBody,
  loginMatchesRequiredKey,
} from './bot-wait-config.mjs';

/** Column order for the spreadsheet (after PR metadata columns). */
export const SPREADSHEET_BOT_KEYS = ['gemini', 'codex', 'sourcery', 'copilot', 'coderabbit', 'greptile'];

export const BOT_KEY_LABELS = {
  gemini: 'Gemini',
  codex: 'Codex',
  sourcery: 'Sourcery',
  copilot: 'Copilot',
  coderabbit: 'CodeRabbit',
  greptile: 'Greptile',
};

/** Optional bots not in BOT_ALIASES but tracked as columns. */
const OPTIONAL_KEY_LOGINS = {
  copilot: ['copilot-pull-request-reviewer[bot]'],
  coderabbit: ['coderabbitai[bot]'],
  greptile: ['greptile-apps[bot]'],
};

/**
 * @param {string | null | undefined} login
 * @param {string} key
 * @param {string | null | undefined} [body]
 * @returns {boolean}
 */
export function loginMatchesBotKey(login, key, body) {
  if (!login || !key) return false;
  if (key === 'gemini') return eventSatisfiesRequiredKey(login, body, 'gemini');
  if (BOT_ALIASES[key] && loginMatchesRequiredKey(login, key)) return true;
  const aliases = OPTIONAL_KEY_LOGINS[key];
  if (!aliases) return false;
  const lower = login.toLowerCase();
  return aliases.some((alias) => lower === alias.toLowerCase());
}

/**
 * @param {string | null | undefined} login
 * @param {string | null | undefined} [body]
 * @returns {string | null}
 */
export function loginToBotKey(login, body) {
  if (!login) return null;
  const lower = login.toLowerCase();
  if (lower === 'github-actions[bot]') {
    return isGeminiCodeReviewBody(body) ? 'gemini' : null;
  }
  for (const key of SPREADSHEET_BOT_KEYS) {
    if (loginMatchesBotKey(login, key, body)) return key;
  }
  return null;
}

export const SPREADSHEET_HEADER = [
  'PR #',
  'Title',
  'Merged At',
  'URL',
  ...SPREADSHEET_BOT_KEYS.map((k) => BOT_KEY_LABELS[k] || k),
];
