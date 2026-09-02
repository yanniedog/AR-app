import React from 'react';
import { RateMark } from './RateMark';

/** Compatibility wrapper for callers that predate the Rate Ledger mark. */
export function ArMarkLogo({ size = 36 }: { size?: number }) {
  return <RateMark size={size} accessibilityLabel="Australian Rates mark" />;
}
