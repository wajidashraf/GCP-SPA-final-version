// src/forms/vap/api.ts
// VAP (Vendor Appointment and Procurement) submission flow:
//   1. POST /_api/gcp_requests     — parent request row, bound to the selected
//      Project (gcp_Project) and Company (gcp_Company). Project name/code and the
//      acknowledgement live here.
//   2. POST /_api/gcp_vaprequests  — VAP details, bound to (1) via
//      `gcp_Request@odata.bind` plus the Project and Company lookups. Carries the
//      acknowledgement bit (required on this table) and name.

import { createRequest } from '../../shared/services/requestService';
import { createVapRequest } from '../../shared/services/vapRequestService';
import { serializeDocuments } from '../../shared/documents';
import type { DocumentLink } from '../../shared/documents';
import type { CreateGcpRequestInput } from '../../types/request';
import type { CreateGcpVapRequestInput } from '../../types/vapRequest';
import type { SoaCodeValue } from '../../data/soaChoices';
import type { VapFormState } from './types';

type SubmitResult = {
  requestId: string;
  vapRequestId: string;
};

// SOA code "VAP" maps to value 8 in soaCodeChoices.
const resolveSoaCodeForVap = (): SoaCodeValue => 8;

/** Collapse empty/whitespace text to null so we don't store blank strings. */
const orNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

type SubmitVapOptions = {
  /** Logged-in user's contact GUID for the gcp_RequestorName lookup. The form's
   *  `requestorContactId` field holds an email (used only for the UI select), so
   *  the real contact GUID must be passed here — otherwise the contact lookup is
   *  skipped and the Contact-scoped table permission denies later associations. */
  requestorContactId?: string | null;
  /** Uploaded document links to persist on the request's gcp_documentsurl. */
  documents?: DocumentLink[];
};

const submitVapRequest = async (
  data: VapFormState,
  options: SubmitVapOptions = {}
): Promise<SubmitResult> => {
  const companyAccountId = data.companyId || null;
  const projectId = data.projectId || null;

  // Step 1 + 2 — parent gcp_request (project details persist here)
  const parentInput: CreateGcpRequestInput = {
    gcp_category: data.categoryValue,
    gcp_mattertype: data.matterValue,
    gcp_soacode: resolveSoaCodeForVap(),
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

  // Step 3 — gcp_vaprequest bound to the parent.
  // (This table has no gcp_soacode column — SOA code lives on gcp_request.)
  const vapInput: CreateGcpVapRequestInput = {
    gcp_vaprequestname: data.projectName || null,
    gcp_projectcode: orNull(data.projectCode),
    gcp_acknowledgement: data.acknowledged,
  };

  const vapCreated = await createVapRequest(vapInput, {
    lookups: {
      requestId: created.id,
      projectId,
      companyAccountId,
    },
  });

  return {
    requestId: created.id,
    vapRequestId: vapCreated.id,
  };
};

export { submitVapRequest };
export type { SubmitResult, SubmitVapOptions };
