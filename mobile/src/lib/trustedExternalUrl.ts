import { StandardUrl } from './standardUrl';

export type TrustedExternalUrlPurpose =
  | 'app_release'
  | 'official_economic_source'
  | 'official_market_source'
  | 'lender_source';

export interface TrustedExternalUrlRequest {
  url: string;
  purpose: TrustedExternalUrlPurpose;
  label: string;
}

export type TrustedExternalUrlResult =
  | {
      ok: true;
      url: string;
      host: string;
      label: string;
      purpose: TrustedExternalUrlPurpose;
    }
  | {
      ok: false;
      message: string;
    };

const MAX_EXTERNAL_URL_LENGTH = 2_048;
const AUSTRALIAN_LENDER_SUFFIXES = ['.au', '.bank'] as const;
const APPROVED_GLOBAL_LENDER_HOSTS = [
  'anz.com',
  'bankofchina.com',
  'paypal.com',
  'qantasmoney.com',
  'racq.com',
  'revolut.com',
  'tyro.com',
  'unloan.com',
  'unbankcompany.com',
  'wise.com',
] as const;
// Tenant paths from the published CDR source-document inventory. Shared CDN
// domains are not lender domains: never approve an entire multi-tenant host.
const LENDER_DOCUMENT_PATHS: Readonly<Record<string, RegExp>> = {
  'd9a7lp1kie9ya.cloudfront.net': /^\/\d{4}\/\d{2}\/[^/]+\.pdf$/i,
  'cdn.bfldr.com': /^\/1R31Y8GR\/as\//,
  'cdn.intelligencebank.com': /^\/au\/share\/(?:e3Gq6M|NZw2|w8gXkZ)\//,
  'cdn.mediavalet.com': /^\/aunsw\/policebank\//,
  'cdn.gsb1.prod.cxnpl.io': /^\/files\/(?:products\/|app\/Terms%20and%20Conditions\.pdf$)/,
  'cdn.moby-prod.prod.cxnpl.io': /^\/files\/products\//,
  'cdn.troy-prod.troy-prod.cxnpl.io': /^\/files\/products\//,
};
const CREDENTIAL_QUERY_KEYS = new Set([
  'accesstoken',
  'apikey',
  'auth',
  'authorization',
  'key',
  'password',
  'passwd',
  'secret',
  'session',
  'sessionid',
  'signature',
  'token',
]);

function isHostOrSubdomain(host: string, approved: string): boolean {
  return host === approved || host.endsWith(`.${approved}`);
}

function isPublicDnsHostname(host: string): boolean {
  if (
    !host.includes('.') ||
    host.length > 253 ||
    host.includes(':') ||
    /^\d+(?:\.\d+){3}$/.test(host) ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.lan') ||
    host.split('.').some((label) => !label || label.length > 63 || label.startsWith('xn--'))
  ) {
    return false;
  }
  return host
    .split('.')
    .every((label) => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label));
}

function purposeAllowsUrl(parsed: InstanceType<typeof StandardUrl>, purpose: TrustedExternalUrlPurpose): boolean {
  const host = parsed.hostname.toLowerCase();
  if (purpose === 'app_release') {
    return (
      host === 'github.com' &&
      /^\/yanniedog\/AR-app\/releases\/(?:tag|download)\/[^/]+(?:\/[^/]+)?\/?$/.test(
        parsed.pathname,
      )
    );
  }
  if (purpose === 'official_economic_source') {
    return isHostOrSubdomain(host, 'rba.gov.au') || isHostOrSubdomain(host, 'abs.gov.au');
  }
  if (purpose === 'official_market_source') {
    return (host === 'www.asx.com.au' || host === 'asx.com.au')
      && /^\/markets\/trade-our-derivatives-market\/futures-market\/rba-rate-tracker\/?$/.test(parsed.pathname)
      && !parsed.search;
  }
  // Lender links come only from the CDR additionalInformation contract. Keep
  // that purpose separate and constrain it to Australian financial domains or
  // the small explicit set of global CDR providers used by the catalogue.
  return (
    AUSTRALIAN_LENDER_SUFFIXES.some((suffix) => host.endsWith(suffix)) ||
    APPROVED_GLOBAL_LENDER_HOSTS.some((approved) => isHostOrSubdomain(host, approved)) ||
    LENDER_DOCUMENT_PATHS[host]?.test(parsed.pathname) === true
  );
}

function hasCredentialLikeQuery(parsed: InstanceType<typeof StandardUrl>): boolean {
  return [...parsed.searchParams.keys()].some((key) =>
    CREDENTIAL_QUERY_KEYS.has(key.toLowerCase().replaceAll('-', '').replaceAll('_', '')),
  );
}

export function trustedExternalUrl(
  request: TrustedExternalUrlRequest,
): TrustedExternalUrlResult {
  if (
    typeof request.url !== 'string' ||
    !request.url.trim() ||
    request.url.length > MAX_EXTERNAL_URL_LENGTH
  ) {
    return { ok: false, message: 'This destination is missing or invalid.' };
  }

  let parsed: InstanceType<typeof StandardUrl>;
  try {
    parsed = new StandardUrl(request.url.trim());
  } catch {
    return { ok: false, message: 'This destination is not a valid web address.' };
  }

  // Some CDR publishers retain legacy HTTP links or a DNS trailing dot. Open
  // only their approved HTTPS equivalent; never contact the insecure source.
  if (request.purpose === 'lender_source') {
    const candidate = new StandardUrl(parsed.toString());
    candidate.hostname = candidate.hostname.replace(/\.$/, '');
    if (purposeAllowsUrl(candidate, request.purpose)) {
      parsed = candidate;
      if (parsed.protocol === 'http:' && !parsed.port) parsed.protocol = 'https:';
    }
  }
  const host = parsed.hostname.toLowerCase();
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    hasCredentialLikeQuery(parsed) ||
    !isPublicDnsHostname(host)
  ) {
    return {
      ok: false,
      message: 'Only approved, credential-free HTTPS destinations can be opened.',
    };
  }
  if (!purposeAllowsUrl(parsed, request.purpose)) {
    return {
      ok: false,
      message: 'This website is not approved for this type of source.',
    };
  }

  parsed.hash = '';
  return {
    ok: true,
    url: parsed.toString(),
    host,
    label: request.label,
    purpose: request.purpose,
  };
}
