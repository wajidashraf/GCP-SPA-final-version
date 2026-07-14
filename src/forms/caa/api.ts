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

import {
  createRequest,
  updateRequest,
} from '../../shared/services/requestService';
import {
  createCaaRequest,
  updateCaaRequest,
} from '../../shared/services/caaRequestService';
import { serializeDocuments } from '../../shared/documents';
import type { DocumentLink } from '../../shared/documents';
import type { CreateGcpRequestInput, GcpRequest } from '../../types/request';
import type {
  CreateGcpCaaRequestInput,
  GcpCaaRequest,
} from '../../types/caaRequest';
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

// ── Edit mode ────────────────────────────────────────────────────────────────
// Reverse of the create mapping above: hydrate the form state from a loaded
// parent gcp_request + gcp_caarequest child, then PATCH the editable fields
// back. Requestor/Company lookups are never rebound and gcp_requestoremail is
// never PATCHed — the original requestor's identity must survive edits by
// Reviewers/Verifiers. The Project lookup IS rebound (the Project select stays
// editable in edit mode).

/** Number column → form string (empty when null). */
const numToStr = (value: number | null): string =>
  value == null ? '' : String(value);

/** Currency column → form string with the CurrencyField's fixed 2 decimals. */
const currencyToStr = (value: number | null): string =>
  value == null ? '' : value.toFixed(2);

/** ISO datetime column → yyyy-mm-dd for a <input type="date"> field. */
const dateToStr = (value: string | null): string =>
  value ? value.slice(0, 10) : '';

/** Build CAA form state from the loaded parent + child records (edit prefill). */
const loadCaaFormState = (
  request: GcpRequest,
  caa: GcpCaaRequest
): CaaFormState => ({
  matterValue: request.matter as CaaFormState['matterValue'],
  categoryValue: (request.category ?? 2) as CaaFormState['categoryValue'],
  // Mirror new mode: the requestor select's value is the email, the label the name.
  requestorContactId: request.requestorEmail ?? '',
  requestorName: request.requestorName ?? '',
  requestorEmail: request.requestorEmail ?? '',
  companyId: request.companyId ?? '',
  companyName: request.companyName ?? '',
  projectId: caa.projectId ?? '',
  projectName: request.projectName ?? caa.title ?? '',
  projectCode: request.projectCode ?? caa.projectCode ?? '',

  tenderProposalPrice: currencyToStr(caa.tenderProposalPrice),
  finalContractAmount: currencyToStr(caa.finalContractAmount),
  estimatedBudgetCost: currencyToStr(caa.estimatedBudgetCost),
  estimatedMargin: numToStr(caa.estimatedMargin),
  tenderProposalRefNo: caa.tenderProposalRefNo ?? '',
  letterOfAwardDate: dateToStr(caa.letterOfAwardDate),
  contractCommencementDate: dateToStr(caa.contractCommencementDate),
  contractCompletionDate: dateToStr(caa.contractCompletionDate),
  contractPeriodDays: numToStr(caa.contractPeriodDays),

  performanceBond: caa.performanceBond ?? '',
  stampDuty: numToStr(caa.stampDuty),
  insurance: caa.insurance ?? '',
  bumiputeraParticipation: caa.bumiputeraParticipation ?? '',
  formationOfJvCompany: caa.formationOfJvCompany ?? '',
  criticalActivitiesMilestones: caa.criticalActivitiesMilestones ?? '',
  defectLiabilityPeriod: caa.defectLiabilityPeriod ?? '',

  liquidatedDamagesRate: numToStr(caa.liquidatedDamagesRate),
  paymentTerm: caa.paymentTerm ?? '',
  typeOfContract: caa.typeOfContract ?? '',
  formOfContract: caa.formOfContract ?? '',
  projectDirector: caa.projectDirector ?? '',
  contactPersonAtSite: caa.contactPersonAtSite ?? '',

  claimApplicationProcess: caa.claimApplicationProcess ?? '',
  claimCertificationProcess: caa.claimCertificationProcess ?? '',
  variationOrderApplicationProcess: caa.variationOrderApplicationProcess ?? '',

  extensionOfTimeApplicationProcess:
    caa.extensionOfTimeApplicationProcess ?? '',
  commissioningCompletionSystems: caa.commissioningCompletionSystems ?? '',
  keyDeliveryMilestone: caa.keyDeliveryMilestone ?? '',

  mandatoryTesting: caa.mandatoryTesting ?? '',
  documentForContractualAcceptance:
    caa.documentForContractualAcceptance ?? '',
  prerequisiteDocumentsForDlp: caa.prerequisiteDocumentsForDlp ?? '',

  acknowledged: request.acknowledged ?? caa.acknowledged ?? false,
});

