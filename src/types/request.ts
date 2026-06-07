// src/types/request.ts
// TypeScript mirror of the gcp_request Dataverse table.
// Logical name: gcp_request   |   Entity set: gcp_requests   |   PK: gcp_requestid
//
// Choice value-union types are imported from src/data/*Choices.ts as required by
// CLAUDE.md — do NOT redefine choice integers here.

import type {
  DecisionCodeValue,
  OutcomeValue,
  RequestCategoryValue,
  RequestStatusValue,
} from '../data/requestChoices';
import type { MatterChoice } from '../data/matterChoices';
import type { SoaCodeValue } from '../data/soaChoices';

type MatterValue = MatterChoice['value'];

// ── Raw OData entity (as it comes back from /_api/gcp_requests) ─────────────
// Lookups appear as `_<logicalname>_value` on GET, plus an optional FormattedValue.
type GcpRequestEntity = {
  '@odata.etag'?: string;

  gcp_requestid?: string;
  gcp_requesttitle?: string | null;
  gcp_requestoremail?: string | null;
  gcp_requeststatus?: RequestStatusValue | null;
  gcp_category?: RequestCategoryValue | null;
  gcp_mattertype?: MatterValue | null;
  gcp_soacode?: SoaCodeValue | null;
  gcp_outcome?: OutcomeValue | null;
  gcp_decisioncode?: DecisionCodeValue | null;
  gcp_routedecision?: number | null;
  gcp_type?: number | null;

  // Lookups (GUID values exposed via _value suffix)
  '_gcp_requestorname_value'?: string | null;
  '_gcp_company_value'?: string | null;
  '_gcp_project_value'?: string | null;
  '_gcp_reviewedby_value'?: string | null;
  '_gcp_verified_by_value'?: string | null;
  '_gcp_workinggcpc1_value'?: string | null;
  '_gcp_workinggcpc2_value'?: string | null;
  '_gcp_workinggcpc3_value'?: string | null;
  '_gcp_workinggcpc4_value'?: string | null;

  // Strings
  gcp_companycode?: string | null;
  gcp_project_name?: string | null;
  gcp_projectcode?: string | null;
  gcp_projectdiscription?: string | null;
  gcp_erpdocumentno?: string | null;
  gcp_sharepointfolderurl?: string | null;
  /** JSON array of uploaded document links (see shared/documents.ts). */
  gcp_documentsurl?: string | null;
  gcp_status?: string | null;
  gcp_reviewno?: string | null;
  gcp_workinggcpcgroup?: string | null;
  gcp_workinggcpclickbyuser1?: string | null;
  gcp_workinggcpclickbyuser2?: string | null;
  gcp_workinggcpclickbyuser3?: string | null;

  // Memos
  gcp_acklettertextcontent?: string | null;
  gcp_endorselettertextcontent?: string | null;
  gcp_notes?: string | null;
  gcp_infoandcriteriaforreview?: string | null;
  gcp_signature?: string | null;
  gcp_reviewercomments?: string | null;
  gcp_reviewconclusioncode1bcomment?: string | null;
  gcp_projectdescription?: string | null;
  gcp_verifier_comment?: string | null;

  // Booleans
  gcp_acknowledgement?: boolean | null;
  gcp_confidential?: boolean | null;
  gcp_documentsok?: boolean | null;
  gcp_isprojectcreated?: boolean | null;
  gcp_reviewconclusioncode1a?: boolean | null;
  gcp_reviewconclusioncode1b?: boolean | null;
  gcp_reviewconclusioncode2?: boolean | null;
  gcp_reviewconclusioncode3?: boolean | null;
  gcp_reviewconclusioncode4?: boolean | null;

  // Integers
  gcp_documentcount?: number | null;
  gcp_engagementnumber?: number | null;
  gcp_reworkcount?: number | null;
  gcp_workinggcpclickcount?: number | null;

  // Datetimes (ISO strings on the wire)
  gcp_acceptancedate?: string | null;
  gcp_acknowledgementdate?: string | null;
  gcp_endorsementdate?: string | null;
  gcp_lastupdateddate?: string | null;
  gcp_reviewdate?: string | null;
  gcp_submittedon?: string | null;
  gcp_verifydate?: string | null;

  createdon?: string;
  modifiedon?: string;
  statecode?: number;
  statuscode?: number;

  // OData formatted-value annotations (present when withFormattedValues=true)
  '_gcp_requestorname_value@OData.Community.Display.V1.FormattedValue'?: string;
  '_gcp_company_value@OData.Community.Display.V1.FormattedValue'?: string;
  '_gcp_project_value@OData.Community.Display.V1.FormattedValue'?: string;
  '_gcp_verified_by_value@OData.Community.Display.V1.FormattedValue'?: string;
  '_gcp_reviewedby_value@OData.Community.Display.V1.FormattedValue'?: string;
};

