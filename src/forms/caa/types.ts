import type { RequestCategoryValue } from '../../data/requestChoices';
import type { MatterChoice } from '../../data/matterChoices';

type CaaFormState = {
  // Step 1 — Basic Information (mostly read-only, same as JVP + project)
  matterValue: MatterChoice['value'];
  categoryValue: RequestCategoryValue;
  requestorContactId: string;
  requestorName: string;
  requestorEmail: string;
  companyId: string;
  projectId: string;
  projectName: string;
  projectCode: string;

  // Step 2 — Cost Information (numbers kept as strings; parsed in api.ts)
  tenderProposalPrice: string; // Currency
  finalContractAmount: string; // Currency
  estimatedBudgetCost: string; // Currency
  estimatedMargin: string; // Decimal
  tenderProposalRefNo: string; // Text
  letterOfAwardDate: string; // Date
  contractCommencementDate: string; // Date
  contractCompletionDate: string; // Date
  contractPeriodDays: string; // Whole Number

  // Step 3 — CAA Information
  performanceBond: string; // Text
  stampDuty: string; // Whole Number
  insurance: string; // Text
  bumiputeraParticipation: string; // Text
  formationOfJvCompany: string; // Text
  criticalActivitiesMilestones: string; // Text
  defectLiabilityPeriod: string; // Text
  // gcp_projectorganisationandmanpowerchart_image — display-only FileUpload, NOT persisted

  // Step 4 — CAA Information
  liquidatedDamagesRate: string; // Whole Number
  paymentTerm: string; // Text
  typeOfContract: string; // Text
  formOfContract: string; // Text
  projectDirector: string; // Text
  contactPersonAtSite: string; // Text

  // Step 5 — CAA Information (DynamicRowFields → JSON string)
  claimApplicationProcess: string;
  claimCertificationProcess: string;
  variationOrderApplicationProcess: string;

  // Step 6 — CAA Information (DynamicRowFields → JSON string)
  extensionOfTimeApplicationProcess: string;
  commissioningCompletionSystems: string;
  keyDeliveryMilestone: string;

  // Step 7 — CAA Information (DynamicRowFields → JSON string)
  mandatoryTesting: string;
  documentForContractualAcceptance: string;
  prerequisiteDocumentsForDlp: string;

  // Step 8 — Acknowledgement (stored on parent gcp_request + child)
  acknowledged: boolean;
};

export type { CaaFormState };
