// Centralized, validated access to Function App settings (process.env).
// Throws early with a clear message if a required setting is missing, so a
// misconfigured deployment fails loudly instead of 500-ing deep inside Graph.

const required = (name: string): string => {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`Missing required app setting: ${name}`);
  }
  return v.trim();
};

const optional = (name: string, fallback: string): string => {
  const v = process.env[name];
  return v && v.trim() !== '' ? v.trim() : fallback;
};

export interface UploadConfig {
  // Outgoing Graph auth (Function → SharePoint). tenantId is the directory the
  // app-only client-credentials token is requested from.
  tenantId: string;
  graphClientId: string;
  graphClientSecret: string;
  // SharePoint target — prefer the pre-resolved ids; fall back to host/path/library.
  sharepointSiteId: string;
  sharepointDriveId: string;
  sharepointHostname: string;
  sharepointSitePath: string;
  sharepointLibrary: string;
  sharepointRootFolder: string;
  // Limits
  maxFileBytes: number;
}

let cached: UploadConfig | null = null;

export const getConfig = (): UploadConfig => {
  if (cached) return cached;
  cached = {
    tenantId: required('TENANT_ID'),
    graphClientId: required('GRAPH_CLIENT_ID'),
    graphClientSecret: required('GRAPH_CLIENT_SECRET'),
    sharepointSiteId: optional('SHAREPOINT_SITE_ID', ''),
    sharepointDriveId: optional('SHAREPOINT_DRIVE_ID', ''),
    sharepointHostname: optional('SHAREPOINT_HOSTNAME', ''),
    sharepointSitePath: optional('SHAREPOINT_SITE_PATH', ''),
    sharepointLibrary: optional('SHAREPOINT_LIBRARY', 'Documents'),
    // Empty = upload directly into the library root (the drive root IS the
    // document library, e.g. "Shared Documents"). Set a value to nest uploads.
    sharepointRootFolder: optional('SHAREPOINT_ROOT_FOLDER', ''),
    maxFileBytes: Number(optional('MAX_FILE_BYTES', '10485760')),
  };
  return cached;
};

// ── Power Pages portal-token validation (FE → Function) ─────────────────────
// The SPA runs inside the Power Pages sandboxed iframe, where MSAL's hidden-
// iframe silent token flow fails (third-party cookies blocked → monitor_window_
// timeout). Instead the SPA fetches a portal-issued ID token from
// `<portal>/_services/auth/token` and we validate it here against the portal's
// public key (`<portal>/_services/auth/publickey`).
//
// One Function App serves multiple portals (dev + prod), so PORTAL_BASE_URLS is
// a comma-separated allow-list. The token's `aud`/`appid` equals the client id
// registered with the portal via the `ImplicitGrantFlow/RegisteredClientId`
// site setting (PORTAL_CLIENT_ID here).
export interface PortalAuthConfig {
  /** Allowed portal origins, normalized (no trailing slash). Token `iss` must match one. */
  allowedPortalBaseUrls: string[];
  /** Expected `aud`/`appid` — the client id registered for implicit grant flow. */
  expectedClientId: string;
  /**
   * Statically-configured RS256 verification keys, keyed by lowercased portal
   * base URL (no trailing slash). Each value is the portal's implicit-grant
   * signing certificate as a PEM or a bare base64 X.509/SPKI body.
   *
   * Required for portals that require sign-in for every path: the Function's
   * anonymous server-side fetch of `/_services/auth/publickey` is redirected to
   * the IdP, so the key can't be fetched and must be supplied here instead.
   */
  staticPublicKeys: Map<string, string>;
}

let cachedPortalAuth: PortalAuthConfig | null = null;

