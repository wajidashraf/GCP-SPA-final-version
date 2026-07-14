// src/types/caaRequest.ts
// TypeScript mirror of the gcp_caarequest Dataverse table (display name "CAA
// Request" — Client Acceptance of Award).
// Logical name: gcp_caarequest  |  Entity set: gcp_caarequests
// Primary name: gcp_title  |  PK: gcp_caarequestid
//
// Repeatable/dynamic UI inputs (DynamicRowFields) are persisted as JSON strings
// into single multiline-text columns — see src/forms/caa/api.ts.
// NOTE: this table has no gcp_soacode column (that lives on gcp_request).
// The project org/manpower chart upload (gcp_projectorganisationandmanpowerchart_image)
// is display-only on the UI for now and is intentionally NOT persisted.

// ── Raw OData entity (as it comes back from /_api/gcp_caarequests) ───────────
type GcpCaaRequestEntity = {
  '@odata.etag'?: string;
  gcp_caarequestid?: string;
  gcp_title?: string | null;
  gcp_projectcode?: string | null;

  // Step 2 — Cost Information
  gcp_tenderproposalpriceduringsubmissionoftend?: number | null;
  gcp_finalcontractamount?: number | null;
  gcp_estimatedbudgetcost?: number | null;
  gcp_estimatedmargin?: number | null;
  gcp_tenderproposalrefno?: string | null;
  gcp_letterofawardloa?: string | null;
  gcp_contractcommencement?: string | null;
  gcp_contractcompletiondate?: string | null;
  gcp_contractperioddays?: number | null;

  // Step 3 — CAA Information
  gcp_performancebondpbforproject?: string | null;
  gcp_stampdutyinclusiveoflegalcostandfees?: number | null;
  gcp_insurance?: string | null;
  gcp_bumiputeraparticipation?: string | null;
  gcp_formationofjvcompany?: string | null;
  gcp_criticalactivitymilestone?: string | null;
  gcp_defectliabilityperioddlp?: string | null;

  // Step 4 — CAA Information
  gcp_liquidateddamagesladrate?: number | null;
  gcp_paymentterm?: string | null;
  gcp_typeofcontract?: string | null;
  gcp_formofcontractconditionofcontract?: string | null;
  gcp_projectdirectorpd?: string | null;
  gcp_contactpersonatsitedesignationcontactno?: string | null;

  // Step 5 — CAA Information (JSON strings)
  gcp_claimmanagementclaimapplicationprocess?: string | null;
  gcp_claimmanagementclaimcertificationprocess?: string | null;
  gcp_changemanagementvariationorderapplicationpr?: string | null;

  // Step 6 — CAA Information (JSON strings)
  gcp_changemanagementextensionoftimeapplication?: string | null;
  gcp_commissioningandcompletionmanagementsystems?: string | null;
  gcp_keydeliverymilestone?: string | null;

  // Step 7 — CAA Information (JSON strings)
  gcp_mandatorytestingrequiredtocommission?: string | null;
  gcp_documentrequiredforcontractualacceptanceofpr?: string | null;
  gcp_prerequisitedocumentsforcompletionofdlp?: string | null;

  // Step 8 — Acknowledgement
  gcp_acknowledgement?: boolean | null;

  // Lookups (GUID values exposed via _value suffix on GET)
  '_gcp_company_value'?: string | null;
  '_gcp_project_value'?: string | null;
  '_gcp_request_value'?: string | null;

  createdon?: string;
  modifiedon?: string;
};

