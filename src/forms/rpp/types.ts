import type { RequestCategoryValue } from '../../data/requestChoices';
import type { MatterChoice } from '../../data/matterChoices';

type RppFormState = {
  // Step 1 — Basic Information (read-only, same as PP first step)
  matterValue: MatterChoice['value'];
  categoryValue: RequestCategoryValue;
  requestorContactId: string;
  requestorName: string;
  requestorEmail: string;
  companyId: string;
  companyName: string;

  // Step 2 — Project Details (persisted on the parent gcp_request)
  projectId: string;
  projectName: string;
  projectCode: string;

  // Step 3 — Document / Acknowledgement (stored on parent gcp_request + child)
  acknowledged: boolean;
};

export type { RppFormState };