export const getPortalAuthConfig = (): PortalAuthConfig => {
  if (cachedPortalAuth) return cachedPortalAuth;
  const list = required('PORTAL_BASE_URLS')
    .split(',')
    .map((u) => u.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  if (list.length === 0) {
    throw new Error('PORTAL_BASE_URLS must contain at least one portal URL');
  }
  // PORTAL_PUBLIC_KEYS is an optional comma-separated list, index-aligned with
  // PORTAL_BASE_URLS. Base64 cert/SPKI bodies never contain commas, so this is
  // unambiguous; leave a slot empty to fall back to fetching that portal's
  // publickey endpoint. Keyed by lowercased base URL to match validateToken.
  const keyList = optional('PORTAL_PUBLIC_KEYS', '').split(',');
  const staticPublicKeys = new Map<string, string>();
  list.forEach((url, i) => {
    const key = (keyList[i] ?? '').trim();
    if (key) staticPublicKeys.set(url.toLowerCase(), key);
  });
  cachedPortalAuth = {
    allowedPortalBaseUrls: list,
    expectedClientId: required('PORTAL_CLIENT_ID'),
    staticPublicKeys,
  };
  return cachedPortalAuth;
};

// ── Web-role management (contact ↔ web role) ────────────────────────────────
// Kept separate from UploadConfig and validated lazily, so the upload function
// keeps working even if these settings are absent, and vice versa.
//
// The function talks to the Dataverse Web API as an *application user* — the
// app registration (GRAPH_CLIENT_ID / DATAVERSE_CLIENT_ID) must be added as an
// Application User in the environment with a security role that can read/write
// `contact`, the web-role table, and their N:N relationship. Graph permissions
// like User.ReadWrite.All do NOT grant this — web roles live in Dataverse.
//
// Table / relationship logical names default to the modern `mspp_*` schema but
// are all overridable, because environments upgraded from the classic `adx_*`
// schema may still use the old names. If assign/unassign fails with a
// "navigation property not found" style error, set WEBROLE_CONTACT_NAV (and the
// other WEBROLE_* settings) to the names from your environment's metadata.
export interface RoleConfig {
  // Outgoing Dataverse auth (Function → Dataverse), app-only client credentials.
  tenantId: string;
  dataverseUrl: string; // e.g. https://org.crm.dynamics.com (no trailing slash)
  dataverseApiVersion: string; // e.g. v9.2
  dataverseClientId: string;
  dataverseClientSecret: string;
  // Web-role table + N:N relationship logical names.
  webRoleEntitySet: string; // e.g. powerpagecomponents
  webRoleIdAttr: string; // e.g. powerpagecomponentid
  webRoleNameAttr: string; // e.g. name
  /** Collection-valued navigation property from contact to its web roles. */
  webRoleContactNav: string; // e.g. powerpagecomponent_mspp_webrole_contact
  /** Optional $filter to isolate web-role rows when the entity set is shared. */
  webRoleListFilter: string;
  /** Web role whose members may manage other users' roles. */
  adminWebRoleName: string;
}

let cachedRole: RoleConfig | null = null;

export const getRoleConfig = (): RoleConfig => {
  if (cachedRole) return cachedRole;
  cachedRole = {
    tenantId: required('TENANT_ID'),
    // Default Dataverse environment. For multi-portal routing the effective
    // environment is resolved per request — see getDataverseUrlForPortal.
    dataverseUrl: required('DATAVERSE_URL').replace(/\/+$/, ''),
    dataverseApiVersion: optional('DATAVERSE_API_VERSION', 'v9.2'),
    // Reuse the Graph daemon app reg by default — set dedicated values only if
    // you register a separate app for Dataverse.
    dataverseClientId: optional('DATAVERSE_CLIENT_ID', '') || required('GRAPH_CLIENT_ID'),
    dataverseClientSecret:
      optional('DATAVERSE_CLIENT_SECRET', '') || required('GRAPH_CLIENT_SECRET'),
    // Modern Power Pages stores web roles in the unified `powerpagecomponent`
    // table (type 11) and the contact↔role N:N is defined there — NOT on the
    // `mspp_webrole` view (which can't be traversed and may show duplicates).
    // Verified against GCP-Developer 2026-06.
    webRoleEntitySet: optional('WEBROLE_ENTITY_SET', 'powerpagecomponents'),
    webRoleIdAttr: optional('WEBROLE_ID_ATTR', 'powerpagecomponentid'),
    webRoleNameAttr: optional('WEBROLE_NAME_ATTR', 'name'),
    webRoleContactNav: optional(
      'WEBROLE_CONTACT_NAV',
      'powerpagecomponent_mspp_webrole_contact'
    ),
    // powerpagecomponenttype 11 = Web Role; isolates roles from other components.
    webRoleListFilter: optional('WEBROLE_LIST_FILTER', 'powerpagecomponenttype eq 11'),
    adminWebRoleName: optional('ADMIN_WEBROLE_NAME', 'Administrators'),
  };
  return cachedRole;
};

// ── Per-portal Dataverse routing ────────────────────────────────────────────
// One Function App accepts tokens from multiple portals (PORTAL_BASE_URLS, e.g.
// dev + prod), and each portal is backed by a SEPARATE Dataverse environment.
// DATAVERSE_URLS is an optional comma-separated list, index-aligned with
// PORTAL_BASE_URLS, giving the Dataverse base URL for each portal. A portal with
// no entry — or an absent DATAVERSE_URLS setting — falls back to the single
// DATAVERSE_URL (getRoleConfig().dataverseUrl), preserving single-environment
// deployments. Keyed by portal host to match validateToken's scheme-insensitive
// host matching.
//
// NOTE: the app registration (DATAVERSE_CLIENT_ID / GRAPH_CLIENT_ID) must be an
// Application User in EVERY environment listed here, or calls to that environment
// fail auth (401) even though routing is correct.
const portalHost = (url: string): string =>
  url
    .trim()
    .replace(/\/+$/, '')
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .split('/')[0];

let cachedPortalDataverse: Map<string, string> | null = null;

export const getDataverseUrlForPortal = (portalBaseUrl: string): string => {
  if (!cachedPortalDataverse) {
    cachedPortalDataverse = new Map();
    const portals = optional('PORTAL_BASE_URLS', '')
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean);
    const dvUrls = optional('DATAVERSE_URLS', '').split(',').map((u) => u.trim());
    portals.forEach((p, i) => {
      const dv = (dvUrls[i] ?? '').replace(/\/+$/, '');
      if (dv) cachedPortalDataverse!.set(portalHost(p), dv);
    });
  }
  return cachedPortalDataverse.get(portalHost(portalBaseUrl)) ?? getRoleConfig().dataverseUrl;
};

