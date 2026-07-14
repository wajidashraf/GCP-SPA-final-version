// src/forms/vap/api.ts
// VAP (Vendor Appointment and Procurement) submission flow:
//   1. POST /_api/gcp_requests     — parent request row, bound to the selected
//      Project (gcp_Project) and Company (gcp_Company). Project name/code and the
//      acknowledgement live here.
//   2. POST /_api/gcp_vaprequests  — VAP details, bound to (1) via
//      `gcp_Request@odata.bind` plus the Project and Company lookups. Carries the
//      acknowledgement bit (required on this table) and name.

import {
  createRequest,
  updateRequest,
} from '../../shared/services/requestService';
import {
  createVapRequest,
  updateVapRequest,
} from '../../shared/services/vapRequestService';
import { serializeDocuments } from '../../shared/documents';
import type { DocumentLink } from '../../shared/documents';
import type { CreateGcpRequestInput, GcpRequest } from '../../types/request';
import type {
  CreateGcpVapRequestInput,
  GcpVapRequest,
} from '../../types/vapRequest';
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

// ── Edit mode ────────────────────────────────────────────────────────────────
// Reverse of the create mapping above: hydrate the form state from a loaded
// parent gcp_request + gcp_vaprequest child, then PATCH the editable fields
// back. Requestor/Company lookups are never rebound and gcp_requestoremail is
// never PATCHed — the original requestor's identity must survive edits by
// Reviewers/Verifiers. The Project lookup IS rebound (the Project select stays
// editable in edit mode).

/** Build VAP form state from the loaded parent + child records (edit prefill). */
const loadVapFormState = (
  request: GcpRequest,
  vap: GcpVapRequest
): VapFormState => ({
  matterValue: request.matter as VapFormState['matterValue'],
  categoryValue: (request.category ?? 2) as VapFormState['categoryValue'],
  // Mirror new mode: the requestor select's value is the email, the label the name.
  requestorContactId: request.requestorEmail ?? '',
  requestorName: request.requestorName ?? '',
  requestorEmail: request.requestorEmail ?? '',
  companyId: request.companyId ?? '',
  companyName: request.companyName ?? '',
  projectId: vap.projectId ?? '',
  projectName: request.projectName ?? vap.name ?? '',
  projectCode: request.projectCode ?? vap.projectCode ?? '',
  acknowledged: request.acknowledged ?? vap.acknowledged ?? false,
});

type UpdateVapIds = {
  /** Parent gcp_request GUID. */
  requestId: string;
  /** Child gcp_vaprequest GUID. */
  vapRecordId: string;
  /**
   * Final document set to persist on gcp_request.gcp_documentsurl (kept existing
   * links + new uploads). When omitted, the column is left untouched.
   */
  documents?: DocumentLink[];
};

/**
 * Save edits: PATCH the editable fields on the parent request and the VAP child.
 * Does NOT change gcp_requeststatus (stays RS / Resubmit) and never touches the
 * Requestor/Company lookups or gcp_requestoremail.
 */
const updateVapRequestFromState = async (
  state: VapFormState,
  ids: UpdateVapIds
): Promise<void> => {
  const projectId = state.projectId || null;

  // Parent gcp_request — project fields + acknowledgement (+ documents).
  await updateRequest(
    ids.requestId,
    {
      gcp_project_name: state.projectName || null,
      gcp_projectcode: orNull(state.projectCode),
      gcp_acknowledgement: state.acknowledged,
      ...(ids.documents
        ? { gcp_documentsurl: serializeDocuments(ids.documents) }
        : {}),
    },
    { lookups: { projectId } }
  );

  // Child gcp_vaprequest — same editable column set as the create mapping.
  await updateVapRequest(
    ids.vapRecordId,
    {
      gcp_vaprequestname: state.projectName || null,
      gcp_projectcode: orNull(state.projectCode),
      gcp_acknowledgement: state.acknowledged,
    },
    { lookups: { projectId } }
  );
};

export { submitVapRequest, loadVapFormState, updateVapRequestFromState };
export type { SubmitResult, SubmitVapOptions, UpdateVapIds };
