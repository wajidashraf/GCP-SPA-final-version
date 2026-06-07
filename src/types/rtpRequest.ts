// src/types/rtpRequest.ts
// TypeScript mirror of the gcp_rtprequest Dataverse table (child of gcp_request).
//
// Logical name : gcp_rtprequest
// Entity set   : gcp_rtprequests
// Primary key  : gcp_rtprequestid
// Primary name : gcp_proposalname (autonumber RTP-{SEQNUM:4}, server-assigned)
//
// Lookup navigation properties (PascalCase PhysicalName from customizations.xml — case-sensitive):
//   gcp_Request      → gcp_requests(<guid>)
//   gcp_Company      → accounts(<guid>)
//   gcp_ClientsName  → contacts(<guid>)
//   gcp_Requester    → contacts(<guid>)
//   gcp_Verifiedby   → contacts(<guid>)
//
// Choice value-union types are imported from src/data/*Choices.ts per CLAUDE.md —
// do NOT redefine choice integers here.

import type {
  RegistrationTypeValue,
  RequestCategoryValue,
  RequestStatusValue,
} from '../data/requestChoices';
import type { MatterChoice } from '../data/matterChoices';

type MatterValue = MatterChoice['value'];

// gcp_formtype only has a single option in the XML: value=1 ("RTP form").
type FormTypeValue = 1;

// ── Raw OData entity (as it comes back from /_api/gcp_rtprequests) ──────────
type GcpRtpRequestEntity = {
  '@odata.etag'?: string;

  gcp_rtprequestid?: string;
  gcp_proposalname?: string | null; // autonumber RTP-{SEQNUM:4}

  // Text
  gcp_client_name_text?: string | null;
  gcp_projectcode?: string | null;
  gcp_projectname?: string | null;
  gcp_requesteremail?: string | null;

  // Memos
  gcp_projectdescription?: string | null;
  gcp_verifiercomments?: string | null;

  // Picklists
  gcp_category?: RequestCategoryValue | null;
  gcp_formtype?: FormTypeValue | null;
  gcp_matters?: MatterValue | null;
  gcp_registrationtype?: RegistrationTypeValue | null;
  gcp_requeststatus?: RequestStatusValue | null;

  // Booleans
  gcp_acknowledgement?: boolean | null;
  gcp_specialproject?: boolean | null;
  gcp_specialprojectwithapprovedwaiver?: boolean | null;

  // Dates (ISO strings on the wire; gcp_tenderclosingdate is DateOnly)
  gcp_tenderclosingdate?: string | null;

  // Lookups (GUIDs exposed via _value suffix on GET)
  '_gcp_request_value'?: string | null;
  '_gcp_company_value'?: string | null;
  '_gcp_clientsname_value'?: string | null;
  '_gcp_requester_value'?: string | null;
  '_gcp_verifiedby_value'?: string | null;

  createdon?: string;
  modifiedon?: string;
  statecode?: number;
  statuscode?: number;
};

// ── Clean domain type used by the React UI ──────────────────────────────────
type GcpRtpRequest = {
  id: string;
  proposalName: string | null;

  clientNameText: string | null;
  projectCode: string | null;
  projectName: string | null;
  projectDescription: string | null;
  requesterEmail: string | null;
  verifierComments: string | null;

  category: RequestCategoryValue | null;
  formType: FormTypeValue | null;
  matter: MatterValue | null;
  registrationType: RegistrationTypeValue | null;
  status: RequestStatusValue | null;

  acknowledged: boolean | null;
  specialProject: boolean | null;
  specialProjectWithApprovedWaiver: boolean | null;

  tenderClosingDate: string | null;

  // Lookup GUIDs
  requestId: string | null;
  companyId: string | null;
  clientsNameContactId: string | null;
  requesterContactId: string | null;
  verifiedByContactId: string | null;

  createdOn?: string;
  modifiedOn?: string;
};

