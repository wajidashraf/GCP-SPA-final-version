// src/shared/powerPagesApi.ts
// Centralized Power Pages Web API client used by every table service in this site.
// - Caches the __RequestVerificationToken (re-fetches only on 403 / 90040107).
// - Adds retry with exponential backoff for 429 / 5xx.
// - Distinguishes 401 (session expired, no retry) from 403 (permission / AFT).
// - Provides OData helpers: $select/$filter quoting, paging, lookup bind, etc.

// ── Anti-Forgery Token ──────────────────────────────────────────────────────
let cachedAntiForgeryToken: string | null = null;

const fetchAntiForgeryToken = async (): Promise<string> => {
  if (cachedAntiForgeryToken !== null) return cachedAntiForgeryToken;

  const res = await fetch('/_layout/tokenhtml', { credentials: 'same-origin' });
  if (!res.ok) {
    throw new Error(`Failed to fetch anti-forgery token (${res.status})`);
  }
  const html = await res.text();
  const valueString = 'value="';
  const terminal = '" />';
  const i = html.indexOf(valueString);
  if (i === -1) {
    cachedAntiForgeryToken = '';
    return '';
  }
  const token = html.substring(i + valueString.length, html.indexOf(terminal, i));
  cachedAntiForgeryToken = token ?? '';
  return cachedAntiForgeryToken;
};

const invalidateAntiForgeryToken = () => {
  cachedAntiForgeryToken = null;
};

// ── Error codes ─────────────────────────────────────────────────────────────
const WebApiErrorCode = {
  AntiForgeryInvalid: '90040107',
  ReadPermissionDenied: '90040120',
  WritePermissionDenied: '90040102',
  CreatePermissionDenied: '90040103',
  DeletePermissionDenied: '90040104',
  ResourceNotFound: '9004010c',
  QueryParamNotSupported: '9004010B',
} as const;

const isPermissionError = (code?: string): boolean =>
  !!code &&
  (code === WebApiErrorCode.ReadPermissionDenied ||
    code === WebApiErrorCode.WritePermissionDenied ||
    code === WebApiErrorCode.CreatePermissionDenied ||
    code === WebApiErrorCode.DeletePermissionDenied);

class WebApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'WebApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// ── Headers ─────────────────────────────────────────────────────────────────
type PowerPagesFetchInit = Omit<RequestInit, 'body'> & {
  body?: BodyInit | unknown;
  json?: unknown;
  /** Skip JSON parsing and return the raw Response (used by file download). */
  raw?: boolean;
};

const buildHeaders = async (
  init: PowerPagesFetchInit | undefined,
  isMutation: boolean,
  hasJsonBody: boolean
): Promise<Headers> => {
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (!headers.has('OData-MaxVersion')) headers.set('OData-MaxVersion', '4.0');
  if (!headers.has('OData-Version')) headers.set('OData-Version', '4.0');
  if (hasJsonBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json; charset=utf-8');
  }
  // Always include token (harmless on GET, required on mutations).
  const token = await fetchAntiForgeryToken();
  if (token) headers.set('__RequestVerificationToken', token);
  // Mutations always carry If-Match: * for PATCH; callers may override.
  if (isMutation && !headers.has('If-Match') && (init?.method === 'PATCH')) {
    headers.set('If-Match', '*');
  }
  return headers;
};

// ── Core fetch wrapper ──────────────────────────────────────────────────────
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 400;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type ODataErrorBody = {
  error?: { code?: string; message?: string; innererror?: unknown };
};

const parseErrorBody = async (res: Response): Promise<ODataErrorBody | undefined> => {
  try {
    const text = await res.text();
    if (!text) return undefined;
    return JSON.parse(text) as ODataErrorBody;
  } catch {
    return undefined;
  }
};

const powerPagesFetch = async <T = unknown>(
  url: string,
  init?: PowerPagesFetchInit
): Promise<T> => {
  const method = (init?.method ?? 'GET').toUpperCase();
  const isMutation = method !== 'GET' && method !== 'HEAD';

  let body: BodyInit | undefined;
  let hasJsonBody = false;
  if (init?.json !== undefined) {
    body = JSON.stringify(init.json);
    hasJsonBody = true;
  } else if (init?.body !== undefined) {
    body = init.body as BodyInit;
    hasJsonBody = typeof body === 'string';
  }

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const headers = await buildHeaders(init, isMutation, hasJsonBody);
    const res = await fetch(url, {
      ...init,
      method,
      headers,
      body,
      credentials: 'same-origin',
    });

    // No-content responses.
    if (res.status === 204) return undefined as T;

    if (res.ok) {
      if (init?.raw) return res as unknown as T;
      // Caller may want headers (e.g. Location). For now return parsed body or empty.
      const text = await res.text();
      if (!text) return undefined as T;
      try {
        return JSON.parse(text) as T;
      } catch {
        return text as unknown as T;
      }
    }

    const errorBody = await parseErrorBody(res);
    const code = errorBody?.error?.code;
    const message = errorBody?.error?.message ?? res.statusText;

    // 403 — could be expired anti-forgery token or real permission denial.
    if (res.status === 403 && code === WebApiErrorCode.AntiForgeryInvalid && attempt < MAX_RETRIES) {
      invalidateAntiForgeryToken();
      attempt += 1;
      continue;
    }

    // 401 — session expired, do not retry.
    if (res.status === 401) {
      throw new WebApiError('Session expired. Please sign in again.', 401, code, errorBody);
    }

    // 429 / 5xx — transient, retry with backoff.
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      const retryAfter = Number(res.headers.get('Retry-After'));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : RETRY_BASE_MS * Math.pow(2, attempt);
      await sleep(delay);
      attempt += 1;
      continue;
    }

    throw new WebApiError(message, res.status, code, errorBody);
  }
};

