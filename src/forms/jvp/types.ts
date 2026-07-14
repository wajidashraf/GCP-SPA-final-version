import type { RequestCategoryValue } from '../../data/requestChoices';
import type { MatterChoice } from '../../data/matterChoices';

type JvpFormState = {
  // Step 1 — Basic Information (mostly read-only, same as RTP/PBL + project)
  matterValue: MatterChoice['value'];
  categoryValue: RequestCategoryValue;
  requestorContactId: string;
  requestorName: string;
  requestorEmail: string;
  companyId: string;
  companyName: string;
  projectId: string;
  projectName: string;
  projectCode: string;

  // Step 2 — PIC (plain text)
  picTeamLeader: string;
  picFinancialMatters: string;
  picTechnicalMatters: string;
  picContractMatters: string;
  picProcurementMatters: string;
  picCostingEstimation: string;
  picImplementationStage: string;

  // Step 3 — JVP Information: Collaboration (RepeatableTextField → JSON string)
  backgroundOfCollaboration: string;
  scopeOfCollaboration: string;
  proposedStructure: string;

  // Step 4 — JVP Information: Key terms & financials
  keyTerms: string; // RepeatableTextField → JSON string
  financialOverview: string; // RepeatableTextField → JSON string
  technicalCapabilitiesResources: string; // RepeatableTextField → JSON string
  // gcp_cashflowforecastimage — display-only FileUpload, NOT persisted (see api.ts)

  // Step 5 — JVP Information: Work packages, resourcing & risk
  workPackagesDivisionOfResponsibilities: string; // RepeatableTextField → JSON string
  resourceContribution: string; // RepeatableTextField → JSON string
  // gcp_cost_structure_breakdown — display-only FileUpload, NOT persisted (see api.ts)
  riskReviewMitigation: string; // DynamicTableSection → JSON string

  // Step 6 — Acknowledgement (stored on parent gcp_request)
  acknowledged: boolean;
};

export type { JvpFormState };
