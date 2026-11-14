/** Shared UI ownership: replacing a view releases its retained large source document. */
let owner: { cancel: () => void } | null = null;
export function claimEvidenceUi(cancel: () => void) {
  owner?.cancel();
  const lease = { cancel }; owner = lease;
  return { current: () => owner === lease, release: () => { if (owner === lease) owner = null; } };
}
