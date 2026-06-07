import type { RequestCategoryValue } from '../../data/requestChoices';
import type { MatterChoice } from '../../data/matterChoices';
import type { CompanyRoleInIssueValue } from '../../data/companyChoices';

type CiFormState = {
  // Step 1 — Basic Information (read-only, same as PP first step; persists on parent)
  matterValue: MatterChoice['value'];
  categoryValue: RequestCategoryValue;
  requestorContactId: string;
  requestorName: string;
  requestorEmail: string;
  companyId: string;

  // Step 2 — Project Details (project/company persist on parent; company role on child)
  projectId: string;
  projectName: string;
  projectCode: string;
  companyRole: CompanyRoleInIssueValue | ''; // gcp_companyroleinthisissue (child)

  // Step 3 — VO / EOT / L&E Information (child)
  category: string; // gcp_category (text dropdown)
  chronologyOfEventVo: string;
  briefOfIssuesVo: string;
  timeAndCostImpactVo: string;
  contractClause: string;
  advisoryRequiredVo: string;

  // Step 4 — Payments Information (child)
  briefOfIssuesPayments: string;
  chronologyOfEventPayments: string;
  contractClausePayment: string;
  advisoryRequiredPayments: string;

  // Step 5 — Document / Acknowledgement (stored on parent + child)
  acknowledged: boolean;
};

export type { CiFormState };
