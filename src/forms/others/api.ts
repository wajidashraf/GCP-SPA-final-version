// src/forms/others/api.ts
// "Others" submission flow (shared by GCPC matter 9 and GCP matter 13):
//   1. POST /_api/gcp_requests          — parent request row, bound to the
//      selected Project (gcp_Project) and Company (gcp_Company). Project
//      name/code and the acknowledgement live here.
//   2. POST /_api/gcp_otherrequestses   — Other-request details, bound to (1)
//      via `gcp_Requestlookup@odata.bind` plus the Project and Company lookups.
//      Carries the description of matters + acknowledgement bit + name.

import {
  createRequest,
  updateRequest,
} from '../../shared/services/requestService';
import {
  createOtherRequest,
  updateOtherRequest,
} from '../../shared/services/otherRequestService';
import { serializeDocuments } from '../../shared/documents';
import type { DocumentLink } from '../../shared/documents';
import type { CreateGcpRequestInput, GcpRequest } from '../../types/request';
import type {
  CreateGcpOtherRequestInput,
  GcpOtherRequest,
} from '../../types/otherRequest';
import type { SoaCodeValue } from '../../data/soaChoices';
import type { OthersFormState } from './types';

type SubmitResult = {
  requestId: string;
  otherRequestId: string;
};

// SOA code differs by channel: GCP "GCP - Others Form" = 13 (matter 13),
// GCPC "GCPC - Others Form" = 9 (matter 9). The matter value maps 1:1 to its SOA.
const resolveSoaCodeForOthers = (matterValue: number): SoaCodeValue =>
  matterValue === 13 ? 13 : 9;

/** Collapse empty/whitespace text to null so we don't store blank strings. */
const orNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

type SubmitOthersOptions = {
  /** Logged-in user's contact GUID for the gcp_RequestorName lookup. The form's
   *  `requestorContactId` field holds an email (used only for the UI select), so
   *  the real contact GUID must be passed here — otherwise the contact lookup is
   *  skipped and the Contact-scoped table permission denies later associations. */
  requestorContactId?: string | null;
  /** Uploaded document links to persist on the request's gcp_documentsurl. */
  documents?: DocumentLink[];
};

const submitOtherRequest = async (
  data: OthersFormState,
  options: SubmitOthersOptions = {}
): Promise<SubmitResult> => {
  const companyAccountId = data.companyId || null;
  const projectId = data.projectId || null;

  // Step 1 + 2 — parent gcp_request (project details persist here)
  const parentInput: CreateGcpRequestInput = {
    gcp_category: data.categoryValue,
    gcp_mattertype: data.matterValue,
    gcp_soacode: resolveSoaCodeForOthers(data.matterValue),
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

  // Step 3 — gcp_otherrequests bound to the parent via gcp_Requestlookup.
  // (This table has no gcp_soacode column — SOA code lives on gcp_request.)
  const otherInput: CreateGcpOtherRequestInput = {
    gcp_requestname: data.projectName || null,
    gcp_descriptionofmatters: orNull(data.descriptionOfMatters),
    gcp_projectcode: orNull(data.projectCode),
    gcp_acknowledgement: data.acknowledged,
  };

  const otherCreated = await createOtherRequest(otherInput, {
    lookups: {
      requestId: created.id,
      projectId,
      companyAccountId,
    },
  });

  return {
    requestId: created.id,
    otherRequestId: otherCreated.id,
  };
};

// ── Edit mode ────────────────────────────────────────────────────────────────
// Reverse of the create mapping above: hydrate the form state from a loaded
// parent gcp_request + gcp_otherrequests child, then PATCH the editable fields
// back. Requestor/Company lookups are never rebound and gcp_requestoremail is
// never PATCHed — the original requestor's identity must survive edits by
// Reviewers/Verifiers. The Project lookup IS rebound (the Project select stays
// editable in edit mode). matterValue is preserved from the parent so a GCP
// (13) vs GCPC (9) request keeps its channel.

/** Build Others form state from the loaded parent + child records (edit prefill). */
const loadOthersFormState = (
  request: GcpRequest,
  other: GcpOtherRequest
): OthersFormState => ({
  matterValue: request.matter as OthersFormState['matterValue'],
  categoryValue: (request.category ?? 2) as OthersFormState['categoryValue'],
  // Mirror new mode: the requestor select's value is the email, the label the name.
  requestorContactId: request.requestorEmail ?? '',
  requestorName: request.requestorName ?? '',
  requestorEmail: request.requestorEmail ?? '',
  companyId: request.companyId ?? '',
  companyName: request.companyName ?? '',
  projectId: other.projectId ?? '',
  projectName: request.projectName ?? other.name ?? '',
  projectCode: request.projectCode ?? other.projectCode ?? '',
  descriptionOfMatters: other.descriptionOfMatters ?? '',
  acknowledged: request.acknowledged ?? other.acknowledged ?? false,
});

type UpdateOthersIds = {
  /** Parent gcp_request GUID. */
  requestId: string;
  /** Child gcp_otherrequests GUID. */
  otherRecordId: string;
  /**
   * Final document set to persist on gcp_request.gcp_documentsurl (kept existing
   * links + new uploads). When omitted, the column is left untouched.
   */
  documents?: DocumentLink[];
};

/**
 * Save edits: PATCH the editable fields on the parent request and the Others
 * child. Does NOT change gcp_requeststatus (stays RS / Resubmit) and never
 * touches the Requestor/Company lookups or gcp_requestoremail.
 */
const updateOtherRequestFromState = async (
  state: OthersFormState,
  ids: UpdateOthersIds
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

  // Child gcp_otherrequests — same editable column set as the create mapping.
  await updateOtherRequest(
    ids.otherRecordId,
    {
      gcp_requestname: state.projectName || null,
      gcp_descriptionofmatters: orNull(state.descriptionOfMatters),
      gcp_projectcode: orNull(state.projectCode),
      gcp_acknowledgement: state.acknowledged,
    },
    { lookups: { projectId } }
  );
};

export { submitOtherRequest, loadOthersFormState, updateOtherRequestFromState };
export type { SubmitResult, SubmitOthersOptions, UpdateOthersIds };
