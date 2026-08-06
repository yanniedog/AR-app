export interface TouchPoint {
  x: number;
  y: number;
}

/** Distinguish a completed tap from a scroll so passive consent does not fire while swiping. */
export function isDiagnosticsConsentTap(
  start: TouchPoint | null,
  end: TouchPoint,
  maximumMovement = 10,
): boolean {
  if (!start) return false;
  return Math.hypot(end.x - start.x, end.y - start.y) <= maximumMovement;
}