// Variant that returns the full Response so callers can read headers (e.g. Location on POST).
const powerPagesFetchResponse = async (
  url: string,
  init?: PowerPagesFetchInit
): Promise<Response> => {
  const method = (init?.method ?? 'GET').toUpperCase();
  const isMutation = method !== 'GET' && method !== 'HEAD';

  let body: BodyInit | undefined;
  let hasJsonBody = false;
  if (init?.json !== undefined) {
    body = JSON.stringify(init.json);
    hasJsonBody = true;
  } else if (init?.body !== undefined) {
    body = init.body as BodyInit;
    hasJsonBody = typeof body === 'string';
  }

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const headers = await buildHeaders(init, isMutation, hasJsonBody);
    const res = await fetch(url, {
      ...init,
      method,
      headers,
      body,
      credentials: 'same-origin',
    });

    if (res.ok) return res;

    const errorBody = await parseErrorBody(res);
    const code = errorBody?.error?.code;
    const message = errorBody?.error?.message ?? res.statusText;

    if (res.status === 403 && code === WebApiErrorCode.AntiForgeryInvalid && attempt < MAX_RETRIES) {
      invalidateAntiForgeryToken();
      attempt += 1;
      continue;
    }
    if (res.status === 401) {
      throw new WebApiError('Session expired. Please sign in again.', 401, code, errorBody);
    }
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      const delay = RETRY_BASE_MS * Math.pow(2, attempt);
      await sleep(delay);
      attempt += 1;
      continue;
    }
    throw new WebApiError(message, res.status, code, errorBody);
  }
};

// ── OData helpers ───────────────────────────────────────────────────────────
const escapeODataString = (value: string): string =>
  value.replace(/'/g, "''");

type ODataQuery = {
  select?: readonly string[];
  expand?: readonly string[];
  filter?: string;
  orderby?: string;
  top?: number;
  count?: boolean;
  apply?: string;
};

const buildODataQuery = (q: ODataQuery): string => {
  const parts: string[] = [];
  if (q.select?.length) parts.push(`$select=${q.select.join(',')}`);
  if (q.expand?.length) parts.push(`$expand=${q.expand.join(',')}`);
  if (q.filter) parts.push(`$filter=${encodeURIComponent(q.filter)}`);
  if (q.orderby) parts.push(`$orderby=${encodeURIComponent(q.orderby)}`);
  if (typeof q.top === 'number') parts.push(`$top=${q.top}`);
  if (q.count) parts.push('$count=true');
  if (q.apply) parts.push(`$apply=${encodeURIComponent(q.apply)}`);
  return parts.length ? `?${parts.join('&')}` : '';
};

/** Build a lookup bind value, e.g. odataBind('contacts', guid). */
const odataBind = (entitySet: string, id: string): string =>
  `/${entitySet}(${id})`;

/** Extract the new record GUID from a POST response's Location/OData-EntityId header. */
const extractRecordId = (res: Response): string | undefined => {
  const header =
    res.headers.get('OData-EntityId') ??
    res.headers.get('Location') ??
    res.headers.get('location');
  if (!header) return undefined;
  const match = header.match(/\(([0-9a-fA-F-]{36})\)/);
  return match?.[1];
};

type ODataListResponse<T> = {
  value: T[];
  '@odata.count'?: number;
  '@odata.nextLink'?: string;
};

const pageSizeHeader = (size: number): HeadersInit => ({
  Prefer: `odata.maxpagesize=${size}`,
});

const includeFormattedValues = (): HeadersInit => ({
  Prefer: 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"',
});

/** Combine multiple Prefer headers into one comma-separated value. */
const combinePrefer = (...prefers: HeadersInit[]): HeadersInit => {
  const values = prefers
    .map((p) => (p as Record<string, string>).Prefer)
    .filter(Boolean);
  return { Prefer: values.join(', ') };
};

export {
  powerPagesFetch,
  powerPagesFetchResponse,
  fetchAntiForgeryToken,
  invalidateAntiForgeryToken,
  WebApiError,
  WebApiErrorCode,
  isPermissionError,
  escapeODataString,
  buildODataQuery,
  odataBind,
  extractRecordId,
  pageSizeHeader,
  includeFormattedValues,
  combinePrefer,
};
export type { ODataQuery, ODataListResponse, PowerPagesFetchInit };
