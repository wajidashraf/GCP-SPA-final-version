// src/types/rpccaRequest.ts
// TypeScript mirror of the gcp_rpccarequestgcp Dataverse table (display name
// "Revised PCCA Request").
// Logical name: gcp_rpccarequestgcp  |  Entity set: gcp_rpccarequestgcps
// Primary name: gcp_rpccarequestname  |  PK: gcp_rpccarequestgcpid
//
// The Work Item Entry grid (DynamicWorkItemFiled) is persisted as a JSON string
// into the single multiline-text column gcp_workitementry — see
// src/forms/rpcca/api.ts.
// NOTE: this table has no gcp_soacode column (that lives on gcp_request) and
// links back to the parent only via gcp_Request.

// ── Raw OData entity (as it comes back from /_api/gcp_rpccarequestgcps) ──────
type GcpRpccaRequestEntity = {
  '@odata.etag'?: string;
  gcp_rpccarequestgcpid?: string;
  gcp_rpccarequestname?: string | null;

  // Step 2 — Work Item Entry (DynamicWorkItemFiled → JSON string, multiline text)
  gcp_workitementry?: string | null;
  gcp_remarks?: string | null;

  // Lookups (GUID values exposed via _value suffix on GET)
  '_gcp_request_value'?: string | null;

  createdon?: string;
  modifiedon?: string;
};

// ── Clean domain type used by the React UI ──────────────────────────────────
type GcpRpccaRequest = {
  id: string;
  name: string | null;

  workItemEntry: string | null;
  remarks: string | null;

  requestId: string | null;
};

// ── Input shape for create ──────────────────────────────────────────────────
// Lookups MUST be written via `<NavProperty>@odata.bind`:
//   gcp_Request → gcp_requests(<guid>)
type CreateGcpRpccaRequestInput = {
  gcp_rpccarequestname?: string | null;

  gcp_workitementry?: string | null;
  gcp_remarks?: string | null;

  'gcp_Request@odata.bind'?: string;
};

const mapGcpRpccaRequest = (e: GcpRpccaRequestEntity): GcpRpccaRequest => ({
  id: e.gcp_rpccarequestgcpid ?? '',
  name: e.gcp_rpccarequestname ?? null,

  workItemEntry: e.gcp_workitementry ?? null,
  remarks: e.gcp_remarks ?? null,

  requestId: e['_gcp_request_value'] ?? null,
});

const DEFAULT_RPCCA_REQUEST_SELECT: readonly string[] = [
  'gcp_rpccarequestgcpid',
  'gcp_rpccarequestname',
  'gcp_workitementry',
  'gcp_remarks',
  '_gcp_request_value',
];

export { mapGcpRpccaRequest, DEFAULT_RPCCA_REQUEST_SELECT };
export type { GcpRpccaRequest, GcpRpccaRequestEntity, CreateGcpRpccaRequestInput };
