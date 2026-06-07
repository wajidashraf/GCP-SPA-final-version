// HTTP trigger: POST /api/notifications/event           (body: { recordId, eventKey })
//          and POST /api/notifications/requestSubmitted  (legacy; eventKey defaults
//                                                          to 'request_submitted')
//
// Sends lifecycle notifications driven by admin-editable templates (gcp_emailtemplate).
// For the given event it loads every active template (one per recipient role), resolves
// that role's recipients, renders the template against live request data, and sends.
// Fire-and-forget from the SPA — failures here never block the Dataverse write.
//
// authLevel is 'anonymous' on purpose — we authenticate with the Entra bearer token
// the SPA sends (like uploadFile / manageWebRoles), NOT a Function key.

import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { validateToken, AuthError, type CallerIdentity } from '../auth/validateToken.js';
import { DataverseError } from '../dataverse/dataverseClient.js';
import { runForPortal } from '../dataverse/dataverseEnv.js';
import { getContactsInWebRole } from '../dataverse/webRoles.js';
import { getActiveTemplatesForEvent } from '../dataverse/emailTemplates.js';
import type { EmailTemplateRow } from '../dataverse/emailTemplates.js';
import { getRequestForNotification } from '../dataverse/requests.js';
import { sendTemplatedEmail } from '../email/notifications.js';
import { getDefaultTemplatesForEvent } from '../email/defaultTemplates.js';
import { getEmailConfig } from '../config.js';

// Recipient-role key → web-role name. MUST stay in sync with the frontend registry
// src/data/emailTemplateEvents.ts (recipientRoleWebRole). `requester` is resolved from
// the request record, so it has no web role.
const RECIPIENT_WEBROLE: Record<string, string | null> = {
  requester: null,
  verifier: 'Verifier',
  reviewer: 'Reviewer',
  working_gcpc: 'Working GCPC',
  endorser: 'Endorser',
  hoc: 'HOC',
};

const json = (status: number, body: unknown): HttpResponseInit => ({
  status,
  jsonBody: body,
  headers: { 'Content-Type': 'application/json' },
});

const handler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  // 1. Authenticate the caller. The Dataverse environment is pinned below via
  //    `runForPortal(caller.portalBaseUrl, ...)`, so the record reads hit the org
  //    backing the issuing portal.
  let caller: CallerIdentity;
  try {
    caller = await validateToken(request.headers.get('authorization'));
  } catch (err) {
    if (err instanceof AuthError) return json(err.status, { ok: false, error: err.message });
    context.error('Unexpected auth error', err);
    return json(401, { ok: false, error: 'Authentication failed' });
  }

  // 2. Parse payload. eventKey falls back to the legacy 'request_submitted'.
  let body: { recordId?: string; eventKey?: string };
  try {
    body = (await request.json()) as { recordId?: string; eventKey?: string };
  } catch {
    return json(400, { ok: false, error: 'Expected a JSON body' });
  }
  if (!body.recordId) return json(400, { ok: false, error: 'Missing required field: recordId' });
  // Capture in a const so the narrowing survives into the closure below.
  const recordId = body.recordId;
  const eventKey = body.eventKey ?? 'request_submitted';

  try {
    return await runForPortal(caller.portalBaseUrl, async () => {
    const cfg = getEmailConfig();

    // 3. Load admin templates for this event, then fill any missing roles with defaults.
    const adminTemplates = await getActiveTemplatesForEvent(eventKey);
    const adminRoles = new Set(adminTemplates.map((t) => t.recipientRole));
    const fallbacks: EmailTemplateRow[] = getDefaultTemplatesForEvent(eventKey)
      .filter((d) => !adminRoles.has(d.recipientRole))
      .map((d) => ({ id: '', eventKey: d.eventKey, recipientRole: d.recipientRole, subject: d.subject, blocks: d.blocks, active: true }));
    const templates = [...adminTemplates, ...fallbacks];
    if (templates.length === 0) {
      context.log(`No templates for event '${eventKey}' — nothing to send.`);
      return json(202, { ok: true, sent: 0, message: 'No templates for this event.' });
    }
    if (fallbacks.length > 0) {
      context.log(`Using default templates for roles: ${fallbacks.map((f) => f.recipientRole).join(', ')}`);
    }

    // 4. Load the request record once for placeholder data. Prefer the issuing
    //    portal's own origin for the {{viewLink}} deep link so prod emails link
    //    to prod (and dev to dev); fall back to the configured SPA_BASE_URL.
    const { data, requesterEmail } = await getRequestForNotification(
      recordId,
      caller.portalBaseUrl || cfg.spaBaseUrl
    );

    // 5. Render + send each template to its recipient role.
    let sent = 0;
    for (const tmpl of templates) {
      const webRole = RECIPIENT_WEBROLE[tmpl.recipientRole];
      let recipients: string[];
      if (tmpl.recipientRole === 'requester') {
        recipients = requesterEmail ? [requesterEmail] : [];
      } else if (webRole) {
        recipients = (await getContactsInWebRole(webRole)).map((c) => c.email);
      } else {
        context.warn(`Unknown recipient role '${tmpl.recipientRole}' — skipping.`);
        continue;
      }
      recipients = [...new Set(recipients.map((e) => e.toLowerCase().trim()))].filter(Boolean);
      if (recipients.length === 0) {
        context.log(`No recipients for role '${tmpl.recipientRole}' — skipping that template.`);
        continue;
      }
      await sendTemplatedEmail({
        subject: tmpl.subject,
        blocks: tmpl.blocks,
        data,
        recipients,
      });
      sent += 1;
      context.log(
        `Sent '${eventKey}' → '${tmpl.recipientRole}' to ${recipients.length} recipient(s).`
      );
    }

    return json(202, { ok: true, sent });
    });
  } catch (err) {
    if (err instanceof DataverseError) {
      context.error(`Dataverse error (${err.status} ${err.code ?? ''}): ${err.message}`);
    } else {
      context.error('Notification send failed', err);
    }
    // Non-blocking: the record already exists. Report failure; SPA degrades gracefully.
    return json(500, {
      ok: false,
      error: 'Notification could not be sent. The request was still saved.',
    });
  }
};

app.http('sendNotificationEvent', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'notifications/event',
  handler,
});

// Legacy route kept so an older SPA bundle keeps working during rollout.
app.http('sendNotificationEmail', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'notifications/requestSubmitted',
  handler,
});
