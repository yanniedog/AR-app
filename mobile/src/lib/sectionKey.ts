import type { SectionKey } from '../types';

export function isSectionKey(value: unknown): value is SectionKey {
  return value === 'Mortgage' || value === 'Savings' || value === 'TD';
}
