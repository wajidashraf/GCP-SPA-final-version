// src/forms/rpp/api.ts
// RPP (Revised Procurement Plan) submission flow:
//   1. POST /_api/gcp_requests     — parent request row, bound to the selected
//      Project (gcp_Project) and Company (gcp_Company). Project name/code and the
//      acknowledgement live here.
//   2. POST /_api/gcp_rpprequests  — RPP details, bound to (1) via
//      `gcp_Request@odata.bind` plus the Project and Company lookups. Carries the
//      acknowledgement bit and name.

import { createRequest } from '../../shared/services/requestService';
import { createRppRequest } from '../../shared/services/rppRequestService';
import { serializeDocuments } from '../../shared/documents';
import type { DocumentLink } from '../../shared/documents';
import type { CreateGcpRequestInput } from '../../types/request';
import type { CreateGcpRppRequestInput } from '../../types/rppRequest';
import type { SoaCodeValue } from '../../data/soaChoices';
import type { RppFormState } from './types';

type SubmitResult = {
  requestId: string;
  rppRequestId: string;
};

// SOA code "Revised PP" maps to value 14 in soaCodeChoices.
const resolveSoaCodeForRpp = (): SoaCodeValue => 14;

/** Collapse empty/whitespace text to null so we don't store blank strings. */
const orNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

type SubmitRppOptions = {
  /** Logged-in user's contact GUID for the gcp_RequestorName lookup. The form's
   *  `requestorContactId` field holds an email (used only for the UI select), so
   *  the real contact GUID must be passed here — otherwise the contact lookup is
   *  skipped and the Contact-scoped table permission denies later associations. */
  requestorContactId?: string | null;
  /** Uploaded document links to persist on the request's gcp_documentsurl. */
  documents?: DocumentLink[];
};

const submitRppRequest = async (
  data: RppFormState,
  options: SubmitRppOptions = {}
): Promise<SubmitResult> => {
  const companyAccountId = data.companyId || null;
  const projectId = data.projectId || null;

  // Step 1 + 2 — parent gcp_request (project details persist here)
  const parentInput: CreateGcpRequestInput = {
    gcp_category: data.categoryValue,
    gcp_mattertype: data.matterValue,
    gcp_soacode: resolveSoaCodeForRpp(),
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

  // Step 3 — gcp_rpprequest bound to the parent.
  // (This table has no gcp_soacode column — SOA code lives on gcp_request.)
  const rppInput: CreateGcpRppRequestInput = {
    gcp_name: data.projectName || null,
    gcp_projectcode: orNull(data.projectCode),
    gcp_acknowledgement: data.acknowledged,
  };

  const rppCreated = await createRppRequest(rppInput, {
    lookups: {
      requestId: created.id,
      projectId,
      companyAccountId,
    },
  });

  return {
    requestId: created.id,
    rppRequestId: rppCreated.id,
  };
};

export { submitRppRequest };
export type { SubmitResult, SubmitRppOptions };
