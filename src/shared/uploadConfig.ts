// Client-side configuration for calling our Azure Functions (SharePoint upload,
// web-role / signatory management, notifications).
//
// Auth uses the Power Pages portal token endpoint (see portalToken.ts), NOT
// MSAL — so the only required values are the Function base URL and the client
// id registered with the portal for implicit grant flow.
// Values come from Vite env vars (VITE_*), injected at build time. See
// .env.example at the repo root.

const functionBaseUrl = (import.meta.env.VITE_UPLOAD_FN_BASEURL ?? '').replace(/\/$/, '');

// Client id registered with the portal via the `ImplicitGrantFlow/RegisteredClientId`
// site setting. Passed to /_services/auth/token and echoed back as the token's
// `aud`/`appid`. Falls back to the legacy MSAL client id so existing .env files
// keep working without edits.
const tokenClientId =
  import.meta.env.VITE_PORTAL_TOKEN_CLIENT_ID ?? import.meta.env.VITE_MSAL_CLIENT_ID ?? '';

export const uploadConfig = {
  functionBaseUrl,
  uploadEndpoint: `${functionBaseUrl}/api/uploadFile`,
  tokenClientId,
  /** True only when the Function base URL + registered client id are present. */
  isConfigured: Boolean(functionBaseUrl && tokenClientId),
} as const;
