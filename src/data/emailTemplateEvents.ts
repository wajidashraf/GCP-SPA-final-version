// src/data/emailTemplateEvents.ts
// Single source of truth for the email-template feature: the workflow events that
// trigger notifications, the audiences (recipient roles) each event can target, and
// the placeholder catalog available to each event.
//
// These are NOT Dataverse choices — gcp_emailtemplate.gcp_eventkey / gcp_recipientrole
// are plain text keys. Keeping the catalog here lets us add events/placeholders without
// any schema change. The send-side Function mirrors these keys; keep them in sync.

import type { EmailBlock } from '../types/emailTemplate';

// ── Recipient roles ─────────────────────────────────────────────────────────
// 'requester' is resolved from the request record (gcp_RequestorName); the rest map
// to a Power Pages web role whose active members receive the email.
type RecipientRole =
  | 'requester'
  | 'verifier'
  | 'reviewer'
  | 'working_gcpc'
  | 'endorser'
  | 'hoc';

const recipientRoleLabels: Record<RecipientRole, string> = {
  requester: 'Requester',
  verifier: 'Verifier',
  reviewer: 'Reviewer',
  working_gcpc: 'Working GCPC',
  endorser: 'Endorser',
  hoc: 'HOC',
};

// Recipient role → web-role name (must match src/data/webRoles.ts). `requester` is
// resolved from the request record itself, so it has no web role.
const recipientRoleWebRole: Record<RecipientRole, string | null> = {
  requester: null,
  verifier: 'Verifier',
  reviewer: 'Reviewer',
  working_gcpc: 'Working GCPC',
  endorser: 'Endorser',
  hoc: 'HOC',
};

// ── Placeholders ──────────────────────────────────────────────────────────────
type Placeholder = {
  /** Token written in the template, e.g. `requestName` for {{requestName}}. */
  token: string;
  label: string;
  /** Value shown in the admin live preview. */
  sample: string;
};

// Available to every event (sourced from the gcp_request record + caller identity).
const commonPlaceholders: readonly Placeholder[] = [
  { token: 'requestName', label: 'Request Name', sample: 'Riverside Phase 2 Tender' },
  { token: 'requestType', label: 'Request Type', sample: 'RTP' },
  { token: 'requestNumber', label: 'Request Number', sample: 'REQ-001042' },
  { token: 'requestCategory', label: 'Category', sample: 'GCPC' },
  { token: 'requestStatus', label: 'Status', sample: 'New' },
  { token: 'requestorName', label: 'Requester Name', sample: 'Aisha Rahman' },
  { token: 'requestorEmail', label: 'Requester Email', sample: 'aisha.rahman@example.com' },
  { token: 'submissionDate', label: 'Submission Date', sample: '12 June 2026, 3:45 PM (MYT)' },
  { token: 'viewLink', label: 'View Request Link', sample: 'https://portal.example.com/requests/REQ-001042' },
] as const;

const verifyPlaceholders: readonly Placeholder[] = [
  { token: 'verifierName', label: 'Verifier Name', sample: 'Daniel Lim' },
  { token: 'verifierComment', label: 'Verifier Comment', sample: 'Documents complete; proceed to review.' },
  { token: 'verifyDate', label: 'Verification Date', sample: '13 June 2026, 10:20 AM (MYT)' },
] as const;

const reviewPlaceholders: readonly Placeholder[] = [
  { token: 'reviewerName', label: 'Reviewer Name', sample: 'Priya Nair' },
  { token: 'decisionCode', label: 'Decision Code', sample: 'Code 1 (Proceed)' },
  { token: 'outcome', label: 'Outcome', sample: 'ACK' },
  { token: 'reviewDate', label: 'Review Date', sample: '14 June 2026, 4:05 PM (MYT)' },
] as const;

// ── Events ──────────────────────────────────────────────────────────────────
type EmailEvent = {
  key: string;
  label: string;
  description: string;
  recipientRoles: readonly RecipientRole[];
  placeholders: readonly Placeholder[];
};

const emailEvents = [
  {
    key: 'request_submitted',
    label: 'Request Submitted',
    description: 'Sent when a requester submits a new request.',
    recipientRoles: ['requester', 'verifier'],
    placeholders: commonPlaceholders,
  },
  {
    key: 'request_verified',
    label: 'Request Verified',
    description: 'Sent after a verifier completes verification.',
    recipientRoles: ['reviewer', 'requester'],
    placeholders: [...commonPlaceholders, ...verifyPlaceholders],
  },
  {
    key: 'request_reviewed',
    label: 'Request Reviewed',
    description: "Sent after a reviewer records the review decision.",
    recipientRoles: ['requester', 'working_gcpc'],
    placeholders: [...commonPlaceholders, ...verifyPlaceholders, ...reviewPlaceholders],
  },
] as const satisfies readonly EmailEvent[];

type EventKey = (typeof emailEvents)[number]['key'];

// ── Lookups ───────────────────────────────────────────────────────────────────
const getEvent = (key: string): EmailEvent | undefined =>
  emailEvents.find((e) => e.key === key);

const getEventPlaceholders = (key: string): readonly Placeholder[] =>
  getEvent(key)?.placeholders ?? commonPlaceholders;

/** Starter subject + blocks for a freshly-created (event × role) template. */
const defaultTemplate = (
  eventKey: EventKey,
  role: RecipientRole
): { subject: string; blocks: EmailBlock[] } => {
  const ev = getEvent(eventKey);
  const heading =
    role === 'requester'
      ? `Your ${eventKey === 'request_submitted' ? 'request has been submitted' : ev?.label ?? 'request update'}`
      : `${ev?.label ?? 'Request update'}: {{requestName}}`;
  return {
    subject: `[{{requestType}}] ${ev?.label ?? 'Request update'}: {{requestName}}`,
    blocks: [
      { type: 'heading', text: heading },
      {
        type: 'paragraph',
        text:
          role === 'requester'
            ? 'This is a confirmation for your request. Details are below.'
            : 'A request requires your attention. Details are below.',
      },
      {
        type: 'fields',
        rows: [
          { label: 'Request Number', value: '{{requestNumber}}' },
          { label: 'Request Name', value: '{{requestName}}' },
          { label: 'Request Type', value: '{{requestType}}' },
          { label: 'Status', value: '{{requestStatus}}' },
        ],
      },
      { type: 'button', label: 'View Request', href: '{{viewLink}}' },
    ],
  };
};

export {
  emailEvents,
  recipientRoleLabels,
  recipientRoleWebRole,
  commonPlaceholders,
  getEvent,
  getEventPlaceholders,
  defaultTemplate,
};
export type { EmailEvent, EventKey, RecipientRole, Placeholder };
