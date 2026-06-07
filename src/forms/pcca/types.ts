import type { RequestCategoryValue } from '../../data/requestChoices';
import type { MatterChoice } from '../../data/matterChoices';

type PccaFormState = {
  // Step 1 — Basic Information (mostly read-only, same as RTP + project, like CAA)
  matterValue: MatterChoice['value'];
  categoryValue: RequestCategoryValue;
  requestorContactId: string;
  requestorName: string;
  requestorEmail: string;
  companyId: string;
  projectId: string;
  projectName: string;
  projectCode: string;

  // Step 2 — Cost Information (DynamicRowFields → JSON strings)
  priceRevenueFromContractBq: string; // rows of { workDescription, priceRevenue }
  costFromContractBq: string; // rows of { workDescription, cost }

  // Step 3 — Cost Summary (numbers kept as strings; parsed in api.ts)
  totalRevenue: string; // Whole Number — auto-summed from step 2, read-only
  totalCost: string; // Whole Number — auto-summed from step 2, read-only
  constructionCost: string; // Whole Number
  internalCost: string; // Whole Number
  remarks: string; // Text

  // Step 4 — Document / Acknowledgement (stored on parent gcp_request + child)
  acknowledged: boolean;
};

export type { PccaFormState };
