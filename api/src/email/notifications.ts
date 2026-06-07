// Sends a templated notification via Microsoft Graph, reusing the app-only Graph
// client (Mail.Send application permission) that the SharePoint uploader already
// authenticates with client-credentials.
//
// The HTML/subject come from an admin-editable template (gcp_emailtemplate) rendered
// against live request data — see renderTemplate.ts and dataverse/emailTemplates.ts.

import { getGraphClient } from '../sharepoint/graphClient.js';
import { getEmailConfig } from '../config.js';
import { renderEmailHtml, renderSubject, type EmailBlock, type TemplateData } from './renderTemplate.js';

export interface TemplatedEmail {
  subject: string;
  blocks: EmailBlock[];
  data: TemplateData;
  recipients: string[];
}

/** Render a template with data and send it to all recipients. Throws on Graph failure. */
export const sendTemplatedEmail = async (input: TemplatedEmail): Promise<void> => {
  const cfg = getEmailConfig();
  const message = {
    subject: renderSubject(input.subject, input.data) || 'Notification',
    importance: 'normal',
    body: { contentType: 'HTML', content: renderEmailHtml(input.blocks, input.data) },
    toRecipients: input.recipients.map((address) => ({ emailAddress: { address } })),
    from: { emailAddress: { address: cfg.senderMailbox } },
    replyTo: [{ emailAddress: { address: cfg.senderMailbox } }],
  };
  // Graph SDK middleware retries transient 429/503 with backoff automatically.
  await getGraphClient()
    .api(`/users/${encodeURIComponent(cfg.senderMailbox)}/sendMail`)
    .post({ message, saveToSentItems: true });
};
