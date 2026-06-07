// src/types/engagement.ts
// TypeScript mirror of the gcp_engagements Dataverse table (scheduled meetings
// between a request and a reviewer slot).
// Logical name: gcp_engagements  |  Entity set: gcp_engagementses
// PK: gcp_engagementsid  |  Primary name: gcp_name
//
// Lookups (written via `<NavProperty>@odata.bind`, read back via `_<name>_value`):
//   gcp_Slot               → gcp_slots
//   gcp_Request            → gcp_requests
//   gcp_EngagementCreatedBy→ contacts
//   gcp_AttendeeEmail      → contacts (the slot's attendee)

import type {
  EngagementStatusValue,
  EngagementTypeValue,
} from '../data/engagementChoices';

// ── Raw OData entity (as it comes back from /_api/gcp_engagementses) ──────────
type GcpEngagementEntity = {
  '@odata.etag'?: string;
  gcp_engagementsid?: string;
  gcp_name?: string | null;
  gcp_engagementnumber?: string | null;
  gcp_engagementdate?: string | null;
  gcp_starttime?: string | null;
  gcp_endtime?: string | null;
  gcp_engagementtype?: EngagementTypeValue | null;
  gcp_engagementstatus?: EngagementStatusValue | null;
  gcp_location?: string | null;

  _gcp_slot_value?: string | null;
  _gcp_request_value?: string | null;

  'gcp_engagementtype@OData.Community.Display.V1.FormattedValue'?: string;
  'gcp_engagementstatus@OData.Community.Display.V1.FormattedValue'?: string;

  createdon?: string;
  modifiedon?: string;
};

// ── Clean domain type used by the React UI ───────────────────────────────────
type Engagement = {
  id: string;
  name: string | null;
  number: string | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  type: EngagementTypeValue | null;
  typeLabel: string | null;
  status: EngagementStatusValue | null;
  statusLabel: string | null;
  location: string | null;
  slotId: string | null;
  requestId: string | null;
  /** ISO timestamp of when the engagement booking was created. */
  createdOn: string | null;
};

// ── Input shape for create ───────────────────────────────────────────────────
type CreateGcpEngagementInput = {
  gcp_name: string;
  gcp_engagementnumber: string;
  gcp_engagementdate: string;
  gcp_starttime: string | null;
  gcp_endtime: string | null;
  gcp_engagementtype: EngagementTypeValue;
  gcp_engagementstatus: EngagementStatusValue;
  gcp_location: string | null;

  'gcp_Slot@odata.bind'?: string;
  'gcp_Request@odata.bind'?: string;
  'gcp_EngagementCreatedBy@odata.bind'?: string;
  'gcp_AttendeeEmail@odata.bind'?: string;
};

const mapGcpEngagement = (e: GcpEngagementEntity): Engagement => ({
  id: e.gcp_engagementsid ?? '',
  name: e.gcp_name ?? null,
  number: e.gcp_engagementnumber ?? null,
  date: e.gcp_engagementdate ?? null,
  startTime: e.gcp_starttime ?? null,
  endTime: e.gcp_endtime ?? null,
  type: (e.gcp_engagementtype ?? null) as EngagementTypeValue | null,
  typeLabel:
    e['gcp_engagementtype@OData.Community.Display.V1.FormattedValue'] ?? null,
  status: (e.gcp_engagementstatus ?? null) as EngagementStatusValue | null,
  statusLabel:
    e['gcp_engagementstatus@OData.Community.Display.V1.FormattedValue'] ?? null,
  location: e.gcp_location ?? null,
  slotId: e._gcp_slot_value ?? null,
  requestId: e._gcp_request_value ?? null,
  createdOn: e.createdon ?? null,
});

const DEFAULT_ENGAGEMENT_SELECT: readonly string[] = [
  'gcp_engagementsid',
  'gcp_name',
  'gcp_engagementnumber',
  'gcp_engagementdate',
  'gcp_starttime',
  'gcp_endtime',
  'gcp_engagementtype',
  'gcp_engagementstatus',
  'gcp_location',
  '_gcp_slot_value',
  '_gcp_request_value',
  'createdon',
];

export { mapGcpEngagement, DEFAULT_ENGAGEMENT_SELECT };
export type { Engagement, GcpEngagementEntity, CreateGcpEngagementInput };
