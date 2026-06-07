// src/types/otherRequest.ts
// TypeScript mirror of the gcp_otherrequests Dataverse table (display name
// "Other Requests"). Used by BOTH the GCPC "Others Form" (matter 9) and the GCP
// "GCP - Others" (matter 13) — they differ only by channel/SOA code and share
// this one table.
// Logical name: gcp_otherrequests  |  Entity set: gcp_otherrequestses
// Primary name: gcp_requestname  |  PK: gcp_otherrequestsid
//
// NOTE: the parent link uses the `gcp_Requestlookup` navigation property
// (logical `gcp_requestlookup`), NOT `gcp_Request` like the other child tables.
// This table has no gcp_soacode column (that lives on gcp_request).

// ── Raw OData entity (as it comes back from /_api/gcp_otherrequestses) ───────
type GcpOtherRequestEntity = {
  '@odata.etag'?: string;
  gcp_otherrequestsid?: string;
  gcp_requestname?: string | null;
  gcp_descriptionofmatters?: string | null;
  gcp_projectcode?: string | null;
  gcp_acknowledgement?: boolean | null;

  // Lookups (GUID values exposed via _value suffix on GET)
  '_gcp_company_value'?: string | null;
  '_gcp_project_value'?: string | null;
  '_gcp_requestlookup_value'?: string | null;

  createdon?: string;
  modifiedon?: string;
};

// ── Clean domain type used by the React UI ──────────────────────────────────
type GcpOtherRequest = {
  id: string;
  name: string | null;
  descriptionOfMatters: string | null;
  projectCode: string | null;
  acknowledged: boolean | null;

  companyId: string | null;
  projectId: string | null;
  requestId: string | null;
};

// ── Input shape for create ──────────────────────────────────────────────────
// Lookups MUST be written via `<NavProperty>@odata.bind`:
//   gcp_Requestlookup → gcp_requests(<guid>)
//   gcp_Project       → gcp_projectses(<guid>)
//   gcp_Company       → accounts(<guid>)
type CreateGcpOtherRequestInput = {
  gcp_requestname?: string | null;
  gcp_descriptionofmatters?: string | null;
  gcp_projectcode?: string | null;
  gcp_acknowledgement?: boolean;

  'gcp_Company@odata.bind'?: string;
  'gcp_Project@odata.bind'?: string;
  'gcp_Requestlookup@odata.bind'?: string;
};

const mapGcpOtherRequest = (e: GcpOtherRequestEntity): GcpOtherRequest => ({
  id: e.gcp_otherrequestsid ?? '',
  name: e.gcp_requestname ?? null,
  descriptionOfMatters: e.gcp_descriptionofmatters ?? null,
  projectCode: e.gcp_projectcode ?? null,
  acknowledged: e.gcp_acknowledgement ?? null,

  companyId: e['_gcp_company_value'] ?? null,
  projectId: e['_gcp_project_value'] ?? null,
  requestId: e['_gcp_requestlookup_value'] ?? null,
});

const DEFAULT_OTHER_REQUEST_SELECT: readonly string[] = [
  'gcp_otherrequestsid',
  'gcp_requestname',
  'gcp_descriptionofmatters',
  'gcp_projectcode',
  'gcp_acknowledgement',
  '_gcp_company_value',
  '_gcp_project_value',
  '_gcp_requestlookup_value',
];

export { mapGcpOtherRequest, DEFAULT_OTHER_REQUEST_SELECT };
export type {
  GcpOtherRequest,
  GcpOtherRequestEntity,
  CreateGcpOtherRequestInput,
};
