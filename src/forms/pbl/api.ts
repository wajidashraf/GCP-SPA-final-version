// src/forms/pbl/api.ts
// PBL submission flow:
//   1. POST /_api/gcp_requests       — parent request row, bound to selected
//      Project (gcp_Project) and Company (gcp_Company).
//   2. POST /_api/gcp_pblrequests    — PBL details, bound to (1) via
//      `gcp_Request@odata.bind` plus Project lookup.
//   3. POST /_api/gcp_pblbidderses   — one row per bidder, each bound to (2)
//      via `gcp_PBLRequest@odata.bind`. Justification (if <3 bidders) is
//      stored on every bidder row per the table schema.

import {
  createRequest,
  updateRequest,
} from '../../shared/services/requestService';
import {
  createPblRequest,
  updatePblRequest,
} from '../../shared/services/pblRequestService';
import {
  createPblBidder,
  updatePblBidder,
  deletePblBidder,
} from '../../shared/services/pblBidderService';
import { serializeDocuments } from '../../shared/documents';
import type { DocumentLink } from '../../shared/documents';
import type { CreateGcpRequestInput, GcpRequest } from '../../types/request';
import type {
  CreateGcpPblRequestInput,
  GcpPblRequest,
} from '../../types/pblRequest';
import type {
  CreateGcpPblBidderInput,
  GcpPblBidder,
} from '../../types/pblBidder';
import type { SoaCodeValue } from '../../data/soaChoices';
import type { PblBidderDraft, PblFormState } from './types';

type SubmitResult = {
  requestId: string;
  pblRequestId: string;
  bidderIds: string[];
};

// SOA code "PBL" maps to value 2 in soaCodeChoices.
const resolveSoaCodeForPbl = (): SoaCodeValue => 2;

type SubmitPblOptions = {
  /** Logged-in user's contact GUID for the gcp_RequestorName lookup. The form's
   *  `requestorContactId` field holds an email (used only for the UI select), so
   *  the real contact GUID must be passed here — otherwise the contact lookup is
   *  skipped and the Contact-scoped table permission denies later associations. */
  requestorContactId?: string | null;
  /** Uploaded document links to persist on the request's gcp_documentsurl. */
  documents?: DocumentLink[];
};

