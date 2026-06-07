import type {
  ProcurementMethodValue,
  RequestCategoryValue,
} from '../../data/requestChoices';
import type { SectorValue } from '../../data/projectChoices';
import type { MatterChoice } from '../../data/matterChoices';

type PblBidderDraft = {
  /** Account GUID when a company is picked from the dropdown; '' when "Other" or not picked. */
  companyAccountId: string;
  /** Free-text company name. Used as the primary name + gcp_company column. */
  companyName: string;
  /** True when user picked the "Other" option and is typing the company name. */
  isOtherCompany: boolean;
  sector: SectorValue | '';
  location: string;
  personInCharge: string;
  picContactNumber: string;
  sourcesFrom: string;
  recommendationBy: string;
};

type PblFormState = {
  // Step 1 — same as RTP (mostly read-only)
  matterValue: MatterChoice['value'];
  categoryValue: RequestCategoryValue;
  requestorContactId: string;
  requestorName: string;
  requestorEmail: string;
  companyId: string;

  // Step 2 — Project Details
  projectId: string;
  projectName: string;
  projectCode: string;
  procurementMethod: ProcurementMethodValue | '';

  // Step 3 — Bidders
  bidders: PblBidderDraft[];
  justificationForLessBidders: string;

  // Step 4 — Document / Confirm
  acknowledged: boolean;
};

const emptyBidderDraft = (): PblBidderDraft => ({
  companyAccountId: '',
  companyName: '',
  isOtherCompany: false,
  sector: '',
  location: '',
  personInCharge: '',
  picContactNumber: '',
  sourcesFrom: '',
  recommendationBy: '',
});

export type { PblFormState, PblBidderDraft };
export { emptyBidderDraft };
