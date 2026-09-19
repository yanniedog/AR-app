/** Fixed delivery service; release master keys never enter the app. */
export const APP_DATA_ORIGIN = 'https://ar-app-data.jkokavec.workers.dev';

/** Keep frozen GitHub domain identities; change only their delivery transport. */
export function automaticDataUrl(source: string): string | null {
  try {
    const url = new URL(source);
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port ||
        url.username || url.password || url.hash) return null;
    const match = /^\/yanniedog\/AR-local\/releases\/download\/(app-payload-(?:latest|\d{4}-\d{2}-\d{2}(?:-r\d{6})?))\/([A-Za-z0-9][A-Za-z0-9_.-]*\.json(?:\.gz)?)$/.exec(url.pathname);
    if (!match || match[2].includes('..')) return null;
    for (const name of url.searchParams.keys()) if (name !== '_') return null;
    return `${APP_DATA_ORIGIN}/v1/release/${match[1]}/${match[2]}${url.search}`;
  } catch { return null; }
}
