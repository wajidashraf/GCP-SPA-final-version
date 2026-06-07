// Read-side access to the gcp_emailtemplate table for the notification sender.
// The admin UI writes templates via the Power Pages Web API; here we read the active
// template(s) for an event app-only at send time.

import { dvGet } from './dataverseClient.js';
import { getEmailConfig } from '../config.js';
import { parseBlocks, type EmailBlock } from '../email/renderTemplate.js';

export interface EmailTemplateRow {
  id: string;
  eventKey: string;
  recipientRole: string;
  subject: string;
  blocks: EmailBlock[];
  active: boolean;
}

interface ODataList<T> {
  value: T[];
}

const escapeOData = (value: string): string => value.replace(/'/g, "''");

type RawTemplate = {
  gcp_emailtemplateid?: string;
  gcp_eventkey?: string | null;
  gcp_recipientrole?: string | null;
  gcp_subject?: string | null;
  gcp_bodyblocks?: string | null;
  gcp_active?: boolean | null;
};

/** Active templates for an event, one per recipient role. */
export const getActiveTemplatesForEvent = async (
  eventKey: string
): Promise<EmailTemplateRow[]> => {
  const cfg = getEmailConfig();
  const safe = escapeOData(eventKey);
  const data = await dvGet<ODataList<RawTemplate>>(
    `${cfg.templateEntitySet}?$select=gcp_emailtemplateid,gcp_eventkey,gcp_recipientrole,gcp_subject,gcp_bodyblocks,gcp_active` +
      `&$filter=gcp_active eq true and gcp_eventkey eq '${safe}'`
  );
  return data.value.map((r) => ({
    id: String(r.gcp_emailtemplateid ?? ''),
    eventKey: String(r.gcp_eventkey ?? ''),
    recipientRole: String(r.gcp_recipientrole ?? ''),
    subject: String(r.gcp_subject ?? ''),
    blocks: parseBlocks(r.gcp_bodyblocks),
    active: r.gcp_active === true,
  }));
};
