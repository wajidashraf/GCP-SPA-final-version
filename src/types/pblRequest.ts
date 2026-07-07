// src/types/pblRequest.ts
// TypeScript mirror of the gcp_pblrequest Dataverse table.
// Logical name: gcp_pblrequest  |  Entity set: gcp_pblrequests
// Primary name: gcp_pblrequesttitle  |  PK: gcp_pblrequestid

import type { ProcurementMethodValue } from '../data/requestChoices';

// Per the data model (see mapping.md "PBL" + src/forms/pbl/api.ts), the only
// columns that live on gcp_pblrequest are the project code, procurement method,
// and the Project/Request lookups. There is no gcp_company, gcp_date,
// gcp_formtype, gcp_acknowledgement or gcp_soacode column on this child table
// (acknowledgement is stored on the parent gcp_request). Selecting those
// non-existent columns made the Web API return 9004010A "UnexpectedError".

type GcpPblRequestEntity = {
  '@odata.etag'?: string;
  gcp_pblrequestid?: string;
  gcp_pblrequesttitle?: string | null;
  gcp_procurementmethod?: ProcurementMethodValue | null;
  gcp_projectcode?: string | null;

  '_gcp_project_value'?: string | null;
  '_gcp_request_value'?: string | null;

  createdon?: string;
  modifiedon?: string;
};

type GcpPblRequest = {
  id: string;
  title: string | null;
  procurementMethod: ProcurementMethodValue | null;
  projectCode: string | null;
  projectId: string | null;
  requestId: string | null;
};

type CreateGcpPblRequestInput = {
  gcp_pblrequesttitle?: string | null;
  gcp_procurementmethod?: ProcurementMethodValue | null;
  gcp_projectcode?: string | null;
  'gcp_Project@odata.bind'?: string;
  'gcp_Request@odata.bind'?: string;
};

type UpdateGcpPblRequestInput = Partial<CreateGcpPblRequestInput>;

const mapGcpPblRequest = (e: GcpPblRequestEntity): GcpPblRequest => ({
  id: e.gcp_pblrequestid ?? '',
  title: e.gcp_pblrequesttitle ?? null,
  procurementMethod:
    (e.gcp_procurementmethod ?? null) as ProcurementMethodValue | null,
  projectCode: e.gcp_projectcode ?? null,
  projectId: e['_gcp_project_value'] ?? null,
  requestId: e['_gcp_request_value'] ?? null,
});

const DEFAULT_PBL_REQUEST_SELECT: readonly string[] = [
  'gcp_pblrequestid',
  'gcp_pblrequesttitle',
  'gcp_procurementmethod',
  'gcp_projectcode',
  '_gcp_project_value',
  '_gcp_request_value',
];

export { mapGcpPblRequest, DEFAULT_PBL_REQUEST_SELECT };
export type {
  GcpPblRequest,
  GcpPblRequestEntity,
  CreateGcpPblRequestInput,
  UpdateGcpPblRequestInput,
};
