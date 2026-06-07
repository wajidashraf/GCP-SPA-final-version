// Minimal app-only client for the Dataverse Web API.
//
// Authenticates with the client-credentials flow (the app registration must be
// an Application User in the environment) and exposes thin GET / POST / DELETE
// helpers that set the OData headers Dataverse expects. @azure/identity caches
// and refreshes the access token internally, so the credential is reused across
// invocations within a warm Function instance.

import { ClientSecretCredential, type AccessToken } from '@azure/identity';
import { getRoleConfig } from '../config.js';
import { currentDataverseUrl } from './dataverseEnv.js';

// The effective Dataverse environment for the current invocation. Multi-portal
// deployments pin this per request (see dataverseEnv / validateToken); otherwise
// it falls back to the single configured DATAVERSE_URL. The client credential
// (tenant/app/secret) is shared across environments — only the resource scope and
// base URL change, and @azure/identity caches one token per resource scope.
const effectiveDataverseUrl = (): string =>
  currentDataverseUrl() ?? getRoleConfig().dataverseUrl;

export class DataverseError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'DataverseError';
    this.status = status;
    this.code = code;
  }
}

let cachedCredential: ClientSecretCredential | null = null;

const getCredential = (): ClientSecretCredential => {
  if (cachedCredential) return cachedCredential;
  const cfg = getRoleConfig();
  cachedCredential = new ClientSecretCredential(
    cfg.tenantId,
    cfg.dataverseClientId,
    cfg.dataverseClientSecret
  );
  return cachedCredential;
};

const getToken = async (): Promise<string> => {
  // Dataverse expects the resource ".default" scope, e.g.
  // https://org.crm.dynamics.com/.default — scoped to the invocation's environment.
  const token: AccessToken | null = await getCredential().getToken(
    `${effectiveDataverseUrl()}/.default`
  );
  if (!token?.token) {
    throw new DataverseError('Failed to acquire a Dataverse access token', 500);
  }
  return token.token;
};

/** Absolute URL to a Dataverse Web API resource (relativePath starts after the version). */
export const dataverseUrl = (relativePath: string): string => {
  const cfg = getRoleConfig();
  const path = relativePath.replace(/^\/+/, '');
  return `${effectiveDataverseUrl()}/api/data/${cfg.dataverseApiVersion}/${path}`;
};

const baseHeaders = async (): Promise<Record<string, string>> => ({
  Authorization: `Bearer ${await getToken()}`,
  Accept: 'application/json',
  'OData-MaxVersion': '4.0',
  'OData-Version': '4.0',
});

const parseError = async (res: Response): Promise<DataverseError> => {
  let code: string | undefined;
  let message = res.statusText;
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string } };
    code = body?.error?.code;
    if (body?.error?.message) message = body.error.message;
  } catch {
    /* non-JSON error body */
  }
  return new DataverseError(message, res.status, code);
};

/** GET a Dataverse resource and parse the JSON body. Pass extra headers (e.g. a
 * Prefer for formatted-value annotations) via the optional second argument. */
export const dvGet = async <T = unknown>(
  relativePath: string,
  extraHeaders?: Record<string, string>
): Promise<T> => {
  const res = await fetch(dataverseUrl(relativePath), {
    method: 'GET',
    headers: { ...(await baseHeaders()), ...(extraHeaders ?? {}) },
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as T;
};

/** POST a JSON body (used for $ref associate). Returns nothing on 204. */
export const dvPost = async (relativePath: string, json: unknown): Promise<void> => {
  const res = await fetch(dataverseUrl(relativePath), {
    method: 'POST',
    headers: { ...(await baseHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify(json),
  });
  if (!res.ok) throw await parseError(res);
};

/** PATCH a Dataverse record (used for field updates). */
export const dvPatch = async (relativePath: string, json: unknown): Promise<void> => {
  const res = await fetch(dataverseUrl(relativePath), {
    method: 'PATCH',
    headers: {
      ...(await baseHeaders()),
      'Content-Type': 'application/json',
      'If-Match': '*',
    },
    body: JSON.stringify(json),
  });
  if (!res.ok) throw await parseError(res);
};

/** DELETE a Dataverse resource (used for $ref disassociate). */
export const dvDelete = async (relativePath: string): Promise<void> => {
  const res = await fetch(dataverseUrl(relativePath), {
    method: 'DELETE',
    headers: await baseHeaders(),
  });
  if (!res.ok) throw await parseError(res);
};
