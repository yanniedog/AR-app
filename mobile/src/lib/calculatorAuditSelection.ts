import type { SectionKey } from '../types';

/** Report the section observed before applying the mounted screen's selection. */
export function applyCalculatorAuditSection(
  selectedSection: SectionKey,
  requestedSection: SectionKey,
  changeSection: (section: SectionKey) => void,
) {
  changeSection(requestedSection);
  return { selectedSectionBefore: selectedSection, requestedSection };
}

/** A repeated explicit selection needs ready probes, but cannot produce a new render revision. */
export function isVerifiedCalculatorSectionSelection(
  actionId: string,
  requestedSection: unknown,
  result: unknown,
): boolean {
  const expectedSection = actionId === 'calculator.section.mortgage' ||
    actionId === 'calculator.section.return-mortgage'
    ? 'Mortgage'
    : actionId === 'calculator.section.savings' ? 'Savings' : null;
  if (expectedSection == null || requestedSection !== expectedSection ||
    result == null || typeof result !== 'object' || Array.isArray(result)) return false;
  return 'selectedSectionBefore' in result && result.selectedSectionBefore === expectedSection &&
    'requestedSection' in result && result.requestedSection === expectedSection;
}
