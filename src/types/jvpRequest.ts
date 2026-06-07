// src/types/jvpRequest.ts
// TypeScript mirror of the gcp_jvmrequest Dataverse table (display name "JVP
// Request"; schema name uses the "JVM" prefix).
// Logical name: gcp_jvmrequest  |  Entity set: gcp_jvmrequests
// Primary name: gcp_jvmrequesttitle  |  PK: gcp_jvmrequestid
//
// Repeatable/dynamic UI inputs (RepeatableTextField, DynamicTableSection) are
// persisted as JSON strings into single text columns — see src/forms/jvp/api.ts.
// NOTE: this table has no gcp_soacode column (that lives on gcp_request).

// ── Raw OData entity (as it comes back from /_api/gcp_jvmrequests) ───────────
type GcpJvpRequestEntity = {
  '@odata.etag'?: string;
  gcp_jvmrequestid?: string;
  gcp_jvmrequesttitle?: string | null;

  // Step 2 — PIC (text)
  gcp_pic_team_leader?: string | null;
  gcp_picfinancialmatters?: string | null;
  gcp_pictechnicalmatters?: string | null;
  gcp_piccontractmatters?: string | null;
  gcp_picprocurementmatters?: string | null;
  gcp_piccostingestimation?: string | null;
  gcp_picimplementationstage?: string | null;

  // Step 3 — Collaboration (text / JSON)
  gcp_backgroundofcollaboration?: string | null;
  gcp_scope_of_collaboration?: string | null;
  gcp_proposed_structure?: string | null;

  // Step 4 — Key terms & financials (text / JSON)
  gcp_key_terms?: string | null;
  gcp_financialoverview?: string | null;
  gcp_technical_capabilities_resources?: string | null;

  // Step 5 — Work packages, resourcing & risk (text / JSON)
  gcp_workpackages_divisionofresponsibilities?: string | null;
  gcp_resourcecontributionmanpowerdesigntoolset?: string | null;
  gcp_cost_structure_breakdown?: string | null;
  gcp_risk_review_mitigation?: string | null;

  // Lookups (GUID values exposed via _value suffix on GET)
  '_gcp_project_value'?: string | null;
  '_gcp_request_value'?: string | null;

  createdon?: string;
  modifiedon?: string;
};

// ── Clean domain type used by the React UI ──────────────────────────────────
type GcpJvpRequest = {
  id: string;
  title: string | null;

  picTeamLeader: string | null;
  picFinancialMatters: string | null;
  picTechnicalMatters: string | null;
  picContractMatters: string | null;
  picProcurementMatters: string | null;
  picCostingEstimation: string | null;
  picImplementationStage: string | null;

  backgroundOfCollaboration: string | null;
  scopeOfCollaboration: string | null;
  proposedStructure: string | null;

  keyTerms: string | null;
  financialOverview: string | null;
  technicalCapabilitiesResources: string | null;

  workPackagesDivisionOfResponsibilities: string | null;
  resourceContribution: string | null;
  costStructureBreakdown: string | null;
  riskReviewMitigation: string | null;

  projectId: string | null;
  requestId: string | null;
};

// ── Input shape for create ──────────────────────────────────────────────────
// Lookups MUST be written via `<NavProperty>@odata.bind`:
//   gcp_Request → gcp_requests(<guid>)
//   gcp_Project → gcp_projectses(<guid>)
type CreateGcpJvpRequestInput = {
  gcp_jvmrequesttitle?: string | null;

  gcp_pic_team_leader?: string | null;
  gcp_picfinancialmatters?: string | null;
  gcp_pictechnicalmatters?: string | null;
  gcp_piccontractmatters?: string | null;
  gcp_picprocurementmatters?: string | null;
  gcp_piccostingestimation?: string | null;
  gcp_picimplementationstage?: string | null;

  gcp_backgroundofcollaboration?: string | null;
  gcp_scope_of_collaboration?: string | null;
  gcp_proposed_structure?: string | null;

  gcp_key_terms?: string | null;
  gcp_financialoverview?: string | null;
  gcp_technical_capabilities_resources?: string | null;

  gcp_workpackages_divisionofresponsibilities?: string | null;
  gcp_resourcecontributionmanpowerdesigntoolset?: string | null;
  gcp_cost_structure_breakdown?: string | null;
  gcp_risk_review_mitigation?: string | null;

  'gcp_Project@odata.bind'?: string;
  'gcp_Request@odata.bind'?: string;
};

const mapGcpJvpRequest = (e: GcpJvpRequestEntity): GcpJvpRequest => ({
  id: e.gcp_jvmrequestid ?? '',
  title: e.gcp_jvmrequesttitle ?? null,

  picTeamLeader: e.gcp_pic_team_leader ?? null,
  picFinancialMatters: e.gcp_picfinancialmatters ?? null,
  picTechnicalMatters: e.gcp_pictechnicalmatters ?? null,
  picContractMatters: e.gcp_piccontractmatters ?? null,
  picProcurementMatters: e.gcp_picprocurementmatters ?? null,
  picCostingEstimation: e.gcp_piccostingestimation ?? null,
  picImplementationStage: e.gcp_picimplementationstage ?? null,

  backgroundOfCollaboration: e.gcp_backgroundofcollaboration ?? null,
  scopeOfCollaboration: e.gcp_scope_of_collaboration ?? null,
  proposedStructure: e.gcp_proposed_structure ?? null,

  keyTerms: e.gcp_key_terms ?? null,
  financialOverview: e.gcp_financialoverview ?? null,
  technicalCapabilitiesResources: e.gcp_technical_capabilities_resources ?? null,

  workPackagesDivisionOfResponsibilities:
    e.gcp_workpackages_divisionofresponsibilities ?? null,
  resourceContribution: e.gcp_resourcecontributionmanpowerdesigntoolset ?? null,
  costStructureBreakdown: e.gcp_cost_structure_breakdown ?? null,
  riskReviewMitigation: e.gcp_risk_review_mitigation ?? null,

  projectId: e['_gcp_project_value'] ?? null,
  requestId: e['_gcp_request_value'] ?? null,
});

const DEFAULT_JVP_REQUEST_SELECT: readonly string[] = [
  'gcp_jvmrequestid',
  'gcp_jvmrequesttitle',
  'gcp_pic_team_leader',
  'gcp_picfinancialmatters',
  'gcp_pictechnicalmatters',
  'gcp_piccontractmatters',
  'gcp_picprocurementmatters',
  'gcp_piccostingestimation',
  'gcp_picimplementationstage',
  'gcp_backgroundofcollaboration',
  'gcp_scope_of_collaboration',
  'gcp_proposed_structure',
  'gcp_key_terms',
  'gcp_financialoverview',
  'gcp_technical_capabilities_resources',
  'gcp_workpackages_divisionofresponsibilities',
  'gcp_resourcecontributionmanpowerdesigntoolset',
  'gcp_cost_structure_breakdown',
  'gcp_risk_review_mitigation',
  '_gcp_project_value',
  '_gcp_request_value',
];

export { mapGcpJvpRequest, DEFAULT_JVP_REQUEST_SELECT };
export type { GcpJvpRequest, GcpJvpRequestEntity, CreateGcpJvpRequestInput };
