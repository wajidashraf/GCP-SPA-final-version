// Validates the Power Pages portal-issued ID token that the SPA sends in the
// Authorization header.
//
// The SPA runs inside the Power Pages sandboxed iframe, where MSAL's hidden-
// iframe silent token flow fails (browsers block third-party cookies to
// login.microsoftonline.com → `monitor_window_timeout`). Instead the SPA fetches
// a token from `<portal>/_services/auth/token` (OAuth 2.0 implicit grant flow)
// and we validate it here:
//   1. Read `iss` (unverified) and match it to an allow-listed portal.
//   2. Fetch that portal's public key (`<portal>/_services/auth/publickey`) and
//      verify the RS256 signature + standard time claims.
//   3. Confirm `aud`/`appid` equals the registered client id.
//   4. Extract the caller's contact id (`sub`) and email for authorization.
//
// Docs: https://learn.microsoft.com/power-pages/security/oauth-implicit-grant-flow

import {
  decodeJwt,
  jwtVerify,
  importX509,
  importSPKI,
  type JWTPayload,
  type KeyLike,
} from 'jose';
import { getPortalAuthConfig, getDataverseUrlForPortal } from '../config.js';

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

export interface CallerIdentity {
  /** Dataverse contact GUID of the signed-in portal user (token `sub`). */
  contactId: string;
  /** Best-effort email/UPN — used for logging and as an admin-check fallback. */
  upn: string;
  name?: string;
  /** Legacy field kept for callers; portal tokens don't carry Entra `oid`. */
  oid: string;
  /** Legacy field; portal tokens don't carry delegated scopes. */
  scopes: string[];
  /**
   * Allow-listed base URL of the portal that issued this token (with scheme, no
   * trailing slash). Used to route to that portal's Dataverse environment and to
   * build same-portal deep links.
   */
  portalBaseUrl: string;
}

const normalize = (url: string): string => url.trim().replace(/\/+$/, '').toLowerCase();

// Host portion only — scheme- and path-insensitive. The Power Pages portal token's
// `iss` claim is the bare host (e.g. `gcp-nexus.powerappsportals.com`, no scheme),
// while the allow-list entries carry `https://` (needed for the publickey fetch),
// so the issuer must be matched on host, not on the full normalized URL.
const hostOf = (url: string): string =>
  normalize(url)
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .split('/')[0];

// One imported public key per portal, cached across invocations. Keys rarely
// rotate; if validation starts failing after a rotation, the Function restart
// (cold start) clears this. Keyed by normalized portal base URL.
const keyCache = new Map<string, KeyLike>();

// Imports key material in any of the shapes the portal (or a static config
// setting) may provide: a PEM certificate, a PEM SPKI public key, or a bare
// base64 body of either. The implicit-grant publickey endpoint returns the
// signing certificate, so try X.509 first and fall back to SPKI.
const importKeyMaterial = async (pem: string): Promise<KeyLike> => {
  if (pem.includes('BEGIN CERTIFICATE')) return importX509(pem, 'RS256');
  if (pem.includes('BEGIN PUBLIC KEY')) return importSPKI(pem, 'RS256');
  const asCert = `-----BEGIN CERTIFICATE-----\n${pem}\n-----END CERTIFICATE-----`;
  try {
    return await importX509(asCert, 'RS256');
  } catch {
    const asSpki = `-----BEGIN PUBLIC KEY-----\n${pem}\n-----END PUBLIC KEY-----`;
    return importSPKI(asSpki, 'RS256');
  }
};

// Resolves the portal's RS256 verification key. Prefers a statically-configured
// key (PORTAL_PUBLIC_KEYS) and only falls back to fetching the portal's
// `/_services/auth/publickey` endpoint.
//
// ⚠️ The fetch fallback fails on sites that require sign-in for *every* path:
// this anonymous, cookie-less server-side request is 30x-redirected to the IdP,
// and following that redirect yields an HTML login page — which then fails key
// import with a cryptic OpenSSL DECODER error. For such sites you MUST supply
// the key via PORTAL_PUBLIC_KEYS (the public half of the implicit-grant signing
// certificate). We detect the redirect / HTML and say so explicitly.
const loadPortalKey = async (
  portalBaseUrl: string,
  staticKey?: string
): Promise<KeyLike> => {
  const cached = keyCache.get(portalBaseUrl);
  if (cached) return cached;

  let pem: string;
  if (staticKey && staticKey.trim() !== '') {
    pem = staticKey.trim();
  } else {
    const res = await fetch(`${portalBaseUrl}/_services/auth/publickey`, {
      redirect: 'manual',
    });
    if (res.status >= 300 && res.status < 400) {
      throw new AuthError(
        `Portal public key endpoint redirected (HTTP ${res.status}) — the site likely requires sign-in for all paths, so the key can't be fetched server-side. Configure PORTAL_PUBLIC_KEYS with this portal's implicit-grant signing certificate.`,
        502
      );
    }
    if (!res.ok) {
      throw new AuthError(
        `Could not fetch portal public key (HTTP ${res.status})`,
        502
      );
    }
    pem = (await res.text()).trim();
    if (/<(?:!doctype|html)\b/i.test(pem)) {
      throw new AuthError(
        "Portal public key endpoint returned an HTML page, not a key — the site likely requires sign-in. Configure PORTAL_PUBLIC_KEYS.",
        502
      );
    }
  }

  let key: KeyLike;
  try {
    key = await importKeyMaterial(pem);
  } catch (err) {
    throw new AuthError(
      `Portal public key is not a usable RS256 key: ${err instanceof Error ? err.message : 'unknown'}`,
      502
    );
  }

  keyCache.set(portalBaseUrl, key);
  return key;
};

