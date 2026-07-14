// src/types/stspRequest.ts
// TypeScript mirror of the gcp_stsprequest Dataverse table (display name
// "ST/SP Request" — Submission of Tender / Proposal).
// Logical name: gcp_stsprequest  |  Entity set: gcp_stsprequests
// Primary name: gcp_stsprequestname  |  PK: gcp_stsprequestid
//
// Repeatable/dynamic UI inputs (RepeatableTextField, DynamicTableSection) are
// persisted as JSON strings into single text columns — see src/forms/stsp/api.ts.
// NOTE: like gcp_jvmrequest, this table has no gcp_soacode column (SOA code
// lives on the parent gcp_request).

// ── Raw OData entity (as it comes back from /_api/gcp_stsprequests) ──────────
type GcpStspRequestEntity = {
  '@odata.etag'?: string;
  gcp_stsprequestid?: string;
  gcp_stsprequestname?: string | null;

  // Step 2 — Project details (the two fields stored on this table)
  gcp_tenderproposalsubmissiondate?: string | null; // DateTime (ISO on the wire)
  gcp_tendervalidityperiod?: string | null; // Text

  // Step 3 — PIC (text)
  gcp_teamleader?: string | null;
  gcp_financialmatters?: string | null;
  gcp_technicalmatters?: string | null;
  gcp_contractmatters?: string | null;
  gcp_procurementmatters?: string | null;
  gcp_costingandestimationmatters?: string | null;
  gcp_implementationstage?: string | null;

  // Step 4 — ST/SP Information (multiline / JSON)
  gcp_backgroundreview?: string | null;
  gcp_scopeofworks?: string | null;
  gcp_keyterms?: string | null;
  gcp_financials?: string | null;
  gcp_resourcescontribution?: string | null; // "Contract Structure Image"

  // Step 5 — ST/SP Information (multiline / JSON)
  gcp_technical?: string | null;
  gcp_procurementstrategyworkpackages?: string | null;
  gcp_sourcingreference?: string | null;
  gcp_costbreakdown?: string | null;
  gcp_riskidentificationmitigationplan?: string | null;

  // Lookups (GUID values exposed via _value suffix on GET)
  '_gcp_project_value'?: string | null;
  '_gcp_request_value'?: string | null;

  createdon?: string;
  modifiedon?: string;
};

// ── Clean domain type used by the React UI ──────────────────────────────────
type GcpStspRequest = {
  id: string;
  title: string | null;

  tenderProposalSubmissionDate: string | null;
  tenderValidityPeriod: string | null;

  teamLeader: string | null;
  financialMatters: string | null;
  technicalMatters: string | null;
  contractMatters: string | null;
  procurementMatters: string | null;
  costingAndEstimationMatters: string | null;
  implementationStage: string | null;

  backgroundReview: string | null;
  scopeOfWorks: string | null;
  keyTerms: string | null;
  financials: string | null;
  resourcesContribution: string | null;

  technical: string | null;
  procurementStrategyWorkPackages: string | null;
  sourcingReference: string | null;
  costBreakdown: string | null;
  riskIdentificationMitigationPlan: string | null;

  projectId: string | null;
  requestId: string | null;
};

// ── Input shape for create ──────────────────────────────────────────────────
// Lookups MUST be written via `<NavProperty>@odata.bind`:
//   gcp_Request → gcp_requests(<guid>)
//   gcp_Project → gcp_projectses(<guid>)
type CreateGcpStspRequestInput = {
  gcp_stsprequestname?: string | null;

  gcp_tenderproposalsubmissiondate?: string | null;
  gcp_tendervalidityperiod?: string | null;

  gcp_teamleader?: string | null;
  gcp_financialmatters?: string | null;
  gcp_technicalmatters?: string | null;
  gcp_contractmatters?: string | null;
  gcp_procurementmatters?: string | null;
  gcp_costingandestimationmatters?: string | null;
  gcp_implementationstage?: string | null;

  gcp_backgroundreview?: string | null;
  gcp_scopeofworks?: string | null;
  gcp_keyterms?: string | null;
  gcp_financials?: string | null;
  gcp_resourcescontribution?: string | null;

  gcp_technical?: string | null;
  gcp_procurementstrategyworkpackages?: string | null;
  gcp_sourcingreference?: string | null;
  gcp_costbreakdown?: string | null;
  gcp_riskidentificationmitigationplan?: string | null;

  'gcp_Project@odata.bind'?: string;
  'gcp_Request@odata.bind'?: string;
};

type UpdateGcpStspRequestInput = Partial<CreateGcpStspRequestInput>;

const mapGcpStspRequest = (e: GcpStspRequestEntity): GcpStspRequest => ({
  id: e.gcp_stsprequestid ?? '',
  title: e.gcp_stsprequestname ?? null,

  tenderProposalSubmissionDate: e.gcp_tenderproposalsubmissiondate ?? null,
  tenderValidityPeriod: e.gcp_tendervalidityperiod ?? null,

  teamLeader: e.gcp_teamleader ?? null,
  financialMatters: e.gcp_financialmatters ?? null,
  technicalMatters: e.gcp_technicalmatters ?? null,
  contractMatters: e.gcp_contractmatters ?? null,
  procurementMatters: e.gcp_procurementmatters ?? null,
  costingAndEstimationMatters: e.gcp_costingandestimationmatters ?? null,
  implementationStage: e.gcp_implementationstage ?? null,

  backgroundReview: e.gcp_backgroundreview ?? null,
  scopeOfWorks: e.gcp_scopeofworks ?? null,
  keyTerms: e.gcp_keyterms ?? null,
  financials: e.gcp_financials ?? null,
  resourcesContribution: e.gcp_resourcescontribution ?? null,

  technical: e.gcp_technical ?? null,
  procurementStrategyWorkPackages:
    e.gcp_procurementstrategyworkpackages ?? null,
  sourcingReference: e.gcp_sourcingreference ?? null,
  costBreakdown: e.gcp_costbreakdown ?? null,
  riskIdentificationMitigationPlan:
    e.gcp_riskidentificationmitigationplan ?? null,

  projectId: e['_gcp_project_value'] ?? null,
  requestId: e['_gcp_request_value'] ?? null,
});

const DEFAULT_STSP_REQUEST_SELECT: readonly string[] = [
  'gcp_stsprequestid',
  'gcp_stsprequestname',
  'gcp_tenderproposalsubmissiondate',
  'gcp_tendervalidityperiod',
  'gcp_teamleader',
  'gcp_financialmatters',
  'gcp_technicalmatters',
  'gcp_contractmatters',
  'gcp_procurementmatters',
  'gcp_costingandestimationmatters',
  'gcp_implementationstage',
  'gcp_backgroundreview',
  'gcp_scopeofworks',
  'gcp_keyterms',
  'gcp_financials',
  'gcp_technical',
  'gcp_procurementstrategyworkpackages',
  'gcp_sourcingreference',
  'gcp_costbreakdown',
  'gcp_riskidentificationmitigationplan',
  '_gcp_project_value',
  '_gcp_request_value',
];

export { mapGcpStspRequest, DEFAULT_STSP_REQUEST_SELECT };
export type {
  GcpStspRequest,
  GcpStspRequestEntity,
  CreateGcpStspRequestInput,
  UpdateGcpStspRequestInput,
};
