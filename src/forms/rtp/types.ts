import type {
  RegistrationTypeValue,
  RequestCategoryValue,
} from '../../data/requestChoices';
import type { MatterChoice } from '../../data/matterChoices';

type RtpFormState = {
  // Step 1 — auto-selected, read-only
  matterValue: MatterChoice['value'];
  categoryValue: RequestCategoryValue;
  requestorContactId: string;
  requestorName: string;
  requestorEmail: string;
  companyId: string;

  // Step 2
  clientName: string;
  registrationType: RegistrationTypeValue | '';
  tenderClosingDate: string; // yyyy-mm-dd from <input type="date">
  projectName: string;
  projectDescription: string;

  // Step 3
  acknowledged: boolean;
  specialProjectFlag: boolean;
};

export type { RtpFormState };
