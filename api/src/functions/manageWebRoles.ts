// HTTP triggers for admin web-role management.
//
//   GET  /api/webRoles                          → list every web role
//   GET  /api/contacts/{contactId}/webRoles     → roles assigned to a contact
//   POST /api/contacts/{contactId}/webRoles     → { webRoleId, action } assign|unassign
//
// Every call:
//   1. Validates the Entra bearer token the SPA sends (issuer/audience/scope).
//   2. Authorizes server-side that the CALLER holds the admin web role in
//      Dataverse (client-side isAdmin() is UX only and must not be trusted).
//   3. Performs the privileged Dataverse operation as the application user.
//
// authLevel is 'anonymous' on purpose — we authenticate with the Entra bearer
// token, NOT a Function key (a key would have to be embedded in browser JS).

import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { validateToken, AuthError, type CallerIdentity } from '../auth/validateToken.js';
import { DataverseError } from '../dataverse/dataverseClient.js';
import { runForPortal } from '../dataverse/dataverseEnv.js';
import {
  listWebRoles,
  getContactWebRoles,
  assignWebRole,
  unassignWebRole,
  isAdminByContactId,
} from '../dataverse/webRoles.js';

const json = (status: number, body: unknown): HttpResponseInit => ({
  status,
  jsonBody: body,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Validate the token (no Dataverse calls — just signature + claims). The caller's
 * `portalBaseUrl` is then used by the handler to pin the Dataverse environment
 * via `runForPortal` before any Dataverse access.
 */
const authenticate = async (request: HttpRequest): Promise<CallerIdentity> => {
  const caller = await validateToken(request.headers.get('authorization'));
  if (!caller.contactId) {
    throw new AuthError('Token is missing the contact id claim', 403);
  }
  return caller;
};

/**
 * Confirm the caller is an admin. MUST be called inside `runForPortal` so the
 * Dataverse admin check targets the issuing portal's environment. Throws
 * AuthError on any failure so handlers can map it to an HTTP status.
 */
const ensureAdmin = async (
  caller: CallerIdentity,
  context: InvocationContext
): Promise<void> => {
  let isAdmin: boolean;
  try {
    isAdmin = await isAdminByContactId(caller.contactId);
  } catch (err) {
    context.error('Admin check against Dataverse failed', err);
    throw new AuthError('Could not verify administrator privileges', 502);
  }
  if (!isAdmin) {
    throw new AuthError('You must be an administrator to manage web roles', 403);
  }
};

/** Map any thrown error to an HTTP response. */
const toErrorResponse = (err: unknown, context: InvocationContext): HttpResponseInit => {
  if (err instanceof AuthError) {
    return json(err.status, { ok: false, error: err.message });
  }
  if (err instanceof DataverseError) {
    // 400 (e.g. bad GUID) is the caller's fault; everything else is upstream.
    const status = err.status === 400 ? 400 : 502;
    context.error(`Dataverse error (${err.status} ${err.code ?? ''}): ${err.message}`);
    return json(status, {
      ok: false,
      error:
        status === 400
          ? err.message
          : 'The role service is unavailable. Please try again or contact support.',
    });
  }
  context.error('Unexpected error in web-role function', err);
  return json(500, { ok: false, error: 'Unexpected server error' });
};

// ── GET /api/webRoles ───────────────────────────────────────────────────────
const listWebRolesHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  try {
    const caller = await authenticate(request);
    return await runForPortal(caller.portalBaseUrl, async () => {
      await ensureAdmin(caller, context);
      const roles = await listWebRoles();
      return json(200, { ok: true, roles });
    });
  } catch (err) {
    return toErrorResponse(err, context);
  }
};

// ── /api/contacts/{contactId}/webRoles (GET + POST) ──────────────────────────
const contactWebRolesHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  try {
    const caller = await authenticate(request);
    return await runForPortal(caller.portalBaseUrl, async () => {
      await ensureAdmin(caller, context);
      const contactId = request.params.contactId ?? '';

      if (request.method === 'GET') {
        const roles = await getContactWebRoles(contactId);
        return json(200, { ok: true, roles });
      }

      // POST — assign or unassign.
      let body: { webRoleId?: string; action?: string } | null = null;
      try {
        body = (await request.json()) as { webRoleId?: string; action?: string };
      } catch {
        return json(400, { ok: false, error: 'Expected a JSON body' });
      }

      const webRoleId = String(body?.webRoleId ?? '');
      const action = String(body?.action ?? '');
      if (!webRoleId) {
        return json(400, { ok: false, error: "Missing 'webRoleId'" });
      }
      if (action !== 'assign' && action !== 'unassign') {
        return json(400, { ok: false, error: "'action' must be 'assign' or 'unassign'" });
      }

      if (action === 'assign') {
        await assignWebRole(contactId, webRoleId);
      } else {
        await unassignWebRole(contactId, webRoleId);
      }

      context.log(
        `${caller.upn || caller.contactId} ${action}ed web role ${webRoleId} ${action === 'assign' ? 'to' : 'from'} contact ${contactId}`
      );

      // Return the contact's current roles so the SPA can re-sync without a 2nd call.
      const roles = await getContactWebRoles(contactId);
      return json(200, { ok: true, action, roles });
    });
  } catch (err) {
    return toErrorResponse(err, context);
  }
};

app.http('listWebRoles', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'webRoles',
  handler: listWebRolesHandler,
});

app.http('contactWebRoles', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'contacts/{contactId}/webRoles',
  handler: contactWebRolesHandler,
});
