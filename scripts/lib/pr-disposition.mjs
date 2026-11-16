/**
 * Review-thread dispositions (AGENTS.md "Per finding"). A thread whose latest
 * comment is a trusted human reply in one of these exact forms is closed
 * automatically; anything vaguer stays open for a person.
 */
const DISPOSITION = /^\s*(?:\*\*)?(implemented in [0-9a-f]{7,40}\b|deferred\s*[—–:-]\s*\S|declined\s*[—–:-]\s*\S)/i;
const TRUSTED_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);

export function dispositionOf(body) {
  if (typeof body !== 'string') return null;
  const match = DISPOSITION.exec(body);
  if (!match) return null;
  const word = match[1].toLowerCase();
  return word.startsWith('implemented') ? 'implemented' : word.startsWith('deferred') ? 'deferred' : 'declined';
}

/** comment: { body, authorAssociation, author: { login, __typename } } (GraphQL shape). */
export function isTrustedDisposition(comment) {
  if (!comment) return false;
  const login = comment.author?.login ?? '';
  if (!login || comment.author?.__typename === 'Bot' || login.endsWith('[bot]')) return false;
  if (!TRUSTED_ASSOCIATIONS.has(comment.authorAssociation)) return false;
  return dispositionOf(comment.body) !== null;
}

/** Unresolved threads whose current latest comment is a trusted disposition. */
export function threadsToResolve(threads) {
  return threads.filter(thread => !thread.isResolved && thread.comments?.totalCount > 1 &&
    isTrustedDisposition(thread.comments.nodes?.[thread.comments.nodes.length - 1]));
}