// ── Email notifications (Function → Graph sendMail) ─────────────────────────
// Sent app-only via the daemon app registration's Mail.Send application
// permission (reuses the same Graph client as the SharePoint uploader). Lock
// the daemon to `senderMailbox` with an Exchange Application Access Policy so it
// cannot send as other mailboxes.
export interface EmailConfig {
  /** Mailbox the notification is sent *from* (must be licensed). */
  senderMailbox: string;
  /** Public SPA base URL for the "View Request" deep link, no trailing slash. */
  spaBaseUrl: string;
  /** Web role whose members are notified alongside the requester. */
  notifyWebRoleName: string;
  /** Entity set for the admin-editable email templates (gcp_emailtemplate). */
  templateEntitySet: string;
}

let cachedEmail: EmailConfig | null = null;

export const getEmailConfig = (): EmailConfig => {
  if (cachedEmail) return cachedEmail;
  cachedEmail = {
    senderMailbox: optional('NOTIFICATION_SENDER', 'noreply@O3CS.my'),
    spaBaseUrl: optional('SPA_BASE_URL', '').replace(/\/+$/, ''),
    notifyWebRoleName: optional('NOTIFY_WEBROLE_NAME', 'Verifier'),
    templateEntitySet: optional('EMAIL_TEMPLATE_ENTITY_SET', 'gcp_emailtemplates'),
  };
  return cachedEmail;
};
