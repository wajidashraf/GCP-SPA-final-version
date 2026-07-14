// src/forms/ci/api.ts
// CI (Contractual Issue Relating to Payment) submission flow:
//   1. POST /_api/gcp_requests       — parent request row, bound to the selected
//      Project (gcp_Project) and Company (gcp_Company). Project name/code and the
//      acknowledgement live here.
//   2. POST /_api/gcp_requestcigcps  — CI details, bound to (1) via
//      `gcp_Request@odata.bind` plus the Project and Company lookups.
//      gcp_company is REQUIRED on the child, so companyAccountId must be present.

import {
  createRequest,
  updateRequest,
} from '../../shared/services/requestService';
import {
  createCiRequest,
  updateCiRequest,
} from '../../shared/services/ciRequestService';
import { serializeDocuments } from '../../shared/documents';
import type { DocumentLink } from '../../shared/documents';
import type { CreateGcpRequestInput, GcpRequest } from '../../types/request';
import type {
  CreateGcpCiRequestInput,
  GcpCiRequest,
} from '../../types/ciRequest';
import type { SoaCodeValue } from '../../data/soaChoices';
import type { CiFormState } from './types';

type SubmitResult = {
  requestId: string;
  ciRequestId: string;
};

// SOA code "CI" maps to value 11 in soaCodeChoices.
const resolveSoaCodeForCi = (): SoaCodeValue => 11;

/** Collapse empty/whitespace text to null so we don't store blank strings. */
const orNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

type SubmitCiOptions = {
  /** Logged-in user's contact GUID for the gcp_RequestorName lookup. The form's
   *  `requestorContactId` field holds an email (used only for the UI select), so
   *  the real contact GUID must be passed here — otherwise the contact lookup is
   *  skipped and the Contact-scoped table permission denies later associations. */
  requestorContactId?: string | null;
  /** Uploaded document links to persist on the request's gcp_documentsurl. */
  documents?: DocumentLink[];
};

