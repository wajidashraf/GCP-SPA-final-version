// src/types/ciRequest.ts
// TypeScript mirror of the gcp_requestcigcp Dataverse table (display name
// "Request CI GCP" — Contractual Issue Relating to Payment).
// Logical name: gcp_requestcigcp  |  Entity set: gcp_requestcigcps
// Primary name: gcp_name  |  PK: gcp_requestcigcpid
//
// NOTE: gcp_company is REQUIRED on this child. gcp_category is a free TEXT
// column (one of the three CI categories). gcp_contractclausepayment was added
// to Dataverse recently and may be absent from older solution exports.
// This table has no gcp_soacode column (that lives on gcp_request).

import type { CompanyRoleInIssueValue } from '../data/companyChoices';

// ── Raw OData entity (as it comes back from /_api/gcp_requestcigcps) ─────────
type GcpCiRequestEntity = {
  '@odata.etag'?: string;
  gcp_requestcigcpid?: string;
  gcp_name?: string | null;
  gcp_projectcode?: string | null;
  gcp_companyroleinthisissue?: CompanyRoleInIssueValue | null;

  // Step 3 — VO / EOT / L&E Information
  gcp_category?: string | null;
  gcp_chronologyofeventvo?: string | null;
  gcp_briefofissuesvo?: string | null;
  gcp_timeandcostimpactvo?: string | null;
  gcp_contractclause?: string | null;
  gcp_advisoryrequiredfromgcpvo?: string | null;

  // Step 4 — Payments Information
  gcp_briefofissuespayments?: string | null;
  gcp_chronologyofeventpayments?: string | null;
  gcp_contractclausepayment?: string | null;
  gcp_advisoryrequiredfromgcppayments?: string | null;

  // Step 5 — Acknowledgement
  gcp_acknowledgement?: boolean | null;

  // Lookups (GUID values exposed via _value suffix on GET)
  '_gcp_company_value'?: string | null;
  '_gcp_project_value'?: string | null;
  '_gcp_request_value'?: string | null;

  createdon?: string;
  modifiedon?: string;
};

// ── Clean domain type used by the React UI ──────────────────────────────────
type GcpCiRequest = {
  id: string;
  name: string | null;
  projectCode: string | null;
  companyRole: CompanyRoleInIssueValue | null;

  category: string | null;
  chronologyOfEventVo: string | null;
  briefOfIssuesVo: string | null;
  timeAndCostImpactVo: string | null;
  contractClause: string | null;
  advisoryRequiredVo: string | null;

  briefOfIssuesPayments: string | null;
  chronologyOfEventPayments: string | null;
  contractClausePayment: string | null;
  advisoryRequiredPayments: string | null;

  acknowledged: boolean | null;

  companyId: string | null;
  projectId: string | null;
  requestId: string | null;
};

// ── Input shape for create ──────────────────────────────────────────────────
// Lookups MUST be written via `<NavProperty>@odata.bind`:
//   gcp_Request → gcp_requests(<guid>)
//   gcp_Project → gcp_projectses(<guid>)
//   gcp_Company → accounts(<guid>)   (REQUIRED)
type CreateGcpCiRequestInput = {
  gcp_name?: string | null;
  gcp_projectcode?: string | null;
  gcp_companyroleinthisissue?: CompanyRoleInIssueValue | null;

  gcp_category?: string | null;
  gcp_chronologyofeventvo?: string | null;
  gcp_briefofissuesvo?: string | null;
  gcp_timeandcostimpactvo?: string | null;
  gcp_contractclause?: string | null;
  gcp_advisoryrequiredfromgcpvo?: string | null;

  gcp_briefofissuespayments?: string | null;
  gcp_chronologyofeventpayments?: string | null;
  gcp_contractclausepayment?: string | null;
  gcp_advisoryrequiredfromgcppayments?: string | null;

  gcp_acknowledgement?: boolean;

  'gcp_Company@odata.bind'?: string;
  'gcp_Project@odata.bind'?: string;
  'gcp_Request@odata.bind'?: string;
};

const mapGcpCiRequest = (e: GcpCiRequestEntity): GcpCiRequest => ({
  id: e.gcp_requestcigcpid ?? '',
  name: e.gcp_name ?? null,
  projectCode: e.gcp_projectcode ?? null,
  companyRole: e.gcp_companyroleinthisissue ?? null,

  category: e.gcp_category ?? null,
  chronologyOfEventVo: e.gcp_chronologyofeventvo ?? null,
  briefOfIssuesVo: e.gcp_briefofissuesvo ?? null,
  timeAndCostImpactVo: e.gcp_timeandcostimpactvo ?? null,
  contractClause: e.gcp_contractclause ?? null,
  advisoryRequiredVo: e.gcp_advisoryrequiredfromgcpvo ?? null,

  briefOfIssuesPayments: e.gcp_briefofissuespayments ?? null,
  chronologyOfEventPayments: e.gcp_chronologyofeventpayments ?? null,
  contractClausePayment: e.gcp_contractclausepayment ?? null,
  advisoryRequiredPayments: e.gcp_advisoryrequiredfromgcppayments ?? null,

  acknowledged: e.gcp_acknowledgement ?? null,

  companyId: e['_gcp_company_value'] ?? null,
  projectId: e['_gcp_project_value'] ?? null,
  requestId: e['_gcp_request_value'] ?? null,
});

const DEFAULT_CI_REQUEST_SELECT: readonly string[] = [
  'gcp_requestcigcpid',
  'gcp_name',
  'gcp_projectcode',
  'gcp_companyroleinthisissue',
  'gcp_category',
  'gcp_chronologyofeventvo',
  'gcp_briefofissuesvo',
  'gcp_timeandcostimpactvo',
  'gcp_contractclause',
  'gcp_advisoryrequiredfromgcpvo',
  'gcp_briefofissuespayments',
  'gcp_chronologyofeventpayments',
  'gcp_contractclausepayment',
  'gcp_advisoryrequiredfromgcppayments',
  'gcp_acknowledgement',
  '_gcp_company_value',
  '_gcp_project_value',
  '_gcp_request_value',
];

export { mapGcpCiRequest, DEFAULT_CI_REQUEST_SELECT };
export type { GcpCiRequest, GcpCiRequestEntity, CreateGcpCiRequestInput };
