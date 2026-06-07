// src/forms/ci/api.ts
// CI (Contractual Issue Relating to Payment) submission flow:
//   1. POST /_api/gcp_requests       — parent request row, bound to the selected
//      Project (gcp_Project) and Company (gcp_Company). Project name/code and the
//      acknowledgement live here.
//   2. POST /_api/gcp_requestcigcps  — CI details, bound to (1) via
//      `gcp_Request@odata.bind` plus the Project and Company lookups.
//      gcp_company is REQUIRED on the child, so companyAccountId must be present.

import { createRequest } from '../../shared/services/requestService';
import { createCiRequest } from '../../shared/services/ciRequestService';
import { serializeDocuments } from '../../shared/documents';
import type { DocumentLink } from '../../shared/documents';
import type { CreateGcpRequestInput } from '../../types/request';
import type { CreateGcpCiRequestInput } from '../../types/ciRequest';
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

export { submitCiRequest };
export type { SubmitResult, SubmitCiOptions };