const submitCiRequest = async (
  data: CiFormState,
  options: SubmitCiOptions = {}
): Promise<SubmitResult> => {
  const companyAccountId = data.companyId || null;
  const projectId = data.projectId || null;

  // Step 1 — parent gcp_request
  const parentInput: CreateGcpRequestInput = {
    gcp_category: data.categoryValue,
    gcp_mattertype: data.matterValue,
    gcp_soacode: resolveSoaCodeForCi(),
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

  // Step 2–5 — gcp_requestcigcp bound to the parent.
  // (This table has no gcp_soacode column — SOA code lives on gcp_request.)
  const ciInput: CreateGcpCiRequestInput = {
    gcp_name: data.projectName || null,
    gcp_projectcode: orNull(data.projectCode),
    gcp_companyroleinthisissue:
      data.companyRole === '' ? null : data.companyRole,

    // Step 3 — VO / EOT / L&E Information
    gcp_category: orNull(data.category),
    gcp_chronologyofeventvo: orNull(data.chronologyOfEventVo),
    gcp_briefofissuesvo: orNull(data.briefOfIssuesVo),
    gcp_timeandcostimpactvo: orNull(data.timeAndCostImpactVo),
    gcp_contractclause: orNull(data.contractClause),
    gcp_advisoryrequiredfromgcpvo: orNull(data.advisoryRequiredVo),

    // Step 4 — Payments Information
    gcp_briefofissuespayments: orNull(data.briefOfIssuesPayments),
    gcp_chronologyofeventpayments: orNull(data.chronologyOfEventPayments),
    gcp_contractclausepayment: orNull(data.contractClausePayment),
    gcp_advisoryrequiredfromgcppayments: orNull(data.advisoryRequiredPayments),

    // Step 5 — Acknowledgement
    gcp_acknowledgement: data.acknowledged,
  };

  const ciCreated = await createCiRequest(ciInput, {
    lookups: {
      requestId: created.id,
      projectId,
      companyAccountId,
    },
  });

  return {
    requestId: created.id,
    ciRequestId: ciCreated.id,
  };
};

// ── Edit mode ────────────────────────────────────────────────────────────────
// Reverse of the create mapping above: hydrate the form state from a loaded
// parent gcp_request + gcp_requestcigcp child, then PATCH the editable fields
// back. Requestor/Company lookups are never rebound and gcp_requestoremail is
// never PATCHed — the original requestor's identity must survive edits by
// Reviewers/Verifiers. The Project lookup IS rebound (the Project select stays
// editable in edit mode). gcp_company is required on the child but a PATCH that
// omits it leaves the existing value untouched.

/** Build CI form state from the loaded parent + child records (edit prefill). */
const loadCiFormState = (
  request: GcpRequest,
  ci: GcpCiRequest
): CiFormState => ({
  matterValue: request.matter as CiFormState['matterValue'],
  categoryValue: (request.category ?? 2) as CiFormState['categoryValue'],
  // Mirror new mode: the requestor select's value is the email, the label the name.
  requestorContactId: request.requestorEmail ?? '',
  requestorName: request.requestorName ?? '',
  requestorEmail: request.requestorEmail ?? '',
  companyId: request.companyId ?? '',
  companyName: request.companyName ?? '',
  projectId: ci.projectId ?? '',
  projectName: request.projectName ?? ci.name ?? '',
  projectCode: request.projectCode ?? ci.projectCode ?? '',
  companyRole: ci.companyRole ?? '',

  category: ci.category ?? '',
  chronologyOfEventVo: ci.chronologyOfEventVo ?? '',
  briefOfIssuesVo: ci.briefOfIssuesVo ?? '',
  timeAndCostImpactVo: ci.timeAndCostImpactVo ?? '',
  contractClause: ci.contractClause ?? '',
  advisoryRequiredVo: ci.advisoryRequiredVo ?? '',

  briefOfIssuesPayments: ci.briefOfIssuesPayments ?? '',
  chronologyOfEventPayments: ci.chronologyOfEventPayments ?? '',
  contractClausePayment: ci.contractClausePayment ?? '',
  advisoryRequiredPayments: ci.advisoryRequiredPayments ?? '',

  acknowledged: request.acknowledged ?? ci.acknowledged ?? false,
});

type UpdateCiIds = {
  /** Parent gcp_request GUID. */
  requestId: string;
  /** Child gcp_requestcigcp GUID. */
  ciRecordId: string;
  /**
   * Final document set to persist on gcp_request.gcp_documentsurl (kept existing
   * links + new uploads). When omitted, the column is left untouched.
   */
  documents?: DocumentLink[];
};

/**
 * Save edits: PATCH the editable fields on the parent request and the CI child.
 * Does NOT change gcp_requeststatus (stays RS / Resubmit) and never touches the
 * Requestor/Company lookups or gcp_requestoremail.
 */
const updateCiRequestFromState = async (
  state: CiFormState,
  ids: UpdateCiIds
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

  // Child gcp_requestcigcp — same editable column set as the create mapping.
  await updateCiRequest(
    ids.ciRecordId,
    {
      gcp_name: state.projectName || null,
      gcp_projectcode: orNull(state.projectCode),
      gcp_companyroleinthisissue:
        state.companyRole === '' ? null : state.companyRole,

      gcp_category: orNull(state.category),
      gcp_chronologyofeventvo: orNull(state.chronologyOfEventVo),
      gcp_briefofissuesvo: orNull(state.briefOfIssuesVo),
      gcp_timeandcostimpactvo: orNull(state.timeAndCostImpactVo),
      gcp_contractclause: orNull(state.contractClause),
      gcp_advisoryrequiredfromgcpvo: orNull(state.advisoryRequiredVo),

      gcp_briefofissuespayments: orNull(state.briefOfIssuesPayments),
      gcp_chronologyofeventpayments: orNull(state.chronologyOfEventPayments),
      gcp_contractclausepayment: orNull(state.contractClausePayment),
      gcp_advisoryrequiredfromgcppayments: orNull(state.advisoryRequiredPayments),

      gcp_acknowledgement: state.acknowledged,
    },
    { lookups: { projectId } }
  );
};

export { submitCiRequest, loadCiFormState, updateCiRequestFromState };
export type { SubmitResult, SubmitCiOptions, UpdateCiIds };
