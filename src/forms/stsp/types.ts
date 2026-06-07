import type { RequestCategoryValue } from '../../data/requestChoices';
import type { MatterChoice } from '../../data/matterChoices';

type StspFormState = {
  // Step 1 — Basic Information (read-only, same as RTP first step)
  matterValue: MatterChoice['value'];
  categoryValue: RequestCategoryValue;
  requestorContactId: string;
  requestorName: string;
  requestorEmail: string;
  companyId: string;

  // Step 2 — Project details
  projectId: string; // → parent gcp_request (lookup) + ST/SP gcp_Project lookup
  projectName: string; // → parent gcp_request.gcp_project_name
  projectCode: string; // read-only, auto-filled from selected project
  tenderProposalSubmissionDate: string; // → gcp_stsprequests.gcp_tenderproposalsubmissiondate (DateTime)
  tenderValidityPeriod: string; // → gcp_stsprequests.gcp_tendervalidityperiod (Text)

  // Step 3 — PIC (plain text → gcp_stsprequests)
  picTeamLeader: string;
  picFinancialMatters: string;
  picTechnicalMatters: string;
  picContractMatters: string;
  picProcurementMatters: string;
  picCostingAndEstimationMatters: string;
  picImplementationStage: string;

  // Step 4 — ST/SP Information
  backgroundReview: string; // TextAreaField → gcp_backgroundreview
  scopeOfWorks: string; // TextAreaField → gcp_scopeofworks
  keyTerms: string; // TextAreaField → gcp_keyterms
  financials: string; // RepeatableTextField → JSON string → gcp_financials
  // gcp_resourcescontribution ("Contract Structure Image") — display-only
  // FileUpload, NOT persisted (File objects can't serialize; see api.ts).

  // Step 5 — ST/SP Information
  technical: string; // TextAreaField → gcp_technical
  procurementStrategyWorkPackages: string; // TextAreaField → gcp_procurementstrategyworkpackages
  sourcingReference: string; // TextAreaField → gcp_sourcingreference
  costBreakdown: string; // TextAreaField → gcp_costbreakdown
  riskIdentificationMitigationPlan: string; // DynamicTableSection → JSON string → gcp_riskidentificationmitigationplan

  // Step 6 — Acknowledgement (stored on parent gcp_request)
  acknowledged: boolean;
};

export type { StspFormState };
