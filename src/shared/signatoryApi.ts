// Frontend client for signatory-member management.
//
// Migrated from the Azure Function (portal-token + cross-origin fetch) to Power
// Pages Server Logic. Calls are now SAME-ORIGIN to /_api/serverlogics/* and reuse
// the site's existing anti-forgery + session auth via powerPagesFetch — no MSAL,
// no portal-token endpoint, no CORS, no external Function App.
//
// Server logic sources live in /server-logic:
//   signatorymembers.serverlogic.js      -> /_api/serverlogics/signatorymembers
//   signatorythresholds.serverlogic.js   -> /_api/serverlogics/signatorythresholds
//
// The exported surface (names, signatures, types) is unchanged so call sites in
// SignatoryManagement.tsx and SignatureSection.tsx keep working as-is. The legacy
// `loginHint` argument is accepted but ignored — the portal session identifies
// the caller server-side.

import { powerPagesFetch } from './powerPagesApi';

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

const MEMBERS_ENDPOINT = '/_api/serverlogics/signatorymembers';
const THRESHOLDS_ENDPOINT = '/_api/serverlogics/signatorythresholds';

// Server logic wraps a handler's return value in a platform envelope:
//   { RequestId, Success, Data, ExecutionTime, ServerLogicName, Error }
// Our handlers, in turn, return a JSON string application envelope:
//   { ok: true, data } | { ok: false, error }
interface ServerLogicEnvelope {
  Success?: boolean;
  Data?: unknown;
  Error?: string | null;
}

interface AppEnvelope<T> {
  ok?: boolean;
  data?: T;
  error?: string;
}

// Peel both envelopes. Throws with the server-side message on a platform failure
// (Success === false) or an application failure (ok === false). Tolerates a raw
// payload with no envelope.
const unwrap = <T>(res: unknown): T | undefined => {
  let payload: unknown = res;

  const env = res as ServerLogicEnvelope;
  if (env && typeof env === 'object' && ('Success' in env || 'Data' in env)) {
    if (env.Success === false) {
      throw new Error(env.Error || 'Server logic call failed');
    }
    payload = env.Data;
  }

  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      /* leave as a plain string */
    }
  }

  const app = payload as AppEnvelope<T>;
  if (app && typeof app === 'object' && 'ok' in app) {
    if (!app.ok) throw new Error(app.error || 'Request failed');
    return app.data;
  }
  return payload as T;
};

// Same-origin server logic is always available (no external Function App or
// client id to configure). Kept for API compatibility with existing call sites.
export const isSignatoryApiConfigured = true;

/** All current signatory members. */
export const listSignatoryMembers = async (
  _loginHint?: string
): Promise<SignatoryMemberDto[]> => {
  const res = await powerPagesFetch<unknown>(
    MEMBERS_ENDPOINT,
    { method: 'GET' }
  );
  return unwrap<SignatoryMemberDto[]>(res) ?? [];
};

/** Add a member to a signatory group. Returns the updated member list. */
export const addSignatoryMember = async (
  input: { name: string; email: string; group: 'prepared' | 'confirmed' },
  _loginHint?: string
): Promise<SignatoryMemberDto[]> => {
  const res = await powerPagesFetch<unknown>(
    MEMBERS_ENDPOINT,
    { method: 'POST', json: input }
  );
  return unwrap<SignatoryMemberDto[]>(res) ?? [];
};

/** Remove a signatory member row by its record GUID. Returns the updated list. */
export const removeSignatoryMember = async (
  id: string,
  _loginHint?: string
): Promise<SignatoryMemberDto[]> => {
  const res = await powerPagesFetch<unknown>(
    `${MEMBERS_ENDPOINT}?id=${encodeURIComponent(id)}`,
    { method: 'DELETE' }
  );
  return unwrap<SignatoryMemberDto[]>(res) ?? [];
};

/** Read the global minimum signature thresholds. */
export const getSignatoryThresholds = async (
  _loginHint?: string
): Promise<SignatoryThresholds> => {
  const res = await powerPagesFetch<unknown>(
    THRESHOLDS_ENDPOINT,
    { method: 'GET' }
  );
  const t = unwrap<SignatoryThresholds>(res);
  return {
    preparedCount: t?.preparedCount ?? 1,
    confirmCount: t?.confirmCount ?? 2,
  };
};

/** Update the global minimum signature thresholds (admin only). */
export const setSignatoryThresholds = async (
  preparedCount: number,
  confirmCount: number,
  _loginHint?: string
): Promise<SignatoryThresholds> => {
  const res = await powerPagesFetch<unknown>(
    THRESHOLDS_ENDPOINT,
    { method: 'PUT', json: { preparedCount, confirmCount } }
  );
  const t = unwrap<SignatoryThresholds>(res);
  return {
    preparedCount: t?.preparedCount ?? preparedCount,
    confirmCount: t?.confirmCount ?? confirmCount,
  };
};
