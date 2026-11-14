/** Literal source paging; this helper grants no rendering or source authority. */
export const PRODUCT_EVIDENCE_PAGE_CHARACTERS = 16384;
export function productEvidenceTextSlice(text: string, page: number) {
  const pages = Math.max(1, Math.ceil(text.length / PRODUCT_EVIDENCE_PAGE_CHARACTERS));
  if (!Number.isSafeInteger(page) || page < 0 || page >= pages) throw new Error('Evidence page is out of range');
  const boundary = (at: number) => at > 0 && at < text.length && /[\uD800-\uDBFF]/.test(text[at - 1]) && /[\uDC00-\uDFFF]/.test(text[at]) ? at - 1 : at;
  const start = boundary(page * PRODUCT_EVIDENCE_PAGE_CHARACTERS), end = boundary(Math.min(text.length, (page + 1) * PRODUCT_EVIDENCE_PAGE_CHARACTERS));
  return { page, pages, start, end, characters: text.length, text: text.slice(start, end) };
}
