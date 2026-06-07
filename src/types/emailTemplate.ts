// src/types/emailTemplate.ts
// TypeScript mirror of the gcp_emailtemplate Dataverse table — the admin-editable
// email templates used for lifecycle notifications.
//
// Logical name: gcp_emailtemplate | Entity set: gcp_emailtemplates | PK: gcp_emailtemplateid
//
// The body is stored as a JSON array of "blocks" (the structured visual builder's
// output) in the gcp_bodyblocks memo column. `eventkey` / `recipientrole` are stable
// text keys whose human labels + placeholder catalog live in src/data/emailTemplateEvents.ts
// (NOT Dataverse choices) so the registry can evolve without schema changes.

import type { EventKey, RecipientRole } from '../data/emailTemplateEvents';

// ── Body blocks (visual builder model) ──────────────────────────────────────
// Every text/value/label/href field may contain {{token}} placeholders that are
// resolved against the request record + caller identity at send time.
type EmailBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'fields'; rows: { label: string; value: string }[] }
  | { type: 'button'; label: string; href: string }
  | { type: 'divider' };

type EmailBlockType = EmailBlock['type'];

// ── Raw OData entity (as it comes back from /_api/gcp_emailtemplates) ────────
type GcpEmailTemplateEntity = {
  '@odata.etag'?: string;
  gcp_emailtemplateid?: string;
  /** Primary name column for this table. */
  gcp_emailtemplate1?: string | null;
  gcp_eventkey?: string | null;
  gcp_recipientrole?: string | null;
  gcp_subject?: string | null;
  /** JSON array of EmailBlock. */
  gcp_bodyblocks?: string | null;
  gcp_active?: boolean | null;
  createdon?: string;
  modifiedon?: string;
  statecode?: number;
  statuscode?: number;
};

// ── Clean domain type used by the React UI ──────────────────────────────────
type EmailTemplate = {
  id: string;
  name: string;
  eventKey: EventKey;
  recipientRole: RecipientRole;
  subject: string;
  blocks: EmailBlock[];
  active: boolean;
  modifiedOn?: string;
};

// ── Input shape for create / update ─────────────────────────────────────────
type EmailTemplateInput = {
  gcp_emailtemplate1: string;
  gcp_eventkey: string;
  gcp_recipientrole: string;
  gcp_subject: string;
  gcp_bodyblocks: string;
  gcp_active: boolean;
};

// Tolerant parse of the stored JSON blocks — never throws, returns [] on bad data
// so a malformed row can't break the whole admin page.
const parseBlocks = (raw: string | null | undefined): EmailBlock[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as EmailBlock[]) : [];
  } catch {
    return [];
  }
};

const mapEmailTemplate = (e: GcpEmailTemplateEntity): EmailTemplate => ({
  id: e.gcp_emailtemplateid ?? '',
  name: e.gcp_emailtemplate1 ?? '',
  eventKey: (e.gcp_eventkey ?? '') as EventKey,
  recipientRole: (e.gcp_recipientrole ?? '') as RecipientRole,
  subject: e.gcp_subject ?? '',
  blocks: parseBlocks(e.gcp_bodyblocks),
  active: e.gcp_active ?? false,
  modifiedOn: e.modifiedon,
});

const DEFAULT_TEMPLATE_SELECT: readonly string[] = [
  'gcp_emailtemplateid',
  'gcp_emailtemplate1',
  'gcp_eventkey',
  'gcp_recipientrole',
  'gcp_subject',
  'gcp_bodyblocks',
  'gcp_active',
  'modifiedon',
];

export { mapEmailTemplate, parseBlocks, DEFAULT_TEMPLATE_SELECT };
export type {
  EmailBlock,
  EmailBlockType,
  EmailTemplate,
  EmailTemplateEntity,
  EmailTemplateInput,
};
type EmailTemplateEntity = GcpEmailTemplateEntity;
