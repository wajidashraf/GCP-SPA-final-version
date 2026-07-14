// src/forms/cpr/api.ts
// CPR (Contract Progress Report) submission flow:
//   1. POST /_api/gcp_requests        — parent request row, bound to the selected
//      Project (gcp_Project) and Company (gcp_Company). Project name/code and the
//      acknowledgement live here.
//   2. POST /_api/gcp_cprrequestgcps  — CPR details (EOT / VO / Claims), bound to
//      (1) via `gcp_Request@odata.bind` plus the Project and Company lookups.
//      The child's acknowledgement column is `gcp_acknowledgementconfirmed`.

import {
  createRequest,
  updateRequest,
} from '../../shared/services/requestService';
import {
  createCprRequest,
  updateCprRequest,
} from '../../shared/services/cprRequestService';
import { serializeDocuments } from '../../shared/documents';
import type { DocumentLink } from '../../shared/documents';
import type { CreateGcpRequestInput, GcpRequest } from '../../types/request';
import type {
  CreateGcpCprRequestInput,
  GcpCprRequest,
} from '../../types/cprRequest';
import type { SoaCodeValue } from '../../data/soaChoices';
import type { CprFormState } from './types';

type SubmitResult = {
  requestId: string;
  cprRequestId: string;
};

// SOA code "CPR" maps to value 12 in soaCodeChoices.
const resolveSoaCodeForCpr = (): SoaCodeValue => 12;

/** Collapse empty/whitespace text to null so we don't store blank strings. */
const orNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/** Parse a numeric form value to a whole number, or null when empty / not a number. */
const orInt = (value: string): number | null => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.round(n) : null;
};

/** Convert a yyyy-mm-dd date input to an ISO datetime string, or null. */
const orDate = (value: string): string | null =>
  value ? new Date(value).toISOString() : null;

type SubmitCprOptions = {
  /** Logged-in user's contact GUID for the gcp_RequestorName lookup. The form's
   *  `requestorContactId` field holds an email (used only for the UI select), so
   *  the real contact GUID must be passed here — otherwise the contact lookup is
   *  skipped and the Contact-scoped table permission denies later associations. */
  requestorContactId?: string | null;
  /** Uploaded document links to persist on the request's gcp_documentsurl. */
  documents?: DocumentLink[];
};

