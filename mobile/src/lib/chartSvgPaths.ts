function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function finiteCoord(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

function joinLineTo(points: string[]): string {
  return points.length ? ` L ${points.join(' L ')}` : '';
}

/** Open line path; optionally restart after null/invalid values instead of bridging gaps. */
export function buildLinePath(
  values: (number | null)[],
  xAt: (i: number) => number,
  yAt: (v: number) => number,
  breakOnGaps = false,
): string | null {
  let d = '';
  let started = false;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (!isFiniteNumber(value)) {
      if (breakOnGaps) started = false;
      continue;
    }
    const x = finiteCoord(xAt(i));
    const y = finiteCoord(yAt(value));
    if (x == null || y == null) {
      if (breakOnGaps) started = false;
      continue;
    }
    const segment = `${started ? 'L' : 'M'} ${x} ${y}`;
    d += started || d ? ` ${segment}` : segment;
    started = true;
  }
  return d || null;
}

/** Closed min/max ribbon path for react-native-svg `<Path d={...} />`. */
export function buildBandPath(
  dates: string[], mins: (number | null)[], maxs: (number | null)[],
  xAt: (i: number) => number, yAt: (v: number) => number, breakOnGaps = false,
): string | null {
  const segments: string[] = []; let upper: string[] = [], lower: string[] = [];
  const flush = () => {
    if (upper.length) segments.push(`M ${upper[0]}${joinLineTo(upper.slice(1))}${joinLineTo(lower)} Z`);
    upper = []; lower = [];
  };
  for (let i = 0; i < dates.length; i += 1) {
    const min = mins[i], max = maxs[i];
    if (!isFiniteNumber(min) || !isFiniteNumber(max)) { if (breakOnGaps) flush(); continue; }
    const x = finiteCoord(xAt(i)), yMin = finiteCoord(yAt(min)), yMax = finiteCoord(yAt(max));
    if (x == null || yMin == null || yMax == null) { if (breakOnGaps) flush(); continue; }
    upper.push(`${x},${yMax}`); lower.unshift(`${x},${yMin}`);
  }
  flush(); return segments.join(' ') || null;
}
