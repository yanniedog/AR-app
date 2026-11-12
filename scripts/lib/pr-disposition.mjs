/**
 * Review-thread dispositions (AGENTS.md "Per finding"): a trusted in-thread
 * reply starting with one of these closes the thread without a human click.
 */
const DISPOSITION = /^\s*(?:\*\*)?(implemented in [0-9a-f]{7,40}\b|implemented\b|deferred\s*[—–:-]|declined\s*[—–:-]|declined in part\b)/i;
const TRUSTED_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);

export function dispositionOf(body) {
  if (typeof body !== 'string') return null;
  const match = DISPOSITION.exec(body);
  if (!match) return null;
  const word = match[1].toLowerCase();
  return word.startsWith('implemented') ? 'implemented' : word.startsWith('deferred') ? 'deferred' : 'declined';
}

/** Only a trusted, non-bot reply to an existing thread may close it. */
export function shouldAutoResolve(comment) {
  if (!comment || !comment.in_reply_to_id) return false;
  const login = comment.user?.login ?? '';
  if (comment.user?.type === 'Bot' || login.endsWith('[bot]')) return false;
  if (!TRUSTED_ASSOCIATIONS.has(comment.author_association)) return false;
  return dispositionOf(comment.body) !== null;
}