// ── Clean domain type used by the React UI ──────────────────────────────────
type GcpRequest = {
  id: string;
  title: string | null;
  requestorEmail: string | null;
  requestorName: string | null;
  requestorContactId: string | null;
  companyId: string | null;
  companyCode: string | null;
  companyName: string | null;

  status: RequestStatusValue | null;
  category: RequestCategoryValue | null;
  matter: MatterValue | null;
  soaCode: SoaCodeValue | null;
  outcome: OutcomeValue | null;
  decisionCode: DecisionCodeValue | null;

  projectName: string | null;
  projectCode: string | null;
  projectDescription: string | null;
  notes: string | null;
  /** Raw JSON of uploaded document links; parse with shared/documents.ts. */
  documentsUrl: string | null;

  acknowledged: boolean | null;
  confidential: boolean | null;
  documentsOk: boolean | null;

  /** HOC conclusion code fields (set during HOC Acceptance, status 6→8). */
  reviewCode1a: boolean | null;
  reviewCode1b: boolean | null;
  reviewCode1bComment: string | null;
  reviewCode2: boolean | null;
  reviewCode3: boolean | null;

  /** Acknowledgement letter body (gcp_acklettertextcontent). */
  ackLetterText: string | null;
  /** Endorsement letter body (gcp_endorselettertextcontent). */
  endorsementLetterText: string | null;

  submittedOn: string | null;
  acknowledgementDate: string | null;
  acceptanceDate: string | null;
  endorsementDate: string | null;
  reviewDate: string | null;

  createdOn?: string;
  modifiedOn?: string;
};

// ── Input shapes for mutations ──────────────────────────────────────────────
// Lookups MUST be written via `<NavProperty>@odata.bind`, never to `_value`.
// Navigation property names are the PascalCase schema names from customizations.xml:
//   gcp_RequestorName → contacts(<guid>)
//   gcp_Company       → accounts(<guid>)
//   gcp_Project       → gcp_projects(<guid>)
type CreateGcpRequestInput = {
  gcp_requesttitle?: string | null;
  gcp_requestoremail?: string | null;
  gcp_category?: RequestCategoryValue | null;
  gcp_mattertype?: MatterValue | null;
  gcp_soacode?: SoaCodeValue | null;
  gcp_requeststatus?: RequestStatusValue | null;
  gcp_submittedon?: string | null;
  gcp_project_name?: string | null;
  gcp_projectcode?: string | null;
  gcp_projectdiscription?: string | null;
  gcp_companycode?: string | null;
  gcp_confidential?: boolean | null;
  gcp_acknowledgement?: boolean | null;
  gcp_notes?: string | null;
  /** JSON array of uploaded document links (see shared/documents.ts). */
  gcp_documentsurl?: string | null;
  // Lookups
  'gcp_RequestorName@odata.bind'?: string;
  'gcp_Company@odata.bind'?: string;
  'gcp_Project@odata.bind'?: string;
};

type UpdateGcpRequestInput = Partial<CreateGcpRequestInput> & {
  gcp_outcome?: OutcomeValue | null;
  gcp_decisioncode?: DecisionCodeValue | null;
  gcp_reviewdate?: string | null;
  gcp_acknowledgementdate?: string | null;
  gcp_acceptancedate?: string | null;
  gcp_endorsementdate?: string | null;
  gcp_reviewercomments?: string | null;
  gcp_infoandcriteriaforreview?: string | null;
  gcp_documentsok?: boolean | null;
  // Reviewer lookup → contacts. Nav property mirrors `_gcp_reviewedby_value`.
  'gcp_Reviewedby@odata.bind'?: string;
};

