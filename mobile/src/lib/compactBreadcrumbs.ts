import type { Breadcrumb } from './breadcrumbs';

const SHORT_LABELS: Record<string, string> = {
  'Home loans': 'Loans',
  'Savings accounts': 'Savings',
  'Savings account': 'Savings',
  'Term deposits': 'Term dep.',
  'Owner-occupied': 'Owner',
  'Principal & interest': 'P&I',
  'Variable rate': 'Variable',
  'Fixed rate': 'Fixed',
  'Products without listed rates': 'Catalogue',
  'My scenario': 'Scenario',
  'What if rates change?': 'Projections',
  'Open calculation receipt': 'Receipt',
  'Bank-call brief': 'Brief',
  'Open-source notices': 'Licences',
  'App health audit': 'Audit',
  'Your profile': 'Profile',
  'Rate research': 'Research',
  'Bank response': 'Response',
  'Paid at maturity': 'At maturity',
  'Paid monthly': 'Monthly',
  'Tiered balance': 'Tiered',
};

/** Display only: keep canonical labels and destinations intact for navigation and accessibility. */
export function shortBreadcrumbLabel(label: string, maxCharacters = 18): string {
  const short = Object.hasOwn(SHORT_LABELS, label) ? SHORT_LABELS[label] : label;
  const characters = Array.from(short);
  return characters.length > maxCharacters
    ? `${characters.slice(0, maxCharacters - 1).join('').trimEnd()}…`
    : short;
}

/** Always show at most the parent and current page, even on wide screens. */
export function compactBreadcrumbs(crumbs: Breadcrumb[], width: number, fontScale: number) {
  let visibleCount = Math.min(2, crumbs.length);
  if (visibleCount === 2) {
    const [parent, current] = crumbs.slice(-2);
    const characters = Array.from(shortBreadcrumbLabel(parent.label, 12)).length
      + Array.from(shortBreadcrumbLabel(current.label)).length;
    // Reserve Home, overflow, chevrons and padding; large text gets just the current page.
    const controls = 44 + (crumbs.length > 2 ? 44 : 0) + 2 * (12 + 16) + 8;
    if (controls + characters * 8 * fontScale > width) visibleCount = 1;
  }
  return {
    hidden: crumbs.slice(0, crumbs.length - visibleCount),
    visible: crumbs.slice(crumbs.length - visibleCount),
  };
}
