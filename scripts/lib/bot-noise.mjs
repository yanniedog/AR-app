/**
 * Shared classifier for bot comment bodies that should NOT keep the merge
 * gates open. Two consumers:
 *
 *   - wait_for_bots.mjs ignores noise events when computing the quiet window,
 *     so a chatty bot looping on quota errors can't hold the cap timeout open.
 *   - scripts/lib/gh-pr-review-threads.mjs treats noise threads as low-signal
 *     in classifyThreads, so an "out of credits" review thread can't fail the
 *     feedback gate just because nobody resolved it.
 *
 * Two categories:
 *
 *   - Quota / rate-limit notices ("we hit the API limit, try later").
 *   - Trivial inconsequential replies (ack-only / emoji-only / generic
 *     "useful?" footers) — these never carry actionable feedback.
 *
 * The bodies that prompted this filter were:
 *   - "Your <bot> trial has expired" / "subscription required" / "out of credits"
 *   - "Sorry, I couldn't review this PR — rate limit"
 *   - "Useful? React with 👍 / 👎" tail-only summary stubs
 *   - Single-emoji or "lgtm" replies
 */

// Match complete service notices, never keywords inside a code finding.
const NOTICE_REASON = '(?:API (?:limit|quota)(?: (?:exceeded|reached|exhausted))?|quota (?:exceeded|reached|exhausted)|rate[ -]?limit(?:ed)?(?: (?:exceeded|reached|hit))?|out of (?:credits?|tokens?|quota|usage)|insufficient (?:credits?|tokens?|funds|balance|quota)|subscription (?:required|expired)|trial (?:expired|ended|has expired)|service (?:temporarily )?unavailable|too many requests|please (?:try|come back) (?:again )?later)';
const QUOTA_PATTERNS = [
  new RegExp(`^(?:ERROR:\\s*)?(?:(?:Gemini|Qwen|CodeRabbit|Codex|Sourcery)\\s+)?${NOTICE_REASON}[.!]*$`, 'i'),
  new RegExp(`^(?:Sorry[,!.]?\\s*)?(?:(?:I|we)\\s+)?(?:could not|couldn't|unable to) review (?:this |the )?(?:PR|pull request)(?:\\s*[-—:]\\s*${NOTICE_REASON})?[.!]*$`, 'i'),
  /^ERROR:\s*(?:Gemini|Qwen|CodeRabbit|Codex|Sourcery)(?: API)?(?: returned)?(?: HTTP)? [45]\d\d[.!]*$/i,
  /^(?:Your )?(?:CodeRabbit|Sourcery|Codex|Gemini|Qwen)(?: review)? (?:trial has expired|subscription expired)[.!]*$/i,
  /^The consumer version has been (?:sunset|retired|deprecated); review activity has ceased[.!]*$/i,
  /^(?:You have|You've|We have|We've) (?:reached|exceeded|exhausted) (?:your |our |the )?(?:monthly|daily|free[- ]tier) (?:quota|limit)(?: for (?:code )?reviews)?(?:[.;:,]?\s*(?:please )?(?:upgrade your plan|try again tomorrow|try again next month))?[.!]*$/i,
  /^(?:Your |Our |The )?(?:monthly|daily|free[- ]tier) (?:review )?(?:quota|limit) (?:has been )?(?:reached|exceeded|exhausted)(?:[.;:,]?\s*(?:please )?(?:upgrade your plan|try again tomorrow|try again next month))?[.!]*$/i,
];

export function isQwenFailureNotice(bodyRaw) {
  // Match the workflow's structured failed-run notice, including its fenced
  // diagnostics. Finding text that merely mentions failed reviews stays live.
  return /^<!-- qwen-code-review -->\r?\n## Qwen Code Review\r?\n\r?\nReviewed commit: `[0-9a-f]{7,40}`\r?\nReview outcome: failed\r?\n\r?\nQwen Code Review did not complete successfully\. Qwen is not a required reviewer, so this notice does not block merge\.\r?\n\r?\n```text\r?\n[\s\S]*\r?\n```$/i.test(String(bodyRaw || '').trim());
}

const TRIVIAL_PATTERNS = [
  // Ack/no-op replies (the whole body, modulo whitespace and trailing puncts).
  /^[\s]*(?:lgtm|looks good(?:\s+to\s+me)?|ok|okay|got it|thanks?|thx|noted|nothing to (?:report|add)|no (?:comments?|issues?|concerns?)|all good|approved)[\s.!]*$/i,
  // Emoji-only / reaction-only.
  /^[\s\p{Emoji_Presentation}\p{Extended_Pictographic}‍👍👎❤️✅🚀]+$/u,
];

/**
 * @param {string} bodyRaw
 * @returns {boolean}
 */
export function isQuotaBotMessage(bodyRaw) {
  if (!bodyRaw) return false;
  const body = String(bodyRaw).trim();
  if (!body) return false;
  return QUOTA_PATTERNS.some((re) => re.test(body));
}

/**
 * @param {string} bodyRaw
 * @returns {boolean}
 */
export function isTrivialBotMessage(bodyRaw) {
  if (!bodyRaw) return true;
  const body = String(bodyRaw).trim();
  if (!body) return true;
  // "Useful? React with..." is a footer template. Strip it and re-check whether
  // anything substantive remains — bodies whose ONLY content is the footer get
  // dropped, but a real review with a footer tacked on stays.
  const withoutFooter = body.replace(/Useful\?\s*React with[\s\S]*$/i, '').trim();
  if (withoutFooter.length < 40) return true;
  return TRIVIAL_PATTERNS.some((re) => re.test(body));
}

/**
 * True when a bot comment body should not hold the merge gates open —
 * either it's a quota / API-limit notice, or a trivial inconsequential reply.
 *
 * @param {string} bodyRaw
 * @returns {boolean}
 */
export function isBotNoise(bodyRaw) {
  return isQuotaBotMessage(bodyRaw) || isQwenFailureNotice(bodyRaw) || isTrivialBotMessage(bodyRaw);
}