// ── Entity → domain mapper ──────────────────────────────────────────────────
const mapGcpRequest = (e: GcpRequestEntity): GcpRequest => ({
  id: e.gcp_requestid ?? '',
  title: e.gcp_requesttitle ?? null,
  requestorEmail: e.gcp_requestoremail ?? null,
  requestorName:
    e['_gcp_requestorname_value@OData.Community.Display.V1.FormattedValue'] ??
    null,
  requestorContactId: e['_gcp_requestorname_value'] ?? null,
  companyId: e['_gcp_company_value'] ?? null,
  companyCode: e.gcp_companycode ?? null,
  companyName:
    e['_gcp_company_value@OData.Community.Display.V1.FormattedValue'] ?? null,

  status: (e.gcp_requeststatus ?? null) as RequestStatusValue | null,
  category: (e.gcp_category ?? null) as RequestCategoryValue | null,
  matter: (e.gcp_mattertype ?? null) as MatterValue | null,
  soaCode: (e.gcp_soacode ?? null) as SoaCodeValue | null,
  outcome: (e.gcp_outcome ?? null) as OutcomeValue | null,
  decisionCode: (e.gcp_decisioncode ?? null) as DecisionCodeValue | null,

  projectName: e.gcp_project_name ?? null,
  projectCode: e.gcp_projectcode ?? null,
  projectDescription: e.gcp_projectdiscription ?? null,
  notes: e.gcp_notes ?? null,
  documentsUrl: e.gcp_documentsurl ?? null,

  acknowledged: e.gcp_acknowledgement ?? null,
  confidential: e.gcp_confidential ?? null,
  documentsOk: e.gcp_documentsok ?? null,

  reviewCode1a: e.gcp_reviewconclusioncode1a ?? null,
  reviewCode1b: e.gcp_reviewconclusioncode1b ?? null,
  reviewCode1bComment: e.gcp_reviewconclusioncode1bcomment ?? null,
  reviewCode2: e.gcp_reviewconclusioncode2 ?? null,
  reviewCode3: e.gcp_reviewconclusioncode3 ?? null,

  ackLetterText: e.gcp_acklettertextcontent ?? null,
  endorsementLetterText: e.gcp_endorselettertextcontent ?? null,

  submittedOn: e.gcp_submittedon ?? null,
  acknowledgementDate: e.gcp_acknowledgementdate ?? null,
  acceptanceDate: e.gcp_acceptancedate ?? null,
  endorsementDate: e.gcp_endorsementdate ?? null,
  reviewDate: e.gcp_reviewdate ?? null,

  createdOn: e.createdon,
  modifiedOn: e.modifiedon,
});

// Default $select used by list/get — keep narrow on purpose; callers can extend.
const DEFAULT_REQUEST_SELECT: readonly string[] = [
  'gcp_requestid',
  'gcp_requesttitle',
  'gcp_requestoremail',
  'gcp_requeststatus',
  'gcp_category',
  'gcp_mattertype',
  'gcp_soacode',
  'gcp_outcome',
  'gcp_decisioncode',
  'gcp_companycode',
  'gcp_project_name',
  'gcp_projectcode',
  'gcp_projectdiscription',
  'gcp_documentsurl',
  'gcp_submittedon',
  'gcp_acknowledgement',
  'gcp_confidential',
  'gcp_documentsok',
  'gcp_reviewconclusioncode1a',
  'gcp_reviewconclusioncode1b',
  'gcp_reviewconclusioncode1bcomment',
  'gcp_reviewconclusioncode2',
  'gcp_reviewconclusioncode3',
  'gcp_acklettertextcontent',
  'gcp_endorselettertextcontent',
  'gcp_reviewdate',
  'gcp_acceptancedate',
  'gcp_acknowledgementdate',
  'gcp_endorsementdate',
  '_gcp_requestorname_value',
  '_gcp_company_value',
  '_gcp_project_value',
  'createdon',
  'modifiedon',
];

export { mapGcpRequest, DEFAULT_REQUEST_SELECT };
export type {
  GcpRequest,
  GcpRequestEntity,
  CreateGcpRequestInput,
  UpdateGcpRequestInput,
};
