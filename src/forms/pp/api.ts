// src/forms/pp/api.ts
// PP (Procurement Plan) submission flow:
//   1. POST /_api/gcp_requests    — parent request row, bound to the selected
//      Project (gcp_Project) and Company (gcp_Company). Project name/code and the
//      acknowledgement live here.
//   2. POST /_api/gcp_pprequests  — PP details, bound to (1) via
//      `gcp_Request@odata.bind` plus the Project and Company lookups. Carries the
//      acknowledgement bit (required on this table).

import { createRequest } from '../../shared/services/requestService';
import { createPpRequest } from '../../shared/services/ppRequestService';
import { serializeDocuments } from '../../shared/documents';
import type { DocumentLink } from '../../shared/documents';
import type { CreateGcpRequestInput } from '../../types/request';
import type { CreateGcpPpRequestInput } from '../../types/ppRequest';
import type { SoaCodeValue } from '../../data/soaChoices';
import type { PpFormState } from './types';

type SubmitResult = {
  requestId: string;
  ppRequestId: string;
};

// SOA code "PP" maps to value 7 in soaCodeChoices.
const resolveSoaCodeForPp = (): SoaCodeValue => 7;

/** Collapse empty/whitespace text to null so we don't store blank strings. */
const orNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

type SubmitPpOptions = {
  /** Logged-in user's contact GUID for the gcp_RequestorName lookup. The form's
   *  `requestorContactId` field holds an email (used only for the UI select), so
   *  the real contact GUID must be passed here — otherwise the contact lookup is
   *  skipped and the Contact-scoped table permission denies later associations. */
  requestorContactId?: string | null;
  /** Uploaded document links to persist on the request's gcp_documentsurl. */
  documents?: DocumentLink[];
};

const submitPpRequest = async (
  data: PpFormState,
  options: SubmitPpOptions = {}
): Promise<SubmitResult> => {
  const companyAccountId = data.companyId || null;
  const projectId = data.projectId || null;

  // Step 1 + 2 — parent gcp_request (project details persist here)
  const parentInput: CreateGcpRequestInput = {
    gcp_category: data.categoryValue,
    gcp_mattertype: data.matterValue,
    gcp_soacode: resolveSoaCodeForPp(),
    gcp_requestoremail: data.requestorEmail || null,
    gcp_project_name: data.projectName || null,
    gcp_projectcode: orNull(data.projectCode),
    gcp_acknowledgement: data.acknowledged,
    gcp_submittedon: new Date().toISOString(),
    gcp_requeststatus: 1,
    gcp_documentsurl: serializeDocuments(options.documents ?? []),
  };

  const created = await createRequest(parentInput, {
    lookups: {
      requestorContactId: options.requestorContactId || null,
      companyAccountId,
      projectId,
    },
  });

  // Step 3 — gcp_pprequest bound to the parent.
  // (This table has no gcp_soacode column — SOA code lives on gcp_request.)
  const ppInput: CreateGcpPpRequestInput = {
    gcp_pprequestname: data.projectName || null,
    gcp_projectcode: orNull(data.projectCode),
    gcp_acknowledgement: data.acknowledged,
  };

  const ppCreated = await createPpRequest(ppInput, {
    lookups: {
      requestId: created.id,
      projectId,
      companyAccountId,
    },
  });

  return {
    requestId: created.id,
    ppRequestId: ppCreated.id,
  };
};

export { submitPpRequest };
export type { SubmitResult, SubmitPpOptions };
