// src/forms/stsp/api.ts
// ST/SP (Submission of Tender / Proposal) submission flow:
//   1. POST /_api/gcp_requests       — parent request row, bound to the selected
//      Project (gcp_Project) and Company (gcp_Company). Acknowledgement lives here.
//   2. POST /_api/gcp_stsprequests   — ST/SP details, bound to (1) via
//      `gcp_Request@odata.bind` plus the Project lookup.
//
// The "Contract Structure Image" upload is stored in SharePoint by the upload
// Function; its link is persisted on the parent request's gcp_documentsurl
// column, tagged with the field it belongs to.

import { createRequest } from '../../shared/services/requestService';
import { createStspRequest } from '../../shared/services/stspRequestService';
import { serializeDocuments } from '../../shared/documents';
import type { DocumentLink } from '../../shared/documents';
import type { CreateGcpRequestInput } from '../../types/request';
import type { CreateGcpStspRequestInput } from '../../types/stspRequest';
import type { SoaCodeValue } from '../../data/soaChoices';
import type { StspFormState } from './types';

type SubmitResult = {
  requestId: string;
  stspRequestId: string;
};

// SOA code "ST/SP" maps to value 4 in soaCodeChoices.
const resolveSoaCodeForStsp = (): SoaCodeValue => 4;

/** Collapse empty/whitespace text to null so we don't store blank strings. */
const orNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

type SubmitStspOptions = {
  /** Logged-in user's contact GUID for the gcp_RequestorName lookup. The form's
   *  `requestorContactId` field holds an email (used only for the UI select), so
   *  the real contact GUID must be passed here — otherwise the contact lookup is
   *  skipped and the Contact-scoped table permission denies later associations. */
  requestorContactId?: string | null;
  /** Uploaded document links to persist on the request's gcp_documentsurl. */
  documents?: DocumentLink[];
};

const submitStspRequest = async (
  data: StspFormState,
  options: SubmitStspOptions = {}
): Promise<SubmitResult> => {
  const companyAccountId = data.companyId || null;
  const projectId = data.projectId || null;

  // Step 1 — parent gcp_request
  const parentInput: CreateGcpRequestInput = {
    gcp_category: data.categoryValue,
    gcp_mattertype: data.matterValue,
    gcp_soacode: resolveSoaCodeForStsp(),
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

  // Step 2 — gcp_stsprequest bound to the parent. Repeatable / dynamic-table
  // inputs are already JSON strings in form state, so they persist as-is.
  // (This table has no gcp_soacode column — SOA code lives on gcp_request.)
  const stspInput: CreateGcpStspRequestInput = {
    // Step 2 — Project details
    gcp_tenderproposalsubmissiondate: data.tenderProposalSubmissionDate
      ? new Date(data.tenderProposalSubmissionDate).toISOString()
      : null,
    gcp_tendervalidityperiod: orNull(data.tenderValidityPeriod),

    // Step 3 — PIC
    gcp_teamleader: orNull(data.picTeamLeader),
    gcp_financialmatters: orNull(data.picFinancialMatters),
    gcp_technicalmatters: orNull(data.picTechnicalMatters),
    gcp_contractmatters: orNull(data.picContractMatters),
    gcp_procurementmatters: orNull(data.picProcurementMatters),
    gcp_costingandestimationmatters: orNull(
      data.picCostingAndEstimationMatters
    ),
    gcp_implementationstage: orNull(data.picImplementationStage),

    // Step 4 — ST/SP Information
    gcp_backgroundreview: orNull(data.backgroundReview),
    gcp_scopeofworks: orNull(data.scopeOfWorks),
    gcp_keyterms: orNull(data.keyTerms),
    gcp_financials: orNull(data.financials),

    // Step 5 — ST/SP Information
    gcp_technical: orNull(data.technical),
    gcp_procurementstrategyworkpackages: orNull(
      data.procurementStrategyWorkPackages
    ),
    gcp_sourcingreference: orNull(data.sourcingReference),
    gcp_costbreakdown: orNull(data.costBreakdown),
    gcp_riskidentificationmitigationplan: orNull(
      data.riskIdentificationMitigationPlan
    ),
  };

  const stspCreated = await createStspRequest(stspInput, {
    lookups: {
      requestId: created.id,
      projectId,
    },
  });

  return {
    requestId: created.id,
    stspRequestId: stspCreated.id,
  };
};

export { submitStspRequest };
export type { SubmitResult, SubmitStspOptions };
