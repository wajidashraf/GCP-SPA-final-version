import type { RequestCategoryValue } from '../../data/requestChoices';
import type { MatterChoice } from '../../data/matterChoices';

type RpccaFormState = {
  // Step 1 — Basic Information (mostly read-only, same as PCCA first step)
  matterValue: MatterChoice['value'];
  categoryValue: RequestCategoryValue;
  requestorContactId: string;
  requestorName: string;
  requestorEmail: string;
  companyId: string;
  projectId: string;
  projectName: string;
  projectCode: string;

  // Step 2 — Work Item Entry (DynamicWorkItemFiled grid → JSON string)
  workItemEntry: string; // serialized WorkItemRow[]
  remarks: string; // Text

  // Step 3 — Document / Acknowledgement (stored on the parent gcp_request)
  acknowledged: boolean;
};

export type { RpccaFormState };
