import type { DetailItem, ProductDetail } from '../types';

/**
 * Public-availability assessment for a product. CDR lenders chronically
 * under-report eligibility: a "Staff Home Loan" with a market-leading rate often
 * carries only MIN_AGE/RESIDENCY in its structured eligibility, leaving the real
 * restriction in the product name/description. We therefore combine the structured
 * eligibilityType codes with name/description/free-text signals, and explicitly
 * flag the gap ("verify") when the name implies a restriction the data does not
 * encode — so a restricted product is never silently presented as open to all.
 */
export type AccessCategory =
  | 'staff'
  | 'occupation'
  | 'membership'
  | 'business'
  | 'student'
  | 'pension'
  | 'geographic';

export interface AccessAssessment {
  /** Any access-limiting signal (structured or textual) is present. */
  restricted: boolean;
  categories: AccessCategory[];
  /** Name/description implies a restriction the structured eligibility data does NOT encode. */
  verify: boolean;
  /** Short chip text, e.g. "Staff only" / "Members only" / "Check eligibility". */
  badge: string | null;
  /** One-line plain-English summary for the product page. */
  summary: string;
}

const CATEGORY_LABEL: Record<AccessCategory, string> = {
  staff: 'Staff only',
  occupation: 'Occupation-restricted',
  membership: 'Members only',
  business: 'Business / SMSF',
  student: 'Students',
  pension: 'Pensioners',
  geographic: 'Region-restricted',
};

// Structured CDR eligibilityType codes that genuinely limit who can apply.
// (MIN_AGE/RESIDENCY_STATUS/NATURAL_PERSON are near-universal and not restrictions.)
// EMPLOYMENT_STATUS is intentionally omitted: CDR lenders use it for ordinary
// "must be employed / self-employed" credit checks (Westpac, UBank, …), not for
// occupation-gated products. Occupation still comes from name/provider/text.
const RESTRICTING_TYPES: Record<string, AccessCategory> = {
  STAFF: 'staff',
  BUSINESS: 'business',
  STUDENT: 'student',
  PENSION_RECIPIENT: 'pension',
};

const OCCUPATION_RE =
  /\b(police|nurs(?:e|es|ing)|midwi(?:fe|ves)|teacher|educator(?:s)?|doctor|dentist|dental|veterinar(?:y|ian|ians)|health\s*(?:care|sector|worker|professional)s?|medical|defence|defense|military|navy|army|veteran|firefighter|fire\s*service|ambulance|paramedic|emergency\s*services|first\s*responder|essential\s*workers?)\b/i;
const STAFF_RE = /\b(staff|employe[er]|colleague)\b/i;
const MEMBERSHIP_RE = /\bmembers?\s+of\b|\bassociation\b|\bunion\b|\balumni\b|\bdiocese\b|\bparish\b/i;
const BUSINESS_RE = /\b(business|commercial|corporate|company|smsf|self[-\s]?managed\s+super|trust)\b/i;
const STUDENT_RE = /\bstudent[s]?\b/i;
const GEO_RE = /\bresidents?\s+of\b|\bonly\s+available\s+in\b/i;

function textOf(name: string, detail: ProductDetail | null | undefined): string {
  const parts: string[] = [name || '', detail?.description || ''];
  const push = (items?: DetailItem[]) => {
    for (const it of items ?? []) {
      if (it.name) parts.push(String(it.name));
      if (it.info) parts.push(String(it.info));
      if (it.value) parts.push(String(it.value));
    }
  };
  push(detail?.eligibility);
  push(detail?.constraints);
  return parts.join(' • ');
}

function eligibilityCodes(detail: ProductDetail | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const it of detail?.eligibility ?? []) {
    const code = (it.label ?? '').trim().toUpperCase();
    if (code) out.add(code);
  }
  return out;
}

/**
 * Classify a product's public availability from its name + details.
 * `name` is the product name (from the rate row); `detail` is the cached
 * ProductDetail (may be null while details load — then only the name/provider
 * are used). Pass `provider` so occupation lenders with generic product titles
 * (e.g. Australian Military Bank "RateSaver Home Loan") are still classified.
 */