type UpdateCaaIds = {
  /** Parent gcp_request GUID. */
  requestId: string;
  /** Child gcp_caarequest GUID. */
  caaRecordId: string;
  /**
   * Final document set to persist on gcp_request.gcp_documentsurl (kept
   * existing links + new uploads). When omitted, the column is left untouched.
   */
  documents?: DocumentLink[];
};

/**
 * Save edits: PATCH the editable fields on the parent request and the CAA
 * child. Does NOT change gcp_requeststatus (stays RS / Resubmit) and never
 * touches the Requestor/Company lookups or gcp_requestoremail.
 */
const updateCaaRequestFromState = async (
  state: CaaFormState,
  ids: UpdateCaaIds
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

  // Child gcp_caarequest — same editable column set as the create mapping.
  // The Company lookup is deliberately NOT rebound (locked identity).
  await updateCaaRequest(
    ids.caaRecordId,
    {
      gcp_title: state.projectName || null,

      gcp_tenderproposalpriceduringsubmissionoftend: orNum(
        state.tenderProposalPrice
      ),
      gcp_finalcontractamount: orNum(state.finalContractAmount),
      gcp_estimatedbudgetcost: orNum(state.estimatedBudgetCost),
      gcp_estimatedmargin: orNum(state.estimatedMargin),
      gcp_tenderproposalrefno: orNull(state.tenderProposalRefNo),
      gcp_letterofawardloa: orDate(state.letterOfAwardDate),
      gcp_contractcommencement: orDate(state.contractCommencementDate),
      gcp_contractcompletiondate: orDate(state.contractCompletionDate),
      gcp_contractperioddays: orNum(state.contractPeriodDays),

      gcp_performancebondpbforproject: orNull(state.performanceBond),
      gcp_stampdutyinclusiveoflegalcostandfees: orNum(state.stampDuty),
      gcp_insurance: orNull(state.insurance),
      gcp_bumiputeraparticipation: orNull(state.bumiputeraParticipation),
      gcp_formationofjvcompany: orNull(state.formationOfJvCompany),
      gcp_criticalactivitymilestone: orNull(state.criticalActivitiesMilestones),
      gcp_defectliabilityperioddlp: orNull(state.defectLiabilityPeriod),

      gcp_liquidateddamagesladrate: orNum(state.liquidatedDamagesRate),
      gcp_paymentterm: orNull(state.paymentTerm),
      gcp_typeofcontract: orNull(state.typeOfContract),
      gcp_formofcontractconditionofcontract: orNull(state.formOfContract),
      gcp_projectdirectorpd: orNull(state.projectDirector),
      gcp_contactpersonatsitedesignationcontactno: orNull(
        state.contactPersonAtSite
      ),

      gcp_claimmanagementclaimapplicationprocess: orNull(
        state.claimApplicationProcess
      ),
      gcp_claimmanagementclaimcertificationprocess: orNull(
        state.claimCertificationProcess
      ),
      gcp_changemanagementvariationorderapplicationpr: orNull(
        state.variationOrderApplicationProcess
      ),

      gcp_changemanagementextensionoftimeapplication: orNull(
        state.extensionOfTimeApplicationProcess
      ),
      gcp_commissioningandcompletionmanagementsystems: orNull(
        state.commissioningCompletionSystems
      ),
      gcp_keydeliverymilestone: orNull(state.keyDeliveryMilestone),

      gcp_mandatorytestingrequiredtocommission: orNull(state.mandatoryTesting),
      gcp_documentrequiredforcontractualacceptanceofpr: orNull(
        state.documentForContractualAcceptance
      ),
      gcp_prerequisitedocumentsforcompletionofdlp: orNull(
        state.prerequisiteDocumentsForDlp
      ),

      gcp_acknowledgement: state.acknowledged,
    },
    { lookups: { projectId } }
  );
};

export { submitCaaRequest, loadCaaFormState, updateCaaRequestFromState };
export type { SubmitResult, SubmitCaaOptions, UpdateCaaIds };
