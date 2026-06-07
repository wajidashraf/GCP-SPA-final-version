import type { RequestCategoryValue } from '../../data/requestChoices';
import type { MatterChoice } from '../../data/matterChoices';
import type { CprApplicationStatusValue } from '../../data/cprChoices';

type CprFormState = {
  // Step 1 — Basic Information (read-only header + project; persisted on parent)
  matterValue: MatterChoice['value'];
  categoryValue: RequestCategoryValue;
  requestorContactId: string;
  requestorName: string;
  requestorEmail: string;
  companyId: string;
  projectId: string;
  projectName: string;
  projectCode: string;

  // Step 2 — EOT Information (numbers/dates kept as strings; parsed in api.ts)
  eotLatestNo: string; // Text
  eotLatestDate: string; // Date
  eotNewApplicationDate: string; // Date
  eotNewCompletionDate: string; // Date
  eotStatus: CprApplicationStatusValue; // Choice (default 1 = Active)
  eotNewJustifications: string; // Multiline Text

  // Step 3 — VO Information
  voLatestNo: string; // Text
  voLatestApprovedCumulativeAmount: string; // Whole Number
  voNewApplicationAmount: string; // Whole Number
  voNewApplicationNo: string; // Text
  voNewApplicationDate: string; // Date
  voStatus: CprApplicationStatusValue; // Choice (default 2 = Inactive)
  voNewJustification: string; // Text

  // Step 4 — Claims to Client
  cumulativeClaimApplicationAmount: string; // Whole Number
  cumulativeClaimCertifiedAmount: string; // Whole Number
  pendingCertifiedAmount: string; // Whole Number
  noOfClaimsForPendingCertified: string; // Whole Number
  newNetCertifiedAmount: string; // Whole Number
  dateOfClaimPendingCertified: string; // Date

  // Step 5 — Document / Acknowledgement (stored on parent + child)
  acknowledged: boolean;
};

export type { CprFormState };