const submitCprRequest = async (
  data: CprFormState,
  options: SubmitCprOptions = {}
): Promise<SubmitResult> => {
  const companyAccountId = data.companyId || null;
  const projectId = data.projectId || null;

  // Step 1 — parent gcp_request
  const parentInput: CreateGcpRequestInput = {
    gcp_category: data.categoryValue,
    gcp_mattertype: data.matterValue,
    gcp_soacode: resolveSoaCodeForCpr(),
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

  // Step 2–5 — gcp_cprrequestgcp bound to the parent.
  // (This table has no gcp_soacode column — SOA code lives on gcp_request.)
  const cprInput: CreateGcpCprRequestInput = {
    gcp_cprrequestgcp1: data.projectName || null,
    gcp_projectcode: orNull(data.projectCode),

    // Step 2 — EOT Information
    gcp_eotlatestno: orNull(data.eotLatestNo),
    gcp_eotlatestdate: orDate(data.eotLatestDate),
    gcp_eotnewapplicationdate: orDate(data.eotNewApplicationDate),
    gcp_eotnewcompletiondate: orDate(data.eotNewCompletionDate),
    gcp_statusofneweotapplication: data.eotStatus,
    gcp_eotnewjustifications: orNull(data.eotNewJustifications),

    // Step 3 — VO Information
    gcp_volatestno: orNull(data.voLatestNo),
    gcp_latestapprovedvocumulativeamount: orInt(
      data.voLatestApprovedCumulativeAmount
    ),
    gcp_newvoapplicationamount: orInt(data.voNewApplicationAmount),
    gcp_vonewapplicationno: orNull(data.voNewApplicationNo),
    gcp_vonewapplicationdate: orDate(data.voNewApplicationDate),
    gcp_statusofnewvoapplication: data.voStatus,
    gcp_vonewjustification: orNull(data.voNewJustification),

    // Step 4 — Claims to Client
    gcp_cumulativeclaimapplicationamounttodate: orInt(
      data.cumulativeClaimApplicationAmount
    ),
    gcp_cumulativeclaimcertifiedamounttodate: orInt(
      data.cumulativeClaimCertifiedAmount
    ),
    gcp_pendingcertifiedamounttodate: orInt(data.pendingCertifiedAmount),
    gcp_noofclaimsforpendingcertifiedamount: orInt(
      data.noOfClaimsForPendingCertified
    ),
    gcp_newnetcertifiedamount: orInt(data.newNetCertifiedAmount),
    gcp_dateofclaimpendingcertifiedamount: orDate(
      data.dateOfClaimPendingCertified
    ),

    // Step 5 — Acknowledgement (child column differs from parent)
    gcp_acknowledgementconfirmed: data.acknowledged,
  };

  const cprCreated = await createCprRequest(cprInput, {
    lookups: {
      requestId: created.id,
      projectId,
      companyAccountId,
    },
  });

  return {
    requestId: created.id,
    cprRequestId: cprCreated.id,
  };
};

// ── Edit mode ────────────────────────────────────────────────────────────────
// Reverse of the create mapping above: hydrate the form state from a loaded
// parent gcp_request + gcp_cprrequestgcp child, then PATCH the editable fields
// back. Requestor/Company lookups are never rebound and gcp_requestoremail is
// never PATCHed — the original requestor's identity must survive edits by
// Reviewers/Verifiers. The Project lookup IS rebound (the Project select stays
// editable in edit mode). The child's acknowledgement column is
// gcp_acknowledgementconfirmed (not gcp_acknowledgement).

/** Number column → form string (empty when null). */
const numToStr = (value: number | null): string =>
  value == null ? '' : String(value);

/** ISO datetime column → yyyy-mm-dd for a <input type="date"> field. */
const dateToStr = (value: string | null): string =>
  value ? value.slice(0, 10) : '';

/** Build CPR form state from the loaded parent + child records (edit prefill). */
const loadCprFormState = (
  request: GcpRequest,
  cpr: GcpCprRequest
): CprFormState => ({
  matterValue: request.matter as CprFormState['matterValue'],
  categoryValue: (request.category ?? 2) as CprFormState['categoryValue'],
  // Mirror new mode: the requestor select's value is the email, the label the name.
  requestorContactId: request.requestorEmail ?? '',
  requestorName: request.requestorName ?? '',
  requestorEmail: request.requestorEmail ?? '',
  companyId: request.companyId ?? '',
  companyName: request.companyName ?? '',
  projectId: cpr.projectId ?? '',
  projectName: request.projectName ?? cpr.name ?? '',
  projectCode: request.projectCode ?? cpr.projectCode ?? '',

  eotLatestNo: cpr.eotLatestNo ?? '',
  eotLatestDate: dateToStr(cpr.eotLatestDate),
  eotNewApplicationDate: dateToStr(cpr.eotNewApplicationDate),
  eotNewCompletionDate: dateToStr(cpr.eotNewCompletionDate),
  eotStatus: cpr.eotStatus ?? 1,
  eotNewJustifications: cpr.eotNewJustifications ?? '',

  voLatestNo: cpr.voLatestNo ?? '',
  voLatestApprovedCumulativeAmount: numToStr(cpr.voLatestApprovedCumulativeAmount),
  voNewApplicationAmount: numToStr(cpr.voNewApplicationAmount),
  voNewApplicationNo: cpr.voNewApplicationNo ?? '',
  voNewApplicationDate: dateToStr(cpr.voNewApplicationDate),
  voStatus: cpr.voStatus ?? 2,
  voNewJustification: cpr.voNewJustification ?? '',

  cumulativeClaimApplicationAmount: numToStr(cpr.cumulativeClaimApplicationAmount),
  cumulativeClaimCertifiedAmount: numToStr(cpr.cumulativeClaimCertifiedAmount),
  pendingCertifiedAmount: numToStr(cpr.pendingCertifiedAmount),
  noOfClaimsForPendingCertified: numToStr(cpr.noOfClaimsForPendingCertified),
  newNetCertifiedAmount: numToStr(cpr.newNetCertifiedAmount),
  dateOfClaimPendingCertified: dateToStr(cpr.dateOfClaimPendingCertified),

  acknowledged: request.acknowledged ?? cpr.acknowledged ?? false,
});

type UpdateCprIds = {
  /** Parent gcp_request GUID. */
  requestId: string;
  /** Child gcp_cprrequestgcp GUID. */
  cprRecordId: string;
  /**
   * Final document set to persist on gcp_request.gcp_documentsurl (kept existing
   * links + new uploads). When omitted, the column is left untouched.
   */
  documents?: DocumentLink[];
};

/**
 * Save edits: PATCH the editable fields on the parent request and the CPR child.
 * Does NOT change gcp_requeststatus (stays RS / Resubmit) and never touches the
 * Requestor/Company lookups or gcp_requestoremail.
 */
const updateCprRequestFromState = async (
  state: CprFormState,
  ids: UpdateCprIds
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

  // Child gcp_cprrequestgcp — same editable column set as the create mapping.
  await updateCprRequest(
    ids.cprRecordId,
    {
      gcp_cprrequestgcp1: state.projectName || null,
      gcp_projectcode: orNull(state.projectCode),

      gcp_eotlatestno: orNull(state.eotLatestNo),
      gcp_eotlatestdate: orDate(state.eotLatestDate),
      gcp_eotnewapplicationdate: orDate(state.eotNewApplicationDate),
      gcp_eotnewcompletiondate: orDate(state.eotNewCompletionDate),
      gcp_statusofneweotapplication: state.eotStatus,
      gcp_eotnewjustifications: orNull(state.eotNewJustifications),

      gcp_volatestno: orNull(state.voLatestNo),
      gcp_latestapprovedvocumulativeamount: orInt(
        state.voLatestApprovedCumulativeAmount
      ),
      gcp_newvoapplicationamount: orInt(state.voNewApplicationAmount),
      gcp_vonewapplicationno: orNull(state.voNewApplicationNo),
      gcp_vonewapplicationdate: orDate(state.voNewApplicationDate),
      gcp_statusofnewvoapplication: state.voStatus,
      gcp_vonewjustification: orNull(state.voNewJustification),

      gcp_cumulativeclaimapplicationamounttodate: orInt(
        state.cumulativeClaimApplicationAmount
      ),
      gcp_cumulativeclaimcertifiedamounttodate: orInt(
        state.cumulativeClaimCertifiedAmount
      ),
      gcp_pendingcertifiedamounttodate: orInt(state.pendingCertifiedAmount),
      gcp_noofclaimsforpendingcertifiedamount: orInt(
        state.noOfClaimsForPendingCertified
      ),
      gcp_newnetcertifiedamount: orInt(state.newNetCertifiedAmount),
      gcp_dateofclaimpendingcertifiedamount: orDate(
        state.dateOfClaimPendingCertified
      ),

      gcp_acknowledgementconfirmed: state.acknowledged,
    },
    { lookups: { projectId } }
  );
};

export { submitCprRequest, loadCprFormState, updateCprRequestFromState };
export type { SubmitResult, SubmitCprOptions, UpdateCprIds };
