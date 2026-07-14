// src/forms/pcca/api.ts
// PCCA submission flow:
//   1. POST /_api/gcp_requests      — parent request row, bound to the selected
//      Project (gcp_Project) and Company (gcp_Company). Acknowledgement lives here.
//   2. POST /_api/gcp_pccarequests  — PCCA details, bound to (1) via
//      `gcp_Request@odata.bind` plus the Project and Company lookups.
//
// The two "from Contract BQ" sections are DynamicRowFields whose rows are already
// JSON strings in form state, so they persist as-is into multiline-text columns.

import {
  createRequest,
  updateRequest,
} from '../../shared/services/requestService';
import {
  createPccaRequest,
  updatePccaRequest,
} from '../../shared/services/pccaRequestService';
import { serializeDocuments } from '../../shared/documents';
import type { DocumentLink } from '../../shared/documents';
import type { CreateGcpRequestInput, GcpRequest } from '../../types/request';
import type {
  CreateGcpPccaRequestInput,
  GcpPccaRequest,
} from '../../types/pccaRequest';
import type { SoaCodeValue } from '../../data/soaChoices';
import type { PccaFormState } from './types';

type SubmitResult = {
  requestId: string;
  pccaRequestId: string;
};

// SOA code "PCCA" maps to value 6 in soaCodeChoices.
const resolveSoaCodeForPcca = (): SoaCodeValue => 6;

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

type SubmitPccaOptions = {
  /** Logged-in user's contact GUID for the gcp_RequestorName lookup. The form's
   *  `requestorContactId` field holds an email (used only for the UI select), so
   *  the real contact GUID must be passed here — otherwise the contact lookup is
   *  skipped and the Contact-scoped table permission denies later associations. */
  requestorContactId?: string | null;
  /** Uploaded document links to persist on the request's gcp_documentsurl. */
  documents?: DocumentLink[];
};

const submitPccaRequest = async (
  data: PccaFormState,
  options: SubmitPccaOptions = {}
): Promise<SubmitResult> => {
  const companyAccountId = data.companyId || null;
  const projectId = data.projectId || null;

  // Step 1 — parent gcp_request
  const parentInput: CreateGcpRequestInput = {
    gcp_category: data.categoryValue,
    gcp_mattertype: data.matterValue,
    gcp_soacode: resolveSoaCodeForPcca(),
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

  // Step 2 — gcp_pccarequest bound to the parent. DynamicRowFields inputs are
  // already JSON strings in form state, so they persist as-is.
  // (This table has no gcp_soacode column — SOA code lives on gcp_request.)
  const pccaInput: CreateGcpPccaRequestInput = {
    gcp_occarequestname: data.projectName || null,

    // Step 2 — Cost Information (JSON)
    gcp_pricerevenuefromcontractbq: orNull(data.priceRevenueFromContractBq),
    gcp_costfromcontractbq: orNull(data.costFromContractBq),

    // Step 3 — Cost Summary
    gcp_totalrevenuerm: orInt(data.totalRevenue),
    gcp_totalcostrm: orInt(data.totalCost),
    gcp_constructioncostrm: orInt(data.constructionCost),
    gcp_internalcost: orInt(data.internalCost),
    gcp_remarks: orNull(data.remarks),

    // Step 4 — Acknowledgement (mirrored on child; required bit on this table)
    gcp_acknowledgement: data.acknowledged,
  };

  const pccaCreated = await createPccaRequest(pccaInput, {
    lookups: {
      requestId: created.id,
      projectId,
      companyAccountId,
    },
  });

  return {
    requestId: created.id,
    pccaRequestId: pccaCreated.id,
  };
};

// ── Edit mode ────────────────────────────────────────────────────────────────
// Reverse of the create mapping above: hydrate the form state from a loaded
// parent gcp_request + gcp_pccarequest child, then PATCH the editable fields
// back. Requestor/Company lookups are never rebound and gcp_requestoremail is
// never PATCHed — the original requestor's identity must survive edits by
// Reviewers/Verifiers. The Project lookup IS rebound (the Project select stays
// editable in edit mode). The two BQ sections are JSON strings that seed
// DynamicRowFields' initialRows and persist as-is.

/** Number column → form string (empty when null). */
const numToStr = (value: number | null): string =>
  value == null ? '' : String(value);

/** Build PCCA form state from the loaded parent + child records (edit prefill). */
const loadPccaFormState = (
  request: GcpRequest,
  pcca: GcpPccaRequest
): PccaFormState => ({
  matterValue: request.matter as PccaFormState['matterValue'],
  categoryValue: (request.category ?? 2) as PccaFormState['categoryValue'],
  // Mirror new mode: the requestor select's value is the email, the label the name.
  requestorContactId: request.requestorEmail ?? '',
  requestorName: request.requestorName ?? '',
  requestorEmail: request.requestorEmail ?? '',
  companyId: request.companyId ?? '',
  companyName: request.companyName ?? '',
  projectId: pcca.projectId ?? '',
  projectName: request.projectName ?? pcca.title ?? '',
  projectCode: request.projectCode ?? '',

  // JSON strings — seed DynamicRowFields via parseRowFieldData in the form.
  priceRevenueFromContractBq: pcca.priceRevenueFromContractBq ?? '',
  costFromContractBq: pcca.costFromContractBq ?? '',

  // Totals are auto-summed from the BQ rows on mount; seed for first paint.
  totalRevenue: numToStr(pcca.totalRevenue),
  totalCost: numToStr(pcca.totalCost),
  constructionCost: numToStr(pcca.constructionCost),
  internalCost: numToStr(pcca.internalCost),
  remarks: pcca.remarks ?? '',

  acknowledged: request.acknowledged ?? pcca.acknowledged ?? false,
});

type UpdatePccaIds = {
  /** Parent gcp_request GUID. */
  requestId: string;
  /** Child gcp_pccarequest GUID. */
  pccaRecordId: string;
  /**
   * Final document set to persist on gcp_request.gcp_documentsurl (kept existing
   * links + new uploads). When omitted, the column is left untouched.
   */
  documents?: DocumentLink[];
};

/**
 * Save edits: PATCH the editable fields on the parent request and the PCCA
 * child. Does NOT change gcp_requeststatus (stays RS / Resubmit) and never
 * touches the Requestor/Company lookups or gcp_requestoremail.
 */
const updatePccaRequestFromState = async (
  state: PccaFormState,
  ids: UpdatePccaIds
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

  // Child gcp_pccarequest — same editable column set as the create mapping.
  await updatePccaRequest(
    ids.pccaRecordId,
    {
      gcp_occarequestname: state.projectName || null,

      gcp_pricerevenuefromcontractbq: orNull(state.priceRevenueFromContractBq),
      gcp_costfromcontractbq: orNull(state.costFromContractBq),

      gcp_totalrevenuerm: orInt(state.totalRevenue),
      gcp_totalcostrm: orInt(state.totalCost),
      gcp_constructioncostrm: orInt(state.constructionCost),
      gcp_internalcost: orInt(state.internalCost),
      gcp_remarks: orNull(state.remarks),

      gcp_acknowledgement: state.acknowledged,
    },
    { lookups: { projectId } }
  );
};

export { submitPccaRequest, loadPccaFormState, updatePccaRequestFromState };
export type { SubmitResult, SubmitPccaOptions, UpdatePccaIds };
