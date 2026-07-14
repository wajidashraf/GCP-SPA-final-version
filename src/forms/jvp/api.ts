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

import {
  createRequest,
  updateRequest,
} from '../../shared/services/requestService';
import {
  createJvpRequest,
  updateJvpRequest,
} from '../../shared/services/jvpRequestService';
import { serializeDocuments } from '../../shared/documents';
import type { DocumentLink } from '../../shared/documents';
import type { CreateGcpRequestInput, GcpRequest } from '../../types/request';
import type {
  CreateGcpJvpRequestInput,
  GcpJvpRequest,
} from '../../types/jvpRequest';
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

// ── Edit mode ────────────────────────────────────────────────────────────────
// Reverse of the create mapping above: hydrate the form state from a loaded
// parent gcp_request + gcp_jvmrequest child, then PATCH the editable fields
// back. Requestor/Company lookups are never rebound and gcp_requestoremail is
// never PATCHed — the original requestor's identity must survive edits by
// Reviewers/Verifiers. The Project lookup IS rebound (the Project select stays
// editable in edit mode).

/** Build JVP form state from the loaded parent + child records (edit prefill). */
const loadJvpFormState = (
  request: GcpRequest,
  jvp: GcpJvpRequest
): JvpFormState => ({
  matterValue: request.matter as JvpFormState['matterValue'],
  categoryValue: (request.category ?? 2) as JvpFormState['categoryValue'],
  // Mirror new mode: the requestor select's value is the email, the label the name.
  requestorContactId: request.requestorEmail ?? '',
  requestorName: request.requestorName ?? '',
  requestorEmail: request.requestorEmail ?? '',
  companyId: request.companyId ?? '',
  companyName: request.companyName ?? '',
  projectId: jvp.projectId ?? '',
  projectName: request.projectName ?? '',
  projectCode: request.projectCode ?? '',

  picTeamLeader: jvp.picTeamLeader ?? '',
  picFinancialMatters: jvp.picFinancialMatters ?? '',
  picTechnicalMatters: jvp.picTechnicalMatters ?? '',
  picContractMatters: jvp.picContractMatters ?? '',
  picProcurementMatters: jvp.picProcurementMatters ?? '',
  picCostingEstimation: jvp.picCostingEstimation ?? '',
  picImplementationStage: jvp.picImplementationStage ?? '',

  backgroundOfCollaboration: jvp.backgroundOfCollaboration ?? '',
  scopeOfCollaboration: jvp.scopeOfCollaboration ?? '',
  proposedStructure: jvp.proposedStructure ?? '',

  keyTerms: jvp.keyTerms ?? '',
  financialOverview: jvp.financialOverview ?? '',
  technicalCapabilitiesResources: jvp.technicalCapabilitiesResources ?? '',

  workPackagesDivisionOfResponsibilities:
    jvp.workPackagesDivisionOfResponsibilities ?? '',
  resourceContribution: jvp.resourceContribution ?? '',
  riskReviewMitigation: jvp.riskReviewMitigation ?? '',

  acknowledged: request.acknowledged ?? false,
});

type UpdateJvpIds = {
  /** Parent gcp_request GUID. */
  requestId: string;
  /** Child gcp_jvmrequest GUID. */
  jvpRecordId: string;
  /**
   * Final document set to persist on gcp_request.gcp_documentsurl (kept
   * existing links + new uploads). When omitted, the column is left untouched.
   */
  documents?: DocumentLink[];
};

/**
 * Save edits: PATCH the editable fields on the parent request and the JVP
 * child. Does NOT change gcp_requeststatus (stays RS / Resubmit) and never
 * touches the Requestor/Company lookups or gcp_requestoremail.
 */
const updateJvpRequestFromState = async (
  state: JvpFormState,
  ids: UpdateJvpIds
): Promise<void> => {
  const projectId = state.projectId || null;

  // Parent gcp_request — project fields + acknowledgement (+ documents).
  await updateRequest(
    ids.requestId,
    {
      gcp_project_name: state.projectName || null,
      gcp_projectcode: state.projectCode || null,
      gcp_acknowledgement: state.acknowledged,
      ...(ids.documents
        ? { gcp_documentsurl: serializeDocuments(ids.documents) }
        : {}),
    },
    { lookups: { projectId } }
  );

  // Child gcp_jvmrequest — same editable column set as the create mapping.
  await updateJvpRequest(
    ids.jvpRecordId,
    {
      gcp_pic_team_leader: orNull(state.picTeamLeader),
      gcp_picfinancialmatters: orNull(state.picFinancialMatters),
      gcp_pictechnicalmatters: orNull(state.picTechnicalMatters),
      gcp_piccontractmatters: orNull(state.picContractMatters),
      gcp_picprocurementmatters: orNull(state.picProcurementMatters),
      gcp_piccostingestimation: orNull(state.picCostingEstimation),
      gcp_picimplementationstage: orNull(state.picImplementationStage),
      gcp_backgroundofcollaboration: orNull(state.backgroundOfCollaboration),
      gcp_scope_of_collaboration: orNull(state.scopeOfCollaboration),
      gcp_proposed_structure: orNull(state.proposedStructure),
      gcp_key_terms: orNull(state.keyTerms),
      gcp_financialoverview: orNull(state.financialOverview),
      gcp_technical_capabilities_resources: orNull(
        state.technicalCapabilitiesResources
      ),
      gcp_workpackages_divisionofresponsibilities: orNull(
        state.workPackagesDivisionOfResponsibilities
      ),
      gcp_resourcecontributionmanpowerdesigntoolset: orNull(
        state.resourceContribution
      ),
      gcp_risk_review_mitigation: orNull(state.riskReviewMitigation),
    },
    { lookups: { projectId } }
  );
};

export { submitJvpRequest, loadJvpFormState, updateJvpRequestFromState };
export type { SubmitResult, SubmitJvpOptions, UpdateJvpIds };
