const MAX_NATIVE_INTENT_LENGTH = 2_048;

const PUBLIC_ROUTES = new Set([
  'about',
  'bank',
  'banks',
  'browse',
  'calculator',
  'changelog',
  'compare',
  'node',
  'onboarding',
  'passthrough',
  'privacy',
  'product',
  'profile',
  'projections',
  'rate-receipt',
  'rba',
  'rba-response',
  'research',
  'search',
  'settings',
  'terms',
  'third-party-notices',
  'trends',
  'watchlist',
]);

function hasMalformedPercentEncoding(value: string): boolean {
  return /%(?![0-9a-f]{2})/i.test(value);
}

/** Bound and normalize external intents before Expo Router parses route input. */
export function sanitizeNativeIntentPath(value: unknown): string {
  if (typeof value !== 'string') return '/';
  const raw = value.trim();
  if (
    raw.length === 0 ||
    raw.length > MAX_NATIVE_INTENT_LENGTH ||
    /[\u0000-\u001f\\]/.test(raw) ||
    hasMalformedPercentEncoding(raw)
  ) {
    return '/';
  }

  let internal = raw;
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(raw);
  if (scheme) {
    if (scheme[1].toLowerCase() !== 'arrates') return '/';
    internal = raw.slice(scheme[0].length);
    internal = `/${internal.replace(/^\/+/, '')}`;
  } else if (!internal.startsWith('/')) {
    internal = `/${internal}`;
  }

  const routePath = internal.split(/[?#]/, 1)[0];
  const firstSegment = routePath.split('/').filter(Boolean)[0];
  if (!firstSegment) return '/';
  if (!PUBLIC_ROUTES.has(firstSegment)) return '/';
  if (firstSegment === 'privacy') {
    const suffix = /[?#].*$/.exec(internal)?.[0] ?? '';
    return `/terms${suffix}`;
  }
  return internal;
}

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return sanitizeNativeIntentPath(path);
}
