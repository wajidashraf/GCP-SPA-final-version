// src/forms/cpr/api.ts
// CPR (Contract Progress Report) submission flow:
//   1. POST /_api/gcp_requests        — parent request row, bound to the selected
//      Project (gcp_Project) and Company (gcp_Company). Project name/code and the
//      acknowledgement live here.
//   2. POST /_api/gcp_cprrequestgcps  — CPR details (EOT / VO / Claims), bound to
//      (1) via `gcp_Request@odata.bind` plus the Project and Company lookups.
//      The child's acknowledgement column is `gcp_acknowledgementconfirmed`.

import { createRequest } from '../../shared/services/requestService';
import { createCprRequest } from '../../shared/services/cprRequestService';
import { serializeDocuments } from '../../shared/documents';
import type { DocumentLink } from '../../shared/documents';
import type { CreateGcpRequestInput } from '../../types/request';
import type { CreateGcpCprRequestInput } from '../../types/cprRequest';
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

export { submitCprRequest };
export type { SubmitResult, SubmitCprOptions };
