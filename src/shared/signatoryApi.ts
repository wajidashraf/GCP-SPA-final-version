// Frontend client for the signatory-member management Azure Function.
// Mirrors the pattern in src/shared/webRoleApi.ts.

import { acquirePortalToken } from './portalToken';
import { uploadConfig } from './uploadConfig';

export interface SignatoryMemberDto {
  id: string;
  group: 'prepared' | 'confirmed';
  name: string;
  email: string;
  sortOrder: number;
}

export interface SignatoryThresholds {
  preparedCount: number;
  confirmCount: number;
}

interface ApiOk {
  ok: true;
  members?: SignatoryMemberDto[];
  preparedCount?: number;
  confirmCount?: number;
}
interface ApiErr {
  ok: false;
  error?: string;
}

export const isSignatoryApiConfigured = uploadConfig.isConfigured;

const call = async (
  path: string,
  init: RequestInit & { json?: unknown } = {},
  loginHint?: string
): Promise<ApiOk> => {
  if (!uploadConfig.isConfigured) {
    throw new Error(
      'Signatory API is not configured. Set VITE_UPLOAD_FN_BASEURL / VITE_PORTAL_TOKEN_CLIENT_ID.'
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

  let body: ApiOk | ApiErr | null = null;
  try {
    body = (await res.json()) as ApiOk | ApiErr;
  } catch {
    /* non-JSON response */
  }
  if (!res.ok || !body || !body.ok) {
    const message = body && !body.ok ? body.error : undefined;
    throw new Error(message ?? `Request failed (HTTP ${res.status})`);
  }
  return body;
};

/** All current signatory members. */
export const listSignatoryMembers = async (
  loginHint?: string
): Promise<SignatoryMemberDto[]> => {
  const res = await call('signatory-members', { method: 'GET' }, loginHint);
  return res.members ?? [];
};

/** Add a member to a signatory group. Returns the updated member list. */
export const addSignatoryMember = async (
  input: { name: string; email: string; group: 'prepared' | 'confirmed' },
  loginHint?: string
): Promise<SignatoryMemberDto[]> => {
  const res = await call(
    'signatory-members',
    { method: 'POST', json: input },
    loginHint
  );
  return res.members ?? [];
};

/** Remove a signatory member row by its record GUID. Returns the updated member list. */
export const removeSignatoryMember = async (
  id: string,
  loginHint?: string
): Promise<SignatoryMemberDto[]> => {
  const res = await call(
    `signatory-members/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    loginHint
  );
  return res.members ?? [];
};

/** Read the global minimum signature thresholds. */
export const getSignatoryThresholds = async (
  loginHint?: string
): Promise<SignatoryThresholds> => {
  const res = await call('signatory-thresholds', { method: 'GET' }, loginHint);
  return {
    preparedCount: res.preparedCount ?? 1,
    confirmCount: res.confirmCount ?? 2,
  };
};

/** Update the global minimum signature thresholds (admin only). */
export const setSignatoryThresholds = async (
  preparedCount: number,
  confirmCount: number,
  loginHint?: string
): Promise<SignatoryThresholds> => {
  const res = await call(
    'signatory-thresholds',
    { method: 'PATCH', json: { preparedCount, confirmCount } },
    loginHint
  );
  return {
    preparedCount: res.preparedCount ?? preparedCount,
    confirmCount: res.confirmCount ?? confirmCount,
  };
};
