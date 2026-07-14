// src/forms/rpcca/api.ts
// Revised PCCA (R-PCCA) submission flow:
//   1. POST /_api/gcp_requests          — parent request row, bound to the
//      selected Project (gcp_Project), Company (gcp_Company) and requestor
//      Contact (gcp_RequestorName). The acknowledgement lives here.
//   2. POST /_api/gcp_rpccarequestgcps  — Revised PCCA details, bound to (1) via
//      `gcp_Request@odata.bind`.
//
// The Work Item Entry grid (DynamicWorkItemFiled) is already a JSON string in
// form state, so it persists as-is into the multiline-text column
// gcp_workitementry.

import {
  createRequest,
  updateRequest,
} from '../../shared/services/requestService';
import {
  createRpccaRequest,
  updateRpccaRequest,
} from '../../shared/services/rpccaRequestService';
import { serializeDocuments } from '../../shared/documents';
import type { DocumentLink } from '../../shared/documents';
import type { CreateGcpRequestInput, GcpRequest } from '../../types/request';
import type {
  CreateGcpRpccaRequestInput,
  GcpRpccaRequest,
} from '../../types/rpccaRequest';
import type { SoaCodeValue } from '../../data/soaChoices';
import type { RpccaFormState } from './types';

type SubmitResult = {
  requestId: string;
  rpccaRequestId: string;
};

// SOA code "Revised PCCA" maps to value 10 in soaCodeChoices.
const resolveSoaCodeForRpcca = (): SoaCodeValue => 10;

/** Collapse empty/whitespace text to null so we don't store blank strings. */
const orNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

type SubmitRpccaOptions = {
  /** Logged-in user's contact GUID for the gcp_RequestorName lookup. The form's
   *  `requestorContactId` field holds an email (used only for the UI select), so
   *  the real contact GUID must be passed here — otherwise the contact lookup is
   *  skipped and the Contact-scoped table permission denies later associations. */
  requestorContactId?: string | null;
  /** Uploaded document links to persist on the request's gcp_documentsurl. */
  documents?: DocumentLink[];
};

const submitRpccaRequest = async (
  data: RpccaFormState,
  options: SubmitRpccaOptions = {}
): Promise<SubmitResult> => {
  const companyAccountId = data.companyId || null;
  const projectId = data.projectId || null;

  // Step 1 — parent gcp_request
  const parentInput: CreateGcpRequestInput = {
    gcp_category: data.categoryValue,
    gcp_mattertype: data.matterValue,
    gcp_soacode: resolveSoaCodeForRpcca(),
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

  // Step 2 — gcp_rpccarequestgcp bound to the parent. The Work Item Entry grid is
  // already a JSON string in form state, so it persists as-is.
  // (This table has no gcp_soacode column — SOA code lives on gcp_request.)
  const rpccaInput: CreateGcpRpccaRequestInput = {
    gcp_rpccarequestname: data.projectName || null,

    // Step 2 — Work Item Entry (JSON) + remarks
    gcp_workitementry: orNull(data.workItemEntry),
    gcp_remarks: orNull(data.remarks),
  };

  const rpccaCreated = await createRpccaRequest(rpccaInput, {
    lookups: {
      requestId: created.id,
    },
  });

  return {
    requestId: created.id,
    rpccaRequestId: rpccaCreated.id,
  };
};

// ── Edit mode ────────────────────────────────────────────────────────────────
// Reverse of the create mapping above: hydrate the form state from a loaded
// parent gcp_request + gcp_rpccarequestgcp child, then PATCH the editable fields
// back. Requestor/Company lookups are never rebound and gcp_requestoremail is
// never PATCHed — the original requestor's identity must survive edits by
// Reviewers/Verifiers. The Project lookup IS rebound on the parent (the Project
// select stays editable in edit mode); the child has no project/company lookup.
// The Work Item Entry grid is a JSON string that seeds DynamicWorkItemFiled's
// initialRows and persists as-is.

/** Build R-PCCA form state from the loaded parent + child records (edit prefill). */
const loadRpccaFormState = (
  request: GcpRequest,
  rpcca: GcpRpccaRequest
): RpccaFormState => ({
  matterValue: request.matter as RpccaFormState['matterValue'],
  categoryValue: (request.category ?? 2) as RpccaFormState['categoryValue'],
  // Mirror new mode: the requestor select's value is the email, the label the name.
  requestorContactId: request.requestorEmail ?? '',
  requestorName: request.requestorName ?? '',
  requestorEmail: request.requestorEmail ?? '',
  companyId: request.companyId ?? '',
  companyName: request.companyName ?? '',
  projectId: request.projectId ?? '',
  projectName: request.projectName ?? rpcca.name ?? '',
  projectCode: request.projectCode ?? '',

  // JSON string — seeds DynamicWorkItemFiled via parseWorkItems in the form.
  workItemEntry: rpcca.workItemEntry ?? '',
  remarks: rpcca.remarks ?? '',

  acknowledged: request.acknowledged ?? false,
});

type UpdateRpccaIds = {
  /** Parent gcp_request GUID. */
  requestId: string;
  /** Child gcp_rpccarequestgcp GUID. */
  rpccaRecordId: string;
  /**
   * Final document set to persist on gcp_request.gcp_documentsurl (kept existing
   * links + new uploads). When omitted, the column is left untouched.
   */
  documents?: DocumentLink[];
};

/**
 * Save edits: PATCH the editable fields on the parent request and the R-PCCA
 * child. Does NOT change gcp_requeststatus (stays RS / Resubmit) and never
 * touches the Requestor/Company lookups or gcp_requestoremail.
 */
const updateRpccaRequestFromState = async (
  state: RpccaFormState,
  ids: UpdateRpccaIds
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

  // Child gcp_rpccarequestgcp — same editable column set as the create mapping.
  // (This child has no project/company lookup, so none is rebound.)
  await updateRpccaRequest(ids.rpccaRecordId, {
    gcp_rpccarequestname: state.projectName || null,
    gcp_workitementry: orNull(state.workItemEntry),
    gcp_remarks: orNull(state.remarks),
  });
};

export { submitRpccaRequest, loadRpccaFormState, updateRpccaRequestFromState };
export type { SubmitResult, SubmitRpccaOptions, UpdateRpccaIds };
