// Power Pages portal token acquisition for calling our Azure Functions.
//
// Why not MSAL? The SPA runs inside the Power Pages *sandboxed iframe*. MSAL's
// silent token flow opens a hidden iframe to login.microsoftonline.com — a
// third-party, nested context where browsers block cookies, so the redirect
// never completes and MSAL throws `monitor_window_timeout`. The interactive
// fallback then can't break out of the sandbox either.
//
// Instead we use the portal's own OAuth 2.0 implicit grant flow: a *same-origin*
// POST to `/_services/auth/token` returns an ID token for the already-signed-in
// portal user — no iframe, no third-party cookies. The Function validates it
// against the portal's public key.
// Docs: https://learn.microsoft.com/power-pages/security/oauth-implicit-grant-flow

import { uploadConfig } from './uploadConfig';

const isLocalhost = (): boolean =>
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// Tokens are valid 15 min by default; refresh a minute early to avoid races.
const EXPIRY_SKEW_MS = 60_000;
const DEFAULT_TTL_SEC = 900;

let cached: { token: string; expiresAt: number } | null = null;

/**
 * Returns a portal-issued ID token (JWT) for the signed-in user, cached until
 * shortly before it expires. Throws a clear error if the user isn't signed in
 * or the flow isn't configured.
 */
export const acquirePortalToken = async (): Promise<string> => {
  if (!uploadConfig.isConfigured) {
    throw new Error(
      'Backend integration is not configured. Set VITE_UPLOAD_FN_BASEURL and VITE_PORTAL_TOKEN_CLIENT_ID.'
    );
  }
  if (isLocalhost()) {
    throw new Error(
      'Portal token is unavailable on localhost — /_services/auth/token only exists on the deployed Power Pages site.'
    );
  }

  const now = Date.now();
  if (cached && cached.expiresAt - EXPIRY_SKEW_MS > now) return cached.token;

  // Same-origin POST — sends the portal session cookie as first-party, so it is
  // immune to the third-party-cookie blocking that breaks the MSAL iframe flow.
  const url = `/_services/auth/token?client_id=${encodeURIComponent(uploadConfig.tokenClientId)}`;
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { Accept: 'text/plain' },
  });
  if (!res.ok) {
    throw new Error(`Failed to get portal token (HTTP ${res.status}). Please sign in and retry.`);
  }

  const token = (await res.text()).trim();
  // When the user isn't authenticated the endpoint returns the sign-in page
  // (HTML) instead of a JWT — guard against treating that as a token.
  if (!token || token.split('.').length !== 3) {
    throw new Error('Portal token endpoint did not return a token — please sign in and retry.');
  }

  const ttlSec = Number(res.headers.get('expires_in'));
  cached = {
    token,
    expiresAt: now + (Number.isFinite(ttlSec) && ttlSec > 0 ? ttlSec : DEFAULT_TTL_SEC) * 1000,
  };
  return token;
};

/** Drop the cached token — call after the API rejects with 401 so the next call refetches. */
export const clearPortalToken = (): void => {
  cached = null;
};
