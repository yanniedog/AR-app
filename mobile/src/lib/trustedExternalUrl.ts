export type TrustedExternalUrlPurpose =
  | 'app_release'
  | 'official_economic_source'
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
  'paypal.com',
  'revolut.com',
  'tyro.com',
  'wise.com',
] as const;
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

function purposeAllowsUrl(parsed: URL, purpose: TrustedExternalUrlPurpose): boolean {
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
  // Lender links come only from the CDR additionalInformation contract. Keep
  // that purpose separate and constrain it to Australian financial domains or
  // the small explicit set of global CDR providers used by the catalogue.
  return (
    AUSTRALIAN_LENDER_SUFFIXES.some((suffix) => host.endsWith(suffix)) ||
    APPROVED_GLOBAL_LENDER_HOSTS.some((approved) => isHostOrSubdomain(host, approved))
  );
}

function hasCredentialLikeQuery(parsed: URL): boolean {
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

  let parsed: URL;
  try {
    parsed = new URL(request.url.trim());
  } catch {
    return { ok: false, message: 'This destination is not a valid web address.' };
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
