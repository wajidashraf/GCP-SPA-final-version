// src/forms/pp/api.ts
// PP (Procurement Plan) submission flow:
//   1. POST /_api/gcp_requests    — parent request row, bound to the selected
//      Project (gcp_Project) and Company (gcp_Company). Project name/code and the
//      acknowledgement live here.
//   2. POST /_api/gcp_pprequests  — PP details, bound to (1) via
//      `gcp_Request@odata.bind` plus the Project and Company lookups. Carries the
//      acknowledgement bit (required on this table).

import {
  createRequest,
  updateRequest,
} from '../../shared/services/requestService';
import {
  createPpRequest,
  updatePpRequest,
} from '../../shared/services/ppRequestService';
import { serializeDocuments } from '../../shared/documents';
import type { DocumentLink } from '../../shared/documents';
import type { CreateGcpRequestInput, GcpRequest } from '../../types/request';
import type {
  CreateGcpPpRequestInput,
  GcpPpRequest,
} from '../../types/ppRequest';
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

// ── Edit mode ────────────────────────────────────────────────────────────────
// Reverse of the create mapping above: hydrate the form state from a loaded
// parent gcp_request + gcp_pprequest child, then PATCH the editable fields back.
// Requestor/Company lookups are never rebound and gcp_requestoremail is never
// PATCHed — the original requestor's identity must survive edits by
// Reviewers/Verifiers. The Project lookup IS rebound (the Project select stays
// editable in edit mode).

/** Build PP form state from the loaded parent + child records (edit prefill). */
const loadPpFormState = (
  request: GcpRequest,
  pp: GcpPpRequest
): PpFormState => ({
  matterValue: request.matter as PpFormState['matterValue'],
  categoryValue: (request.category ?? 2) as PpFormState['categoryValue'],
  // Mirror new mode: the requestor select's value is the email, the label the name.
  requestorContactId: request.requestorEmail ?? '',
  requestorName: request.requestorName ?? '',
  requestorEmail: request.requestorEmail ?? '',
  companyId: request.companyId ?? '',
  companyName: request.companyName ?? '',
  projectId: pp.projectId ?? '',
  projectName: request.projectName ?? pp.name ?? '',
  projectCode: request.projectCode ?? pp.projectCode ?? '',
  acknowledged: request.acknowledged ?? pp.acknowledged ?? false,
});

type UpdatePpIds = {
  /** Parent gcp_request GUID. */
  requestId: string;
  /** Child gcp_pprequest GUID. */
  ppRecordId: string;
  /**
   * Final document set to persist on gcp_request.gcp_documentsurl (kept existing
   * links + new uploads). When omitted, the column is left untouched.
   */
  documents?: DocumentLink[];
};

/**
 * Save edits: PATCH the editable fields on the parent request and the PP child.
 * Does NOT change gcp_requeststatus (stays RS / Resubmit) and never touches the
 * Requestor/Company lookups or gcp_requestoremail.
 */
const updatePpRequestFromState = async (
  state: PpFormState,
  ids: UpdatePpIds
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

  // Child gcp_pprequest — same editable column set as the create mapping.
  await updatePpRequest(
    ids.ppRecordId,
    {
      gcp_pprequestname: state.projectName || null,
      gcp_projectcode: orNull(state.projectCode),
      gcp_acknowledgement: state.acknowledged,
    },
    { lookups: { projectId } }
  );
};

export { submitPpRequest, loadPpFormState, updatePpRequestFromState };
export type { SubmitResult, SubmitPpOptions, UpdatePpIds };
