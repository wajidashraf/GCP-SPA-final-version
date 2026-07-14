// src/types/vapRequest.ts
// TypeScript mirror of the gcp_vaprequest Dataverse table (display name "VAP
// Request" — Vendor Appointment and Procurement).
// Logical name: gcp_vaprequest  |  Entity set: gcp_vaprequests
// Primary name: gcp_vaprequestname  |  PK: gcp_vaprequestid
//
// This child carries only the acknowledgement bit + a link back to the parent
// gcp_request. The project/company/project-code details live on the parent
// gcp_request (see src/forms/vap/api.ts); the matching lookups exist on this
// table too and are bound for consistency.
// NOTE: this table has no gcp_soacode column (that lives on gcp_request).

// ── Raw OData entity (as it comes back from /_api/gcp_vaprequests) ───────────
type GcpVapRequestEntity = {
  '@odata.etag'?: string;
  gcp_vaprequestid?: string;
  gcp_vaprequestname?: string | null;
  gcp_projectcode?: string | null;
  gcp_acknowledgement?: boolean | null;

  // Lookups (GUID values exposed via _value suffix on GET)
  '_gcp_company_value'?: string | null;
  '_gcp_project_value'?: string | null;
  '_gcp_request_value'?: string | null;

  createdon?: string;
  modifiedon?: string;
};

// ── Clean domain type used by the React UI ──────────────────────────────────
type GcpVapRequest = {
  id: string;
  name: string | null;
  projectCode: string | null;
  acknowledged: boolean | null;

  companyId: string | null;
  projectId: string | null;
  requestId: string | null;
};

// ── Input shape for create ──────────────────────────────────────────────────
// Lookups MUST be written via `<NavProperty>@odata.bind`:
//   gcp_Request → gcp_requests(<guid>)
//   gcp_Project → gcp_projectses(<guid>)
//   gcp_Company → accounts(<guid>)
type CreateGcpVapRequestInput = {
  gcp_vaprequestname?: string | null;
  gcp_projectcode?: string | null;
  gcp_acknowledgement?: boolean;

  'gcp_Company@odata.bind'?: string;
  'gcp_Project@odata.bind'?: string;
  'gcp_Request@odata.bind'?: string;
};

// ── Input shape for update (PATCH) ──────────────────────────────────────────
// All scalar fields optional; lookups are rebound via the service's lookup binds.
type UpdateGcpVapRequestInput = Partial<CreateGcpVapRequestInput>;

const mapGcpVapRequest = (e: GcpVapRequestEntity): GcpVapRequest => ({
  id: e.gcp_vaprequestid ?? '',
  name: e.gcp_vaprequestname ?? null,
  projectCode: e.gcp_projectcode ?? null,
  acknowledged: e.gcp_acknowledgement ?? null,

  companyId: e['_gcp_company_value'] ?? null,
  projectId: e['_gcp_project_value'] ?? null,
  requestId: e['_gcp_request_value'] ?? null,
});

const DEFAULT_VAP_REQUEST_SELECT: readonly string[] = [
  'gcp_vaprequestid',
  'gcp_vaprequestname',
  'gcp_projectcode',
  'gcp_acknowledgement',
  '_gcp_company_value',
  '_gcp_project_value',
  '_gcp_request_value',
];

export { mapGcpVapRequest, DEFAULT_VAP_REQUEST_SELECT };
export type {
  GcpVapRequest,
  GcpVapRequestEntity,
  CreateGcpVapRequestInput,
  UpdateGcpVapRequestInput,
};
