// HTTP triggers for signatory group management.
//
//   GET    /api/signatory-members          → list all members (any authenticated user)
//   POST   /api/signatory-members          → add a member (admin only)
//   DELETE /api/signatory-members/{id}     → remove a member row by record GUID (admin only)

import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { validateToken, AuthError, type CallerIdentity } from '../auth/validateToken.js';
import { DataverseError } from '../dataverse/dataverseClient.js';
import { runForPortal } from '../dataverse/dataverseEnv.js';
import { isAdminByContactId } from '../dataverse/webRoles.js';
import {
  listSignatoryMembers,
  addSignatoryMember,
  removeSignatoryMember,
  getThresholds,
  setThresholds,
} from '../dataverse/signatories.js';

const VALID_GROUPS = new Set(['prepared', 'confirmed']);

const json = (status: number, body: unknown): HttpResponseInit => ({
  status,
  jsonBody: body,
  headers: { 'Content-Type': 'application/json' },
});

const toErrorResponse = (err: unknown, context: InvocationContext): HttpResponseInit => {
  if (err instanceof AuthError) {
    return json(err.status, { ok: false, error: err.message });
  }
  if (err instanceof DataverseError) {
    const status = err.status === 400 || err.status === 404 ? err.status : 502;
    if (status >= 500) {
      context.error(`Dataverse error (${err.status} ${err.code ?? ''}): ${err.message}`);
    }
    return json(status, {
      ok: false,
      error:
        status < 500
          ? err.message
          : 'The signatory service is unavailable. Please try again.',
    });
  }
  context.error('Unexpected error in signatory function', err);
  return json(500, { ok: false, error: 'Unexpected server error' });
};

// Validate the token only (no Dataverse calls). The handler then pins the
// Dataverse environment with `runForPortal(caller.portalBaseUrl, ...)` before
// any Dataverse access.
const authenticate = async (request: HttpRequest): Promise<CallerIdentity> => {
  const caller = await validateToken(request.headers.get('authorization'));
  if (!caller.contactId) throw new AuthError('Token is missing the contact id claim', 403);
  return caller;
};

// Confirm the caller is an admin. MUST run inside `runForPortal` so the admin
// check hits the issuing portal's Dataverse environment.
const ensureAdmin = async (
  caller: CallerIdentity,
  context: InvocationContext
): Promise<void> => {
  let isAdminUser: boolean;
  try {
    isAdminUser = await isAdminByContactId(caller.contactId);
  } catch (err) {
    context.error('Admin check against Dataverse failed', err);
    throw new AuthError('Could not verify administrator privileges', 502);
  }
  if (!isAdminUser) throw new AuthError('You must be an administrator to manage signatories', 403);
};

// ── GET /api/signatory-members ──────────────────────────────────────────────
app.http('listSignatoryMembers', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'signatory-members',
  handler: async (request, context) => {
    try {
      const caller = await authenticate(request);
      return await runForPortal(caller.portalBaseUrl, async () => {
        const members = await listSignatoryMembers();
        return json(200, { ok: true, members });
      });
    } catch (err) {
      return toErrorResponse(err, context);
    }
  },
});

// ── POST /api/signatory-members ─────────────────────────────────────────────
app.http('addSignatoryMember', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'signatory-members',
  handler: async (request, context) => {
    try {
      const caller = await authenticate(request);
      return await runForPortal(caller.portalBaseUrl, async () => {
        await ensureAdmin(caller, context);

        let body: { name?: string; email?: string; group?: string } | null = null;
        try {
          body = (await request.json()) as { name?: string; email?: string; group?: string };
        } catch {
          return json(400, { ok: false, error: 'Expected a JSON body' });
        }

        const name = String(body?.name ?? '').trim();
        const email = String(body?.email ?? '').trim();
        const group = String(body?.group ?? '').trim();

        if (!name) return json(400, { ok: false, error: "Missing 'name'" });
        if (!email) return json(400, { ok: false, error: "Missing 'email'" });
        if (!VALID_GROUPS.has(group)) {
          return json(400, { ok: false, error: "'group' must be 'prepared' or 'confirmed'" });
        }

        await addSignatoryMember({ name, email, group: group as 'prepared' | 'confirmed' });
        context.log(`${caller.upn || caller.contactId} added signatory '${name}' to group '${group}'`);

        const members = await listSignatoryMembers();
        return json(200, { ok: true, members });
      });
    } catch (err) {
      return toErrorResponse(err, context);
    }
  },
});

// ── GET /api/signatory-thresholds ───────────────────────────────────────────
app.http('getSignatoryThresholds', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'signatory-thresholds',
  handler: async (request, context) => {
    try {
      const caller = await authenticate(request);
      return await runForPortal(caller.portalBaseUrl, async () => {
        const thresholds = await getThresholds();
        return json(200, { ok: true, ...thresholds });
      });
    } catch (err) {
      return toErrorResponse(err, context);
    }
  },
});

// ── PATCH /api/signatory-thresholds ─────────────────────────────────────────
app.http('setSignatoryThresholds', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'signatory-thresholds',
  handler: async (request, context) => {
    try {
      const caller = await authenticate(request);
      return await runForPortal(caller.portalBaseUrl, async () => {
        await ensureAdmin(caller, context);

        let body: { preparedCount?: unknown; confirmCount?: unknown } | null = null;
        try {
          body = (await request.json()) as { preparedCount?: unknown; confirmCount?: unknown };
        } catch {
          return json(400, { ok: false, error: 'Expected a JSON body' });
        }

        const preparedCount = Number(body?.preparedCount);
        const confirmCount = Number(body?.confirmCount);

        if (!Number.isInteger(preparedCount) || preparedCount < 1) {
          return json(400, { ok: false, error: "'preparedCount' must be a positive integer" });
        }
        if (!Number.isInteger(confirmCount) || confirmCount < 1) {
          return json(400, { ok: false, error: "'confirmCount' must be a positive integer" });
        }

        await setThresholds(preparedCount, confirmCount);
        context.log(`${caller.upn || caller.contactId} set thresholds: prepared=${preparedCount}, confirm=${confirmCount}`);
        return json(200, { ok: true, preparedCount, confirmCount });
      });
    } catch (err) {
      return toErrorResponse(err, context);
    }
  },
});

// ── DELETE /api/signatory-members/{id} ──────────────────────────────────────
app.http('removeSignatoryMember', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'signatory-members/{id}',
  handler: async (request, context) => {
    try {
      const caller = await authenticate(request);
      return await runForPortal(caller.portalBaseUrl, async () => {
        await ensureAdmin(caller, context);

        const id = String(request.params.id ?? '').trim();
        if (!id) return json(400, { ok: false, error: "Missing record 'id'" });

        await removeSignatoryMember(id);
        context.log(`${caller.upn || caller.contactId} removed signatory member ${id}`);

        const members = await listSignatoryMembers();
        return json(200, { ok: true, members });
      });
    } catch (err) {
      return toErrorResponse(err, context);
    }
  },
});
