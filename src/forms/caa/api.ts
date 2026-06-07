// src/forms/caa/api.ts
// CAA (Client Acceptance of Award) submission flow:
//   1. POST /_api/gcp_requests     — parent request row, bound to the selected
//      Project (gcp_Project) and Company (gcp_Company). Acknowledgement lives here.
//   2. POST /_api/gcp_caarequests  — CAA details, bound to (1) via
//      `gcp_Request@odata.bind` plus the Project and Company lookups.
//
// Uploaded files (e.g. the project org & manpower chart) are stored in
// SharePoint by the upload Function and their links are persisted on the parent
// request's gcp_documentsurl column, tagged with the field they belong to.

import { createRequest } from '../../shared/services/requestService';
import { createCaaRequest } from '../../shared/services/caaRequestService';
import { serializeDocuments } from '../../shared/documents';
import type { DocumentLink } from '../../shared/documents';
import type { CreateGcpRequestInput } from '../../types/request';
import type { CreateGcpCaaRequestInput } from '../../types/caaRequest';
import type { SoaCodeValue } from '../../data/soaChoices';
import type { CaaFormState } from './types';

type SubmitResult = {
  requestId: string;
  caaRequestId: string;
};

// SOA code "CAA" maps to value 5 in soaCodeChoices.
const resolveSoaCodeForCaa = (): SoaCodeValue => 5;

/** Collapse empty/whitespace text to null so we don't store blank strings. */
const orNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/** Parse a numeric form value to a number, or null when empty / not a number. */
const orNum = (value: string): number | null => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
};

/** Convert a yyyy-mm-dd date input to an ISO datetime string, or null. */
const orDate = (value: string): string | null =>
  value ? new Date(value).toISOString() : null;

type SubmitCaaOptions = {
  /** Logged-in user's contact GUID for the gcp_RequestorName lookup. The form's
   *  `requestorContactId` field holds an email (used only for the UI select), so
   *  the real contact GUID must be passed here — otherwise the contact lookup is
   *  skipped and the Contact-scoped table permission denies later associations. */
  requestorContactId?: string | null;
  /** Uploaded document links to persist on the request's gcp_documentsurl. */
  documents?: DocumentLink[];
};

const submitCaaRequest = async (
  data: CaaFormState,
  options: SubmitCaaOptions = {}
): Promise<SubmitResult> => {
  const companyAccountId = data.companyId || null;
  const projectId = data.projectId || null;

  // Step 1 — parent gcp_request
  const parentInput: CreateGcpRequestInput = {
    gcp_category: data.categoryValue,
    gcp_mattertype: data.matterValue,
    gcp_soacode: resolveSoaCodeForCaa(),
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

  // Step 2 — gcp_caarequest bound to the parent. DynamicRowFields inputs are
  // already JSON strings in form state, so they persist as-is.
  // (This table has no gcp_soacode column — SOA code lives on gcp_request.)
  const caaInput: CreateGcpCaaRequestInput = {
    gcp_title: data.projectName || null,
    // Project code now lives on the parent gcp_request (gcp_projectcode), set above.

    // Step 2 — Cost Information
    gcp_tenderproposalpriceduringsubmissionoftend: orNum(data.tenderProposalPrice),
    gcp_finalcontractamount: orNum(data.finalContractAmount),
    gcp_estimatedbudgetcost: orNum(data.estimatedBudgetCost),
    gcp_estimatedmargin: orNum(data.estimatedMargin),
    gcp_tenderproposalrefno: orNull(data.tenderProposalRefNo),
    gcp_letterofawardloa: orDate(data.letterOfAwardDate),
    gcp_contractcommencement: orDate(data.contractCommencementDate),
    gcp_contractcompletiondate: orDate(data.contractCompletionDate),
    gcp_contractperioddays: orNum(data.contractPeriodDays),

    // Step 3 — CAA Information
    gcp_performancebondpbforproject: orNull(data.performanceBond),
    gcp_stampdutyinclusiveoflegalcostandfees: orNum(data.stampDuty),
    gcp_insurance: orNull(data.insurance),
    gcp_bumiputeraparticipation: orNull(data.bumiputeraParticipation),
    gcp_formationofjvcompany: orNull(data.formationOfJvCompany),
    gcp_criticalactivitymilestone: orNull(data.criticalActivitiesMilestones),
    gcp_defectliabilityperioddlp: orNull(data.defectLiabilityPeriod),

    // Step 4 — CAA Information
    gcp_liquidateddamagesladrate: orNum(data.liquidatedDamagesRate),
    gcp_paymentterm: orNull(data.paymentTerm),
    gcp_typeofcontract: orNull(data.typeOfContract),
    gcp_formofcontractconditionofcontract: orNull(data.formOfContract),
    gcp_projectdirectorpd: orNull(data.projectDirector),
    gcp_contactpersonatsitedesignationcontactno: orNull(data.contactPersonAtSite),

    // Step 5 — CAA Information (JSON)
    gcp_claimmanagementclaimapplicationprocess: orNull(data.claimApplicationProcess),
    gcp_claimmanagementclaimcertificationprocess: orNull(
      data.claimCertificationProcess
    ),
    gcp_changemanagementvariationorderapplicationpr: orNull(
      data.variationOrderApplicationProcess
    ),

    // Step 6 — CAA Information (JSON)
    gcp_changemanagementextensionoftimeapplication: orNull(
      data.extensionOfTimeApplicationProcess
    ),
    gcp_commissioningandcompletionmanagementsystems: orNull(
      data.commissioningCompletionSystems
    ),
    gcp_keydeliverymilestone: orNull(data.keyDeliveryMilestone),

    // Step 7 — CAA Information (JSON)
    gcp_mandatorytestingrequiredtocommission: orNull(data.mandatoryTesting),
    gcp_documentrequiredforcontractualacceptanceofpr: orNull(
      data.documentForContractualAcceptance
    ),
    gcp_prerequisitedocumentsforcompletionofdlp: orNull(
      data.prerequisiteDocumentsForDlp
    ),

    // Step 8 — Acknowledgement (mirrored on child; required bit on this table)
    gcp_acknowledgement: data.acknowledged,
  };

  const caaCreated = await createCaaRequest(caaInput, {
    lookups: {
      requestId: created.id,
      projectId,
      companyAccountId,
    },
  });

  return {
    requestId: created.id,
    caaRequestId: caaCreated.id,
  };
};

export { submitCaaRequest };
export type { SubmitResult, SubmitCaaOptions };