const extractBearer = (authHeader: string | null | undefined): string => {
  if (!authHeader) throw new AuthError('Missing Authorization header');
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  if (!match) throw new AuthError('Authorization header must be a Bearer token');
  return match[1];
};

const firstString = (payload: JWTPayload, keys: string[]): string => {
  for (const k of keys) {
    const v = payload[k];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return '';
};

// Candidate claim names for the contact id and email in the portal token. `sub`
// is the standard subject claim; the others are defensive fallbacks across
// portal versions. The exact set present is logged once per cold start.
const CONTACT_ID_CLAIMS = [
  'sub',
  'nameid',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
  'contactid',
];
const EMAIL_CLAIMS = [
  'email',
  'emails',
  'preferred_username',
  'upn',
  'emailaddress',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
];

let claimKeysLogged = false;

export const validateToken = async (
  authHeader: string | null | undefined
): Promise<CallerIdentity> => {
  const cfg = getPortalAuthConfig();
  const token = extractBearer(authHeader);

  // 1. Read issuer without trusting it yet, and match it to an allow-listed
  //    portal. We fetch keys only from the configured allow-list (never from a
  //    URL inside the unverified token) to avoid SSRF.
  let unverified: JWTPayload;
  try {
    unverified = decodeJwt(token);
  } catch {
    throw new AuthError('Authorization token is not a valid JWT');
  }
  const issHost = typeof unverified.iss === 'string' ? hostOf(unverified.iss) : '';
  // Match on host (scheme-insensitive); the matched allow-list entry keeps its
  // scheme so the publickey fetch below stays a valid absolute URL.
  const portalBaseUrl = issHost
    ? cfg.allowedPortalBaseUrls.find((u) => hostOf(u) === issHost)
    : undefined;
  if (!portalBaseUrl) {
    throw new AuthError(
      `Token issuer is not an allowed portal: '${unverified.iss ?? '(none)'}'`,
      403
    );
  }

  // 2. Verify signature + time claims against the issuing portal's public key.
  let payload: JWTPayload;
  try {
    const normalized = normalize(portalBaseUrl);
    const key = await loadPortalKey(normalized, cfg.staticPublicKeys.get(normalized));
    ({ payload } = await jwtVerify(token, key, { algorithms: ['RS256'] }));
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError(
      `Token validation failed: ${err instanceof Error ? err.message : 'unknown error'}`
    );
  }

  // 3. Confirm the token was minted for our registered client id. The portal
  //    sets both `aud` and `appid` to the client id passed to the token endpoint.
  const expected = cfg.expectedClientId.toLowerCase();
  const aud = firstString(payload, ['aud']).toLowerCase();
  const appid = firstString(payload, ['appid', 'azp']).toLowerCase();
  if (aud !== expected && appid !== expected) {
    throw new AuthError('Token was not issued for this application', 403);
  }

  if (!claimKeysLogged) {
    // One-off: surface the available claim names (NOT values) so the exact
    // contact-id / email claim names can be confirmed in Application Insights.
    // eslint-disable-next-line no-console
    console.log('[validateToken] portal token claim keys:', Object.keys(payload).join(', '));
    claimKeysLogged = true;
  }

  const contactId = firstString(payload, CONTACT_ID_CLAIMS);
  if (!contactId) {
    throw new AuthError('Token is missing the contact id (sub) claim', 403);
  }

  // NOTE: the Dataverse environment is NOT pinned here. Pinning is done by the
  // handler via `runForPortal(caller.portalBaseUrl, ...)`, which wraps every
  // Dataverse call in an AsyncLocalStorage `run()` scope that reliably survives
  // across awaits (an `enterWith` here, in this awaited callee, did not — see
  // dataverseEnv.ts). `caller.portalBaseUrl` carries the routing target.
  // Diagnostic (temporary): confirm the issuer matched the expected portal and
  // which Dataverse org it routes to. Logged per request to App Insights.
  // eslint-disable-next-line no-console
  console.log(
    `[validateToken] issHost=${hostOf(typeof unverified.iss === 'string' ? unverified.iss : '')} matchedPortal=${portalBaseUrl} resolvedDataverse=${getDataverseUrlForPortal(portalBaseUrl)}`
  );

  return {
    contactId,
    upn: firstString(payload, EMAIL_CLAIMS),
    name: firstString(payload, ['name', 'given_name']) || undefined,
    oid: contactId,
    scopes: [],
    portalBaseUrl,
  };
};