export function assessAccess(
  name: string,
  detail: ProductDetail | null | undefined,
  provider?: string | null,
): AccessAssessment {
  const codes = eligibilityCodes(detail);
  const text = textOf(name, detail);
  const nameText = name || '';
  const providerText = provider || '';

  const cats = new Set<AccessCategory>();
  // Structured codes are authoritative.
  for (const [code, cat] of Object.entries(RESTRICTING_TYPES)) {
    if (codes.has(code)) cats.add(cat);
  }
  // Textual signals from product name + detail copy.
  if (STAFF_RE.test(text)) cats.add('staff');
  if (OCCUPATION_RE.test(text)) cats.add('occupation');
  if (MEMBERSHIP_RE.test(text)) cats.add('membership');
  if (STUDENT_RE.test(text)) cats.add('student');
  if (GEO_RE.test(text)) cats.add('geographic');
  // Provider brand: occupation/staff only. Do not run membership `\bunion\b`
  // against provider names or every "* Credit Union" becomes members-only.
  if (STAFF_RE.test(providerText)) cats.add('staff');
  if (OCCUPATION_RE.test(providerText)) cats.add('occupation');
  // Business: ONLY from the structured BUSINESS code (handled above) or the
  // product NAME. Free-text "company/trust/commercial" mentions in eligibility
  // are almost always EXCLUSIONS ("not available to companies or trusts") and
  // would wrongly flag popular retail products (Unloan, Virgin Money Lite).
  // Do not match provider names here (many "X Business Bank" style brands).
  if (BUSINESS_RE.test(nameText)) cats.add('business');

  // "Verify": the NAME/PROVIDER implies staff/occupation/membership but no
  // structured eligibility code corroborates it (Coastline/People-First mode).
  const nameImpliesRestriction =
    STAFF_RE.test(nameText) ||
    OCCUPATION_RE.test(nameText) ||
    MEMBERSHIP_RE.test(nameText) ||
    OCCUPATION_RE.test(providerText) ||
    STAFF_RE.test(providerText);
  const structurallyConfirmed =
    codes.has('STAFF') || codes.has('BUSINESS') || codes.has('STUDENT') || codes.has('PENSION_RECIPIENT');
  const verify = nameImpliesRestriction && !structurallyConfirmed;

  const categories = Array.from(cats);
  const restricted = categories.length > 0;

  let badge: string | null = null;
  if (categories.length) badge = CATEGORY_LABEL[categories[0]];
  else if (verify) badge = 'Check eligibility';

  let summary: string;
  if (restricted) {
    const human = categories.map((c) => CATEGORY_LABEL[c].toLowerCase()).join(', ');
    summary = `Not open to everyone — eligibility applies (${human}).`;
    if (verify) {
      summary += ' The lender hasn’t encoded this in their eligibility data, so confirm the exact criteria directly.';
    }
  } else if (verify) {
    summary =
      'The product name suggests restricted eligibility, but the lender’s eligibility data doesn’t confirm it. Verify directly before relying on this rate.';
  } else {
    summary = 'Appears open to the general public based on the lender’s eligibility data.';
  }

  return { restricted, categories, verify, badge, summary };
}

/**
 * Row-level access restriction derived from product NAME + PROVIDER (no details
 * required). This is the cheap half of {@link assessAccess} the default
 * suitability filter runs over every rate row so staff-only, occupation,
 * membership, business/SMSF, student and region-restricted products are not
 * surfaced as headline/search/ranking results. Provider is included because
 * occupation lenders often publish generic titles ("RateSaver Home Loan") under
 * an occupation-gated brand ("Australian Military Bank", "Police Bank").
 * Structured eligibility codes (from loaded details) add more signal via
 * {@link assessAccess}.
 */
export function nameRestrictsAccess(name: string | null | undefined): boolean {
  const text = name ?? '';
  if (!text) return false;
  return (
    STAFF_RE.test(text) ||
    OCCUPATION_RE.test(text) ||
    MEMBERSHIP_RE.test(text) ||
    STUDENT_RE.test(text) ||
    GEO_RE.test(text) ||
    BUSINESS_RE.test(text)
  );
}

/** True when the lender brand itself implies an occupation/staff gate. */
export function providerRestrictsAccess(provider: string | null | undefined): boolean {
  const text = provider ?? '';
  if (!text) return false;
  // Occupation/staff only — do NOT apply membership `\bunion\b` here, or every
  // "* Credit Union" lender would be treated as members-only.
  return STAFF_RE.test(text) || OCCUPATION_RE.test(text);
}

/** Cheap row gate used by list/search/ranking before details are loaded. */
export function rowRestrictsAccess(
  row: { product_name?: string | null; provider?: string | null } | null | undefined,
): boolean {
  if (!row) return false;
  return nameRestrictsAccess(row.product_name) || providerRestrictsAccess(row.provider);
}

/** Which name-signal categories fire for a product name (may be empty). */
export function nameRestrictionCategories(name: string | null | undefined): AccessCategory[] {
  const text = name ?? '';
  if (!text) return [];
  const cats: AccessCategory[] = [];
  if (STAFF_RE.test(text)) cats.push('staff');
  if (OCCUPATION_RE.test(text)) cats.push('occupation');
  if (MEMBERSHIP_RE.test(text)) cats.push('membership');
  if (BUSINESS_RE.test(text)) cats.push('business');
  if (STUDENT_RE.test(text)) cats.push('student');
  if (GEO_RE.test(text)) cats.push('geographic');
  return cats;
}

export type SuitabilityExclusionCounts = {
  total: number;
  nonStandard: number;
  byAccess: Partial<Record<AccessCategory, number>>;
};

/**
 * Count rows the default suitability filter would hide, split by non-standard
 * account class vs name-access category. Used for diagnostics / false-positive
 * watch (Phase 1.1) — not for filtering itself.
 */
export function countSuitabilityExclusions(
  rows: Iterable<{ account_class?: string | null; product_name?: string | null }>,
): SuitabilityExclusionCounts {
  const byAccess: Partial<Record<AccessCategory, number>> = {};
  let total = 0;
  let nonStandard = 0;
  for (const row of rows) {
    const ns = row.account_class === 'non_standard';
    const cats = nameRestrictionCategories(row.product_name);
    if (!ns && !cats.length) continue;
    total += 1;
    if (ns) nonStandard += 1;
    for (const cat of cats) {
      byAccess[cat] = (byAccess[cat] ?? 0) + 1;
    }
  }
  return { total, nonStandard, byAccess };
}
