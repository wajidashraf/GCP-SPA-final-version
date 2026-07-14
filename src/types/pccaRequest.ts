// src/types/pccaRequest.ts
// TypeScript mirror of the gcp_pccarequest Dataverse table (display name "PCCA
// Request" — Project Cost & Construction Analysis).
// Logical name: gcp_pccarequest  |  Entity set: gcp_pccarequests
// Primary name: gcp_occarequestname  |  PK: gcp_pccarequestid
//
// Repeatable/dynamic UI inputs (DynamicRowFields) are persisted as JSON strings
// into single multiline-text columns — see src/forms/pcca/api.ts.
// NOTE: this table has no gcp_soacode column (that lives on gcp_request).

// ── Raw OData entity (as it comes back from /_api/gcp_pccarequests) ──────────
type GcpPccaRequestEntity = {
  '@odata.etag'?: string;
  gcp_pccarequestid?: string;
  gcp_occarequestname?: string | null;

  // Step 2 — Cost Information (DynamicRowFields → JSON strings, multiline text)
  gcp_pricerevenuefromcontractbq?: string | null;
  gcp_costfromcontractbq?: string | null;

  // Step 3 — Cost Summary
  gcp_totalrevenuerm?: number | null;
  gcp_totalcostrm?: number | null;
  gcp_constructioncostrm?: number | null;
  gcp_internalcost?: number | null;
  gcp_remarks?: string | null;

  // Step 4 — Acknowledgement
  gcp_acknowledgement?: boolean | null;

  // Lookups (GUID values exposed via _value suffix on GET)
  '_gcp_company_value'?: string | null;
  '_gcp_project_value'?: string | null;
  '_gcp_request_value'?: string | null;

  createdon?: string;
  modifiedon?: string;
};

// ── Clean domain type used by the React UI ──────────────────────────────────
type GcpPccaRequest = {
  id: string;
  title: string | null;

  priceRevenueFromContractBq: string | null;
  costFromContractBq: string | null;

  totalRevenue: number | null;
  totalCost: number | null;
  constructionCost: number | null;
  internalCost: number | null;
  remarks: string | null;

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
type CreateGcpPccaRequestInput = {
  gcp_occarequestname?: string | null;

  gcp_pricerevenuefromcontractbq?: string | null;
  gcp_costfromcontractbq?: string | null;

  gcp_totalrevenuerm?: number | null;
  gcp_totalcostrm?: number | null;
  gcp_constructioncostrm?: number | null;
  gcp_internalcost?: number | null;
  gcp_remarks?: string | null;

  gcp_acknowledgement?: boolean;

  'gcp_Company@odata.bind'?: string;
  'gcp_Project@odata.bind'?: string;
  'gcp_Request@odata.bind'?: string;
};

// ── Input shape for update (PATCH) ──────────────────────────────────────────
// All scalar fields optional; lookups are rebound via the service's lookup binds.
type UpdateGcpPccaRequestInput = Partial<CreateGcpPccaRequestInput>;

const mapGcpPccaRequest = (e: GcpPccaRequestEntity): GcpPccaRequest => ({
  id: e.gcp_pccarequestid ?? '',
  title: e.gcp_occarequestname ?? null,

  priceRevenueFromContractBq: e.gcp_pricerevenuefromcontractbq ?? null,
  costFromContractBq: e.gcp_costfromcontractbq ?? null,

  totalRevenue: e.gcp_totalrevenuerm ?? null,
  totalCost: e.gcp_totalcostrm ?? null,
  constructionCost: e.gcp_constructioncostrm ?? null,
  internalCost: e.gcp_internalcost ?? null,
  remarks: e.gcp_remarks ?? null,

  acknowledged: e.gcp_acknowledgement ?? null,

  companyId: e['_gcp_company_value'] ?? null,
  projectId: e['_gcp_project_value'] ?? null,
  requestId: e['_gcp_request_value'] ?? null,
});

const DEFAULT_PCCA_REQUEST_SELECT: readonly string[] = [
  'gcp_pccarequestid',
  'gcp_occarequestname',
  'gcp_pricerevenuefromcontractbq',
  'gcp_costfromcontractbq',
  'gcp_totalrevenuerm',
  'gcp_totalcostrm',
  'gcp_constructioncostrm',
  'gcp_internalcost',
  'gcp_remarks',
  'gcp_acknowledgement',
  '_gcp_company_value',
  '_gcp_project_value',
  '_gcp_request_value',
];

export { mapGcpPccaRequest, DEFAULT_PCCA_REQUEST_SELECT };
export type {
  GcpPccaRequest,
  GcpPccaRequestEntity,
  CreateGcpPccaRequestInput,
  UpdateGcpPccaRequestInput,
};