const submitPblRequest = async (
  data: PblFormState,
  options: SubmitPblOptions = {}
): Promise<SubmitResult> => {
  const companyAccountId = data.companyId || null;
  const projectId = data.projectId || null;

  // Step 1 — parent gcp_request
  const parentInput: CreateGcpRequestInput = {
    gcp_category: data.categoryValue,
    gcp_mattertype: data.matterValue,
    gcp_soacode: resolveSoaCodeForPbl(),
    gcp_requestoremail: data.requestorEmail || null,
    gcp_project_name: data.projectName || null,
    gcp_projectcode: data.projectCode || null,
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

  // Step 2 — gcp_pblrequest bound to the parent. Per spec, only the project
  // lookup, project code, and procurement method live on this table; the
  // acknowledgement is stored on the parent gcp_request.
  const pblInput: CreateGcpPblRequestInput = {
    gcp_projectcode: data.projectCode || null,
    gcp_procurementmethod:
      data.procurementMethod === '' ? null : data.procurementMethod,
  };

  const pblCreated = await createPblRequest(pblInput, {
    lookups: {
      requestId: created.id,
      projectId,
    },
  });

  // Step 3 — one row per bidder
  const justification =
    data.bidders.length < 3 ? data.justificationForLessBidders || null : null;

  const bidderIds: string[] = [];
  for (const b of data.bidders) {
    // When the user picks "Other", only the free-text company name is stored
    // (gcp_company); the account lookup stays unbound. When a real account is
    // selected, both columns are populated for consistency.
    const isOther = b.isOtherCompany || !b.companyAccountId;
    const input: CreateGcpPblBidderInput = {
      gcp_pblbiddername: b.companyName || 'Bidder',
      gcp_company: (b.companyName || '').slice(0, 100),
      gcp_sector: b.sector === '' ? null : b.sector,
      gcp_location: b.location || null,
      gcp_person_in_charge: b.personInCharge || null,
      gcp_piccontactnumber: b.picContactNumber || null,
      gcp_recommendedby: b.recommendationBy || null,
      gcp_sourcesfrom: b.sourcesFrom || null,
      gcp_justificationforlt3bidders: justification,
    };
    const bidder = await createPblBidder(input, {
      lookups: {
        pblRequestId: pblCreated.id,
        companyAccountId: isOther ? null : b.companyAccountId,
      },
    });
    bidderIds.push(bidder.id);
  }

  return {
    requestId: created.id,
    pblRequestId: pblCreated.id,
    bidderIds,
  };
};

// ── Edit mode ────────────────────────────────────────────────────────────────
// Reverse of the create mapping above: hydrate the form state from a loaded
// parent gcp_request + gcp_pblrequest child + gcp_pblbidders rows, then PATCH
// the editable fields back and diff the bidder collection (POST new rows,
// DELETE removed ones). Requestor/Company lookups are never rebound; the
// Project lookup IS rebound because the Project select stays editable in edit
// mode. gcp_requestoremail is deliberately never PATCHed — the original
// requestor's identity must survive edits by Reviewers/Verifiers.

/** Build PBL form state from the loaded parent + child + bidders (edit prefill). */
const loadPblFormState = (
  request: GcpRequest,
  pbl: GcpPblRequest,
  bidders: GcpPblBidder[]
): PblFormState => ({
  matterValue: request.matter as PblFormState['matterValue'],
  categoryValue: (request.category ?? 2) as PblFormState['categoryValue'],
  // Mirror new mode: the requestor select's value is the email, the label the name.
  requestorContactId: request.requestorEmail ?? '',
  requestorName: request.requestorName ?? '',
  requestorEmail: request.requestorEmail ?? '',
  companyId: request.companyId ?? '',
  companyName: request.companyName ?? '',
  // The parent request has no project lookup in its mapped type; the child
  // gcp_pblrequest carries the gcp_Project lookup.
  projectId: pbl.projectId ?? '',
  projectName: request.projectName ?? '',
  projectCode: pbl.projectCode ?? request.projectCode ?? '',
  procurementMethod: pbl.procurementMethod ?? '',
  bidders: bidders.map(
    (b): PblBidderDraft => ({
      id: b.id,
      companyAccountId: b.companyAccountId ?? '',
      // gcp_company (text) is what the create flow writes; the formatted
      // lookup label and primary name are fallbacks.
      companyName: b.company ?? b.companyName ?? b.bidderName ?? '',
      isOtherCompany: !b.companyAccountId,
      sector: (b.sector ?? '') as PblBidderDraft['sector'],
      location: b.location ?? '',
      personInCharge: b.personInCharge ?? '',
      picContactNumber: b.picContactNumber ?? '',
      sourcesFrom: b.sourcesFrom ?? '',
      recommendationBy: b.recommendedBy ?? '',
    })
  ),
  // Stored on every row; take the first non-null in case a past partial save
  // left rows inconsistent (the update diff heals discrepant rows).
  justificationForLessBidders:
    bidders.find((b) => b.justificationForLt3Bidders != null)
      ?.justificationForLt3Bidders ?? '',
  acknowledged: request.acknowledged ?? false,
});

type UpdatePblIds = {
  /** Parent gcp_request GUID. */
  requestId: string;
  /** Child gcp_pblrequest GUID. */
  pblRecordId: string;
  /** Bidder rows as loaded (the diff baseline): ids drive DELETE detection,
   *  per-row justification drives skip-if-unchanged PATCHes. */
  originalBidders: GcpPblBidder[];
  /**
   * Final document set to persist on gcp_request.gcp_documentsurl (kept
   * existing links + new uploads). When omitted, the column is left untouched.
   */
  documents?: DocumentLink[];
};

/**
 * Save edits: PATCH the parent request and PBL child, then reconcile the
 * bidder rows against the loaded snapshot. Does NOT change gcp_requeststatus
 * (stays RS / Resubmit) and never touches the Requestor/Company lookups or
 * gcp_requestoremail. Idempotent operations (PATCH/DELETE) run before the
 * non-idempotent POSTs so a failed save can be retried without duplicates.
 */
const updatePblRequestFromState = async (
  state: PblFormState,
  ids: UpdatePblIds
): Promise<void> => {
  const projectId = state.projectId || null;

  // Parent gcp_request — project fields + acknowledgement (+ documents).
  await updateRequest(
    ids.requestId,
    {
      gcp_project_name: state.projectName || null,
      gcp_projectcode: state.projectCode || null,
      gcp_acknowledgement: state.acknowledged,
      // Rewrite the document links only when the caller manages documents.
      ...(ids.documents
        ? { gcp_documentsurl: serializeDocuments(ids.documents) }
        : {}),
    },
    { lookups: { projectId } }
  );

  // Child gcp_pblrequest — procurement method + project code/lookup.
  await updatePblRequest(
    ids.pblRecordId,
    {
      gcp_projectcode: state.projectCode || null,
      gcp_procurementmethod:
        state.procurementMethod === '' ? null : state.procurementMethod,
    },
    { lookups: { projectId } }
  );

  // Bidder diff. Justification is recomputed from the FINAL bidder count and
  // stored on every row (same rule as the create flow).
  const justification =
    state.bidders.length < 3 ? state.justificationForLessBidders || null : null;
  const keptIds = new Set(
    state.bidders.map((b) => b.id).filter((id): id is string => !!id)
  );

  // 1. DELETE rows the user removed.
  const removed = ids.originalBidders.filter((o) => !keptIds.has(o.id));
  for (const o of removed) {
    await deletePblBidder(o.id);
  }

  // 2. PATCH kept rows whose stored justification differs from the recomputed
  //    value. Rows aren't editable in place, so nothing else can change.
  for (const b of state.bidders) {
    if (!b.id) continue;
    const original = ids.originalBidders.find((o) => o.id === b.id);
    if ((original?.justificationForLt3Bidders ?? null) !== justification) {
      await updatePblBidder(b.id, {
        gcp_justificationforlt3bidders: justification,
      });
    }
  }

  // 3. POST rows added in the UI (no id) — same column set as the create flow.
  for (const b of state.bidders) {
    if (b.id) continue;
    const isOther = b.isOtherCompany || !b.companyAccountId;
    const input: CreateGcpPblBidderInput = {
      gcp_pblbiddername: b.companyName || 'Bidder',
      gcp_company: (b.companyName || '').slice(0, 100),
      gcp_sector: b.sector === '' ? null : b.sector,
      gcp_location: b.location || null,
      gcp_person_in_charge: b.personInCharge || null,
      gcp_piccontactnumber: b.picContactNumber || null,
      gcp_recommendedby: b.recommendationBy || null,
      gcp_sourcesfrom: b.sourcesFrom || null,
      gcp_justificationforlt3bidders: justification,
    };
    await createPblBidder(input, {
      lookups: {
        pblRequestId: ids.pblRecordId,
        companyAccountId: isOther ? null : b.companyAccountId,
      },
    });
  }
};

export { submitPblRequest, loadPblFormState, updatePblRequestFromState };
export type { SubmitResult, UpdatePblIds };
