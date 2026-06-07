// src/forms/jvp/api.ts
// JVP (JV / Partnership) submission flow:
//   1. POST /_api/gcp_requests      — parent request row, bound to the selected
//      Project (gcp_Project) and Company (gcp_Company). Acknowledgement lives here.
//   2. POST /_api/gcp_jvprequests   — JVP details, bound to (1) via
//      `gcp_Request@odata.bind` plus the Project lookup.
//
// The cashflow forecast and cost structure / breakdown file uploads are stored
// in SharePoint by the upload Function; their links are persisted on the parent
// request's gcp_documentsurl column, tagged with the field they belong to.

import { createRequest } from '../../shared/services/requestService';
import { createJvpRequest } from '../../shared/services/jvpRequestService';
import { serializeDocuments } from '../../shared/documents';
import type { DocumentLink } from '../../shared/documents';
import type { CreateGcpRequestInput } from '../../types/request';
import type { CreateGcpJvpRequestInput } from '../../types/jvpRequest';
import type { SoaCodeValue } from '../../data/soaChoices';
import type { JvpFormState } from './types';

type SubmitResult = {
  requestId: string;
  jvpRequestId: string;
};

// SOA code "JVP" maps to value 3 in soaCodeChoices.
const resolveSoaCodeForJvp = (): SoaCodeValue => 3;

/** Collapse empty/whitespace text to null so we don't store blank strings. */
const orNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

type SubmitJvpOptions = {
  /** Logged-in user's contact GUID for the gcp_RequestorName lookup. The form's
   *  `requestorContactId` field holds an email (used only for the UI select), so
   *  the real contact GUID must be passed here — otherwise the contact lookup is
   *  skipped and the Contact-scoped table permission denies later associations. */
  requestorContactId?: string | null;
  /** Uploaded document links to persist on the request's gcp_documentsurl. */
  documents?: DocumentLink[];
};

const submitJvpRequest = async (
  data: JvpFormState,
  options: SubmitJvpOptions = {}
): Promise<SubmitResult> => {
  const companyAccountId = data.companyId || null;
  const projectId = data.projectId || null;

  // Step 1 — parent gcp_request
  const parentInput: CreateGcpRequestInput = {
    gcp_category: data.categoryValue,
    gcp_mattertype: data.matterValue,
    gcp_soacode: resolveSoaCodeForJvp(),
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

  // Step 2 — gcp_jvmrequest bound to the parent. Repeatable / dynamic-table
  // inputs are already JSON strings in form state, so they persist as-is.
  // (This table has no gcp_soacode column — SOA code lives on gcp_request.)
  const jvpInput: CreateGcpJvpRequestInput = {
    // Step 2 — PIC
    gcp_pic_team_leader: orNull(data.picTeamLeader),
    gcp_picfinancialmatters: orNull(data.picFinancialMatters),
    gcp_pictechnicalmatters: orNull(data.picTechnicalMatters),
    gcp_piccontractmatters: orNull(data.picContractMatters),
    gcp_picprocurementmatters: orNull(data.picProcurementMatters),
    gcp_piccostingestimation: orNull(data.picCostingEstimation),
    gcp_picimplementationstage: orNull(data.picImplementationStage),

    // Step 3 — Collaboration
    gcp_backgroundofcollaboration: orNull(data.backgroundOfCollaboration),
    gcp_scope_of_collaboration: orNull(data.scopeOfCollaboration),
    gcp_proposed_structure: orNull(data.proposedStructure),

    // Step 4 — Key terms & financials
    gcp_key_terms: orNull(data.keyTerms),
    gcp_financialoverview: orNull(data.financialOverview),
    gcp_technical_capabilities_resources: orNull(
      data.technicalCapabilitiesResources
    ),

    // Step 5 — Work packages, resourcing & risk
    gcp_workpackages_divisionofresponsibilities: orNull(
      data.workPackagesDivisionOfResponsibilities
    ),
    gcp_resourcecontributionmanpowerdesigntoolset: orNull(
      data.resourceContribution
    ),
    gcp_risk_review_mitigation: orNull(data.riskReviewMitigation),
  };

  const jvpCreated = await createJvpRequest(jvpInput, {
    lookups: {
      requestId: created.id,
      projectId,
    },
  });

  return {
    requestId: created.id,
    jvpRequestId: jvpCreated.id,
  };
};

export { submitJvpRequest };
export type { SubmitResult, SubmitJvpOptions };