// ── Input shapes for mutations ──────────────────────────────────────────────
// Lookups MUST be written via `<NavProperty>@odata.bind` (case-sensitive
// PascalCase schema names taken from `PhysicalName` in customizations.xml).
type CreateGcpRtpRequestInput = {
  // Text
  gcp_client_name_text?: string | null;
  gcp_projectcode?: string | null;
  gcp_projectname?: string | null;
  gcp_requesteremail?: string | null;
  // Memos
  gcp_projectdescription?: string | null;
  gcp_verifiercomments?: string | null;
  // Picklists
  gcp_category?: RequestCategoryValue | null;
  gcp_formtype?: FormTypeValue | null;
  gcp_matters?: MatterValue | null;
  gcp_registrationtype?: RegistrationTypeValue | null;
  gcp_requeststatus?: RequestStatusValue | null;
  // Booleans
  gcp_acknowledgement?: boolean | null;
  gcp_specialproject?: boolean | null;
  gcp_specialprojectwithapprovedwaiver?: boolean | null;
  // Dates
  gcp_tenderclosingdate?: string | null;
  // Lookups
  'gcp_Request@odata.bind'?: string;
  'gcp_Company@odata.bind'?: string;
  'gcp_ClientsName@odata.bind'?: string;
  'gcp_Requester@odata.bind'?: string;
  'gcp_Verifiedby@odata.bind'?: string;
};

type UpdateGcpRtpRequestInput = Partial<CreateGcpRtpRequestInput>;

// ── Entity → domain mapper ──────────────────────────────────────────────────
const mapGcpRtpRequest = (e: GcpRtpRequestEntity): GcpRtpRequest => ({
  id: e.gcp_rtprequestid ?? '',
  proposalName: e.gcp_proposalname ?? null,

  clientNameText: e.gcp_client_name_text ?? null,
  projectCode: e.gcp_projectcode ?? null,
  projectName: e.gcp_projectname ?? null,
  projectDescription: e.gcp_projectdescription ?? null,
  requesterEmail: e.gcp_requesteremail ?? null,
  verifierComments: e.gcp_verifiercomments ?? null,

  category: (e.gcp_category ?? null) as RequestCategoryValue | null,
  formType: (e.gcp_formtype ?? null) as FormTypeValue | null,
  matter: (e.gcp_matters ?? null) as MatterValue | null,
  registrationType: (e.gcp_registrationtype ?? null) as RegistrationTypeValue | null,
  status: (e.gcp_requeststatus ?? null) as RequestStatusValue | null,

  acknowledged: e.gcp_acknowledgement ?? null,
  specialProject: e.gcp_specialproject ?? null,
  specialProjectWithApprovedWaiver: e.gcp_specialprojectwithapprovedwaiver ?? null,

  tenderClosingDate: e.gcp_tenderclosingdate ?? null,

  requestId: e['_gcp_request_value'] ?? null,
  companyId: e['_gcp_company_value'] ?? null,
  clientsNameContactId: e['_gcp_clientsname_value'] ?? null,
  requesterContactId: e['_gcp_requester_value'] ?? null,
  verifiedByContactId: e['_gcp_verifiedby_value'] ?? null,

  createdOn: e.createdon,
  modifiedOn: e.modifiedon,
});

// Default $select used by list/get — narrow on purpose; callers can extend.
const DEFAULT_RTP_REQUEST_SELECT: readonly string[] = [
  'gcp_rtprequestid',
  'gcp_proposalname',
  'gcp_client_name_text',
  'gcp_projectcode',
  'gcp_projectname',
  'gcp_projectdescription',
  'gcp_requesteremail',
  'gcp_category',
  'gcp_formtype',
  'gcp_matters',
  'gcp_registrationtype',
  'gcp_requeststatus',
  'gcp_acknowledgement',
  'gcp_specialproject',
  'gcp_specialprojectwithapprovedwaiver',
  'gcp_tenderclosingdate',
  '_gcp_request_value',
  '_gcp_company_value',
  '_gcp_clientsname_value',
  '_gcp_requester_value',
  '_gcp_verifiedby_value',
  'createdon',
  'modifiedon',
];

export { mapGcpRtpRequest, DEFAULT_RTP_REQUEST_SELECT };
export type {
  GcpRtpRequest,
  GcpRtpRequestEntity,
  CreateGcpRtpRequestInput,
  UpdateGcpRtpRequestInput,
  FormTypeValue,
};
