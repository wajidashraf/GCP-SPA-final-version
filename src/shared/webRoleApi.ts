// Frontend client for the web-role management Azure Function.
//
// Reuses the same portal token + Function base URL as the SharePoint uploader
// (see portalToken / uploadConfig) — the Function authorizes the caller as an
// admin server-side against Dataverse, so this is UX plumbing only.

import { acquirePortalToken } from './portalToken';
import { uploadConfig } from './uploadConfig';

export interface WebRoleDto {
  id: string;
  name: string;
}

export type RoleAction = 'assign' | 'unassign';

interface ApiOk<T> {
  ok: true;
  roles?: WebRoleDto[];
  action?: RoleAction;
  data?: T;
}
interface ApiErr {
  ok: false;
  error?: string;
}

/** True only when the Function base URL + MSAL settings are present. */
export const isRoleApiConfigured = uploadConfig.isConfigured;

const call = async <T = unknown>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
  loginHint?: string
): Promise<ApiOk<T>> => {
  if (!uploadConfig.isConfigured) {
    throw new Error(
      'Role management is not configured. Set VITE_UPLOAD_FN_BASEURL / VITE_PORTAL_TOKEN_CLIENT_ID.'
    );
  }
  const token = await acquirePortalToken();
  const { json, headers, ...rest } = init;
  const res = await fetch(`${uploadConfig.functionBaseUrl}/api/${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  let body: ApiOk<T> | ApiErr | null = null;
  try {
    body = (await res.json()) as ApiOk<T> | ApiErr;
  } catch {
    /* non-JSON response */
  }
  if (!res.ok || !body || !body.ok) {
    const message = body && !body.ok ? body.error : undefined;
    throw new Error(message ?? `Request failed (HTTP ${res.status})`);
  }
  return body;
};

/** All web roles defined in the environment. */
export const listWebRoles = async (loginHint?: string): Promise<WebRoleDto[]> => {
  const res = await call('webRoles', { method: 'GET' }, loginHint);
  return res.roles ?? [];
};

/** Web roles currently assigned to a contact. */
export const getContactRoles = async (
  contactId: string,
  loginHint?: string
): Promise<WebRoleDto[]> => {
  const res = await call(
    `contacts/${encodeURIComponent(contactId)}/webRoles`,
    { method: 'GET' },
    loginHint
  );
  return res.roles ?? [];
};

/**
 * Assign or unassign a web role for a contact. Resolves with the contact's
 * resulting role set (returned by the Function) so the caller can re-sync.
 */
export const setWebRoleAssignment = async (
  contactId: string,
  webRoleId: string,
  action: RoleAction,
  loginHint?: string
): Promise<WebRoleDto[]> => {
  const res = await call(
    `contacts/${encodeURIComponent(contactId)}/webRoles`,
    { method: 'POST', json: { webRoleId, action } },
    loginHint
  );
  return res.roles ?? [];
};