// ── Clean domain type used by the React UI ──────────────────────────────────
type GcpCaaRequest = {
  id: string;
  title: string | null;
  projectCode: string | null;

  tenderProposalPrice: number | null;
  finalContractAmount: number | null;
  estimatedBudgetCost: number | null;
  estimatedMargin: number | null;
  tenderProposalRefNo: string | null;
  letterOfAwardDate: string | null;
  contractCommencementDate: string | null;
  contractCompletionDate: string | null;
  contractPeriodDays: number | null;

  performanceBond: string | null;
  stampDuty: number | null;
  insurance: string | null;
  bumiputeraParticipation: string | null;
  formationOfJvCompany: string | null;
  criticalActivitiesMilestones: string | null;
  defectLiabilityPeriod: string | null;

  liquidatedDamagesRate: number | null;
  paymentTerm: string | null;
  typeOfContract: string | null;
  formOfContract: string | null;
  projectDirector: string | null;
  contactPersonAtSite: string | null;

  claimApplicationProcess: string | null;
  claimCertificationProcess: string | null;
  variationOrderApplicationProcess: string | null;

  extensionOfTimeApplicationProcess: string | null;
  commissioningCompletionSystems: string | null;
  keyDeliveryMilestone: string | null;

  mandatoryTesting: string | null;
  documentForContractualAcceptance: string | null;
  prerequisiteDocumentsForDlp: string | null;

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
type CreateGcpCaaRequestInput = {
  gcp_title?: string | null;
  gcp_projectcode?: string | null;

  gcp_tenderproposalpriceduringsubmissionoftend?: number | null;
  gcp_finalcontractamount?: number | null;
  gcp_estimatedbudgetcost?: number | null;
  gcp_estimatedmargin?: number | null;
  gcp_tenderproposalrefno?: string | null;
  gcp_letterofawardloa?: string | null;
  gcp_contractcommencement?: string | null;
  gcp_contractcompletiondate?: string | null;
  gcp_contractperioddays?: number | null;

  gcp_performancebondpbforproject?: string | null;
  gcp_stampdutyinclusiveoflegalcostandfees?: number | null;
  gcp_insurance?: string | null;
  gcp_bumiputeraparticipation?: string | null;
  gcp_formationofjvcompany?: string | null;
  gcp_criticalactivitymilestone?: string | null;
  gcp_defectliabilityperioddlp?: string | null;

  gcp_liquidateddamagesladrate?: number | null;
  gcp_paymentterm?: string | null;
  gcp_typeofcontract?: string | null;
  gcp_formofcontractconditionofcontract?: string | null;
  gcp_projectdirectorpd?: string | null;
  gcp_contactpersonatsitedesignationcontactno?: string | null;

  gcp_claimmanagementclaimapplicationprocess?: string | null;
  gcp_claimmanagementclaimcertificationprocess?: string | null;
  gcp_changemanagementvariationorderapplicationpr?: string | null;

  gcp_changemanagementextensionoftimeapplication?: string | null;
  gcp_commissioningandcompletionmanagementsystems?: string | null;
  gcp_keydeliverymilestone?: string | null;

  gcp_mandatorytestingrequiredtocommission?: string | null;
  gcp_documentrequiredforcontractualacceptanceofpr?: string | null;
  gcp_prerequisitedocumentsforcompletionofdlp?: string | null;

  gcp_acknowledgement?: boolean;

  'gcp_Company@odata.bind'?: string;
  'gcp_Project@odata.bind'?: string;
  'gcp_Request@odata.bind'?: string;
};

type UpdateGcpCaaRequestInput = Partial<CreateGcpCaaRequestInput>;

const mapGcpCaaRequest = (e: GcpCaaRequestEntity): GcpCaaRequest => ({
  id: e.gcp_caarequestid ?? '',
  title: e.gcp_title ?? null,
  projectCode: e.gcp_projectcode ?? null,

  tenderProposalPrice: e.gcp_tenderproposalpriceduringsubmissionoftend ?? null,
  finalContractAmount: e.gcp_finalcontractamount ?? null,
  estimatedBudgetCost: e.gcp_estimatedbudgetcost ?? null,
  estimatedMargin: e.gcp_estimatedmargin ?? null,
  tenderProposalRefNo: e.gcp_tenderproposalrefno ?? null,
  letterOfAwardDate: e.gcp_letterofawardloa ?? null,
  contractCommencementDate: e.gcp_contractcommencement ?? null,
  contractCompletionDate: e.gcp_contractcompletiondate ?? null,
  contractPeriodDays: e.gcp_contractperioddays ?? null,

  performanceBond: e.gcp_performancebondpbforproject ?? null,
  stampDuty: e.gcp_stampdutyinclusiveoflegalcostandfees ?? null,
  insurance: e.gcp_insurance ?? null,
  bumiputeraParticipation: e.gcp_bumiputeraparticipation ?? null,
  formationOfJvCompany: e.gcp_formationofjvcompany ?? null,
  criticalActivitiesMilestones: e.gcp_criticalactivitymilestone ?? null,
  defectLiabilityPeriod: e.gcp_defectliabilityperioddlp ?? null,

  liquidatedDamagesRate: e.gcp_liquidateddamagesladrate ?? null,
  paymentTerm: e.gcp_paymentterm ?? null,
  typeOfContract: e.gcp_typeofcontract ?? null,
  formOfContract: e.gcp_formofcontractconditionofcontract ?? null,
  projectDirector: e.gcp_projectdirectorpd ?? null,
  contactPersonAtSite: e.gcp_contactpersonatsitedesignationcontactno ?? null,

  claimApplicationProcess: e.gcp_claimmanagementclaimapplicationprocess ?? null,
  claimCertificationProcess:
    e.gcp_claimmanagementclaimcertificationprocess ?? null,
  variationOrderApplicationProcess:
    e.gcp_changemanagementvariationorderapplicationpr ?? null,

  extensionOfTimeApplicationProcess:
    e.gcp_changemanagementextensionoftimeapplication ?? null,
  commissioningCompletionSystems:
    e.gcp_commissioningandcompletionmanagementsystems ?? null,
  keyDeliveryMilestone: e.gcp_keydeliverymilestone ?? null,

  mandatoryTesting: e.gcp_mandatorytestingrequiredtocommission ?? null,
  documentForContractualAcceptance:
    e.gcp_documentrequiredforcontractualacceptanceofpr ?? null,
  prerequisiteDocumentsForDlp: e.gcp_prerequisitedocumentsforcompletionofdlp ?? null,

  acknowledged: e.gcp_acknowledgement ?? null,

  companyId: e['_gcp_company_value'] ?? null,
  projectId: e['_gcp_project_value'] ?? null,
  requestId: e['_gcp_request_value'] ?? null,
});

const DEFAULT_CAA_REQUEST_SELECT: readonly string[] = [
  'gcp_caarequestid',
  'gcp_title',
  'gcp_projectcode',
  'gcp_tenderproposalpriceduringsubmissionoftend',
  'gcp_finalcontractamount',
  'gcp_estimatedbudgetcost',
  'gcp_estimatedmargin',
  'gcp_tenderproposalrefno',
  'gcp_letterofawardloa',
  'gcp_contractcommencement',
  'gcp_contractcompletiondate',
  'gcp_contractperioddays',
  'gcp_performancebondpbforproject',
  'gcp_stampdutyinclusiveoflegalcostandfees',
  'gcp_insurance',
  'gcp_bumiputeraparticipation',
  'gcp_formationofjvcompany',
  'gcp_criticalactivitymilestone',
  'gcp_defectliabilityperioddlp',
  'gcp_liquidateddamagesladrate',
  'gcp_paymentterm',
  'gcp_typeofcontract',
  'gcp_formofcontractconditionofcontract',
  'gcp_projectdirectorpd',
  'gcp_contactpersonatsitedesignationcontactno',
  'gcp_claimmanagementclaimapplicationprocess',
  'gcp_claimmanagementclaimcertificationprocess',
  'gcp_changemanagementvariationorderapplicationpr',
  'gcp_changemanagementextensionoftimeapplication',
  'gcp_commissioningandcompletionmanagementsystems',
  'gcp_keydeliverymilestone',
  'gcp_mandatorytestingrequiredtocommission',
  'gcp_documentrequiredforcontractualacceptanceofpr',
  'gcp_prerequisitedocumentsforcompletionofdlp',
  'gcp_acknowledgement',
  '_gcp_company_value',
  '_gcp_project_value',
  '_gcp_request_value',
];

export { mapGcpCaaRequest, DEFAULT_CAA_REQUEST_SELECT };
export type {
  GcpCaaRequest,
  GcpCaaRequestEntity,
  CreateGcpCaaRequestInput,
  UpdateGcpCaaRequestInput,
};
