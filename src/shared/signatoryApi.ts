// Frontend client for signatory-member management.
//
// Migrated from the Azure Function (portal-token + cross-origin fetch) to Power
// Pages Server Logic. Calls are now SAME-ORIGIN to /_api/serverlogics/* and reuse
// the site's existing anti-forgery + session auth via powerPagesFetch — no MSAL,
// no portal-token endpoint, no CORS, no external Function App.
//
// Server logic sources live in .powerpages-site/server-logic/:
//   signatorymembers/     -> /_api/serverlogics/signatorymembers
//   signatorythresholds/  -> /_api/serverlogics/signatorythresholds
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

// Peel a Power Pages server-logic response down to the handler payload.
//   Platform envelope: { RequestId, Success, Data, ExecutionTime, Error }
//   Handler envelope:  { ok, data | error }  (our handlers return this, JSON-encoded)
// `Data` may arrive as an object OR as a JSON string, at one or two levels of
// nesting — peel defensively. Throws on a platform (Success === false) or
// application (ok === false) failure so callers show the server-side message.
const unwrapPayload = (res: unknown): unknown => {
  let payload: unknown = res;

  // 1. Platform envelope. The runtime returns lowercase keys
  //    ({ requestId, success, data, serverLogicName }); the docs show PascalCase
  //    ({ RequestId, Success, Data }). Accept either. Detect the envelope by its
  //    own keys — NOT by `data` alone, which the inner app envelope also has.
  if (payload && typeof payload === 'object') {
    const env = payload as Record<string, unknown>;
    const looksPlatform =
      'success' in env || 'Success' in env ||
      'serverLogicName' in env || 'ServerLogicName' in env ||
      'requestId' in env || 'RequestId' in env;
    if (looksPlatform) {
      const success = 'success' in env ? env.success : env.Success;
      if (success === false) {
        const err = 'error' in env ? env.error : env.Error;
        throw new Error(typeof err === 'string' && err ? err : 'Server logic call failed');
      }
      payload = 'data' in env ? env.data : env.Data;
    }
  }

  // 2. Data delivered as a JSON string.
  if (typeof payload === 'string') {
    const s = payload.trim();
    if (s.startsWith('{') || s.startsWith('[')) {
      try {
        payload = JSON.parse(s);
      } catch {
        /* leave as a plain string */
      }
    }
  }

  // 3. Application envelope { ok, data | error }.
  if (payload && typeof payload === 'object' && 'ok' in (payload as Record<string, unknown>)) {
    const app = payload as { ok?: boolean; data?: unknown; error?: string };
    if (!app.ok) throw new Error(app.error || 'Request failed');
    payload = app.data;
  }

  return payload;
};

// Coerce a payload to an array of members, tolerating common container shapes.
// Guarantees an array so callers can safely .filter/.map. Warns (once, with the
// real value) if the shape is unexpected, so a contract drift is diagnosable.
const asMemberArray = (payload: unknown): SignatoryMemberDto[] => {
  if (Array.isArray(payload)) return payload as SignatoryMemberDto[];
  if (payload && typeof payload === 'object') {
    const o = payload as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data as SignatoryMemberDto[];
    if (Array.isArray(o.members)) return o.members as SignatoryMemberDto[];
    if (Array.isArray(o.value)) return o.value as SignatoryMemberDto[];
  }
  if (payload != null) {
    console.warn('[signatoryApi] expected a members array, got:', payload);
  }
  return [];
};

const asThresholds = (payload: unknown, fallback: SignatoryThresholds): SignatoryThresholds => {
  let p = payload;
  if (p && typeof p === 'object' && 'data' in (p as Record<string, unknown>)) {
    p = (p as Record<string, unknown>).data;
  }
  const o = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
  const prepared = Number(o.preparedCount);
  const confirm = Number(o.confirmCount);
  return {
    preparedCount: Number.isFinite(prepared) && prepared > 0 ? prepared : fallback.preparedCount,
    confirmCount: Number.isFinite(confirm) && confirm > 0 ? confirm : fallback.confirmCount,
  };
};

// Same-origin server logic is always available (no external Function App or
// client id to configure). Kept for API compatibility with existing call sites.
export const isSignatoryApiConfigured = true;

/** All current signatory members. */
export const listSignatoryMembers = async (
  _loginHint?: string
): Promise<SignatoryMemberDto[]> => {
  const res = await powerPagesFetch<unknown>(MEMBERS_ENDPOINT, { method: 'GET' });
  // TODO(debug): remove once signatory-list rendering is confirmed.
  console.log('[signatoryApi] listMembers raw response:', res);
  const unwrapped = unwrapPayload(res);
  console.log('[signatoryApi] listMembers unwrapped payload:', unwrapped);
  const members = asMemberArray(unwrapped);
  console.log('[signatoryApi] listMembers final members:', members.length, members);
  return members;
};

/** Add a member to a signatory group. Returns the updated member list. */
export const addSignatoryMember = async (
  input: { name: string; email: string; group: 'prepared' | 'confirmed' },
  _loginHint?: string
): Promise<SignatoryMemberDto[]> => {
  const res = await powerPagesFetch<unknown>(MEMBERS_ENDPOINT, { method: 'POST', json: input });
  return asMemberArray(unwrapPayload(res));
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
  return asMemberArray(unwrapPayload(res));
};

/** Read the global minimum signature thresholds. */
export const getSignatoryThresholds = async (
  _loginHint?: string
): Promise<SignatoryThresholds> => {
  const res = await powerPagesFetch<unknown>(THRESHOLDS_ENDPOINT, { method: 'GET' });
  return asThresholds(unwrapPayload(res), { preparedCount: 1, confirmCount: 2 });
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
  return asThresholds(unwrapPayload(res), { preparedCount, confirmCount });
};
