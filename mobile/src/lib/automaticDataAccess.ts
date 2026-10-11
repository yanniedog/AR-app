import { StandardUrl as URL } from './standardUrl';

export const GITHUB_RELEASE_ORIGIN = 'https://github.com';
export const PUBLIC_PAYLOAD_BASE = 'https://raw.githubusercontent.com/yanniedog/AR-local/app-payload-public';

/** Canonical publication identities remain unchanged by their delivery route. */
export function trustedPayloadReleaseUrl(source: string): string | null {
  try {
    const url = new URL(source);
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port ||
        url.username || url.password || url.hash) return null;
    const match = /^\/yanniedog\/AR-local\/releases\/download\/(app-payload-(?:latest|\d{4}-\d{2}-\d{2}(?:-r\d{6})?))\/([A-Za-z0-9][A-Za-z0-9_.-]*\.json(?:\.gz(?:\.enc)?)?)$/.exec(url.pathname);
    if (!match || match[2].includes('..')) return null;
    for (const name of url.searchParams.keys()) if (name !== '_') return null;
    return url.href;
  } catch { return null; }
}

/** Direct readable GitHub data branch, shared by native and CORS-bound browsers. */
export function automaticDataUrl(source: string): string | null {
  const canonical = trustedPayloadReleaseUrl(source);
  if (!canonical) return null;
  const url = new URL(canonical);
  const [tag, name] = url.pathname.slice('/yanniedog/AR-local/releases/download/'.length).split('/');
  const directory = tag === 'app-payload-latest' && ['manifest.json', 'dates-index.json'].includes(name)
    ? 'latest' : `tags/${tag}`;
  return `${PUBLIC_PAYLOAD_BASE}/${directory}/${name}${url.search}`;
}

/** A historical encrypted release may have no readable public projection. */
export class MissingPublicPayloadError extends Error {
  readonly sourceUrl: string;
  constructor(sourceUrl: string) {
    super('This saved data edition is unavailable. Refresh data to load the current edition.');
    this.name = 'MissingPublicPayloadError';
    this.sourceUrl = sourceUrl;
  }
}
