import { humanizeEnum } from './format';
import { parseLvrTier } from './profile';
import { uiDecimal, uiJoin, type UiText } from '../lib/uiCopy';

// Kept outside format.ts/profile.ts: those files are pinned inside the
// history-ready compiler bundle, and display copy must not change its digest.

/**
 * Display label for a raw payload `lvr_tier` such as "lvr_=60%" or "lvr_85-90%".
 * The published "=60" band is the ≤60% tier (taxonomy `LVR_LE60`). Returns null
 * for values that are not recognisable LVR tiers so callers can fall back.
 */
export function lvrTierLabel(value: string): UiText | null {
  const tier = /^lvr_(.*)$/i.exec(value.trim());
  if (!tier) return null;
  const v = tier[1].replace(/%/g, '').trim().toLowerCase();
  if (!v || v.includes('unspec') || v === 'na' || v === 'n/a') return uiJoin('LVR', ' · ', 'Unknown');
  let m = /^(?:=|<=|≤)?(\d+(?:\.\d+)?)$/.exec(v);
  if (m) return uiJoin('LVR', ' ', '≤', uiDecimal(m[1], 'percent'));
  m = /^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/.exec(v);
  if (m) return uiJoin('LVR', ' ', uiDecimal(m[1], 'count'), '–', uiDecimal(m[2], 'percent'));
  m = /^(?:>|gt)(\d+(?:\.\d+)?)$|^(\d+(?:\.\d+)?)\+$/.exec(v);
  if (m) return uiJoin('LVR', ' ', '>', uiDecimal(m[1] ?? m[2], 'percent'));
  return null;
}

/**
 * Rewrite LVR wording in the trailing "(…)" suffix of a stored product label
 * (e.g. an alert saved by an older build as "Bank · Loan (Variable · LVR =60%)")
 * to the current band labels. Only percentage tokens are parsed back through
 * `lvrTierLabel`, so product names and current labels pass unchanged.
 */
export function refreshLvrLabelText(label: string): string {
  return label.replace(/\(([^()]*)\)$/, (_suffix, inner: string) => `(${inner.replace(
    /\bLVR ([^\s·()]*%)/g,
    (whole, token: string) => lvrTierLabel(`lvr_${token}`) ?? whole,
  )})`);
}

/** `humanizeEnum` for an `lvr_tier` value, with recognised bands labelled exactly. */
export function lvrTierDisplay(value: string | null | undefined): UiText {
  return (value ? lvrTierLabel(value) : null) ?? humanizeEnum(value);
}

/** Order raw `lvr_tier` values from the lowest band up; tiers without a range sort last. */
export function compareLvrTiers(a: string, b: string): number {
  const ra = parseLvrTier(a);
  const rb = parseLvrTier(b);
  if (!ra || !rb) return ra ? -1 : rb ? 1 : a.localeCompare(b);
  return ra.hi - rb.hi || ra.lo - rb.lo;
}
