// src/shared/services/cprRequestService.ts
// Create service for the gcp_cprrequestgcp table (display name "CPR Request GCP"
// — Contract Progress Report).
//
// Power Pages site settings & table permissions for `gcp_cprrequestgcp` must be
// configured (Webapi/gcp_cprrequestgcp/enabled = true, Webapi/gcp_cprrequestgcp/fields,
// plus a table permission granting the calling web role create/read/write).

import {
  extractRecordId,
  odataBind,
  powerPagesFetchResponse,
} from '../powerPagesApi';
import {
  DEFAULT_CPR_REQUEST_SELECT,
  mapGcpCprRequest,
} from '../../types/cprRequest';
import type {
  CreateGcpCprRequestInput,
  GcpCprRequest,
  GcpCprRequestEntity,
} from '../../types/cprRequest';
import { makeListByParent } from './childRequestList';
import type { ListChildOptions, ListChildResult } from './childRequestList';

const ENTITY_SET = 'gcp_cprrequestgcps';
const BASE_URL = `/_api/${ENTITY_SET}`;

const GUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const isGuid = (v: string | null | undefined): v is string =>
  !!v && GUID_REGEX.test(v);

type CprRequestLookupBinds = {
  /** GUID of the parent gcp_request row this CPR belongs to. Required on create. */
  requestId?: string | null;
  /** GUID of the related gcp_project record. */
  projectId?: string | null;
  /** GUID of the related Account (Company). */
  companyAccountId?: string | null;
};

const applyLookupBinds = (
  input: CreateGcpCprRequestInput,
  binds: CprRequestLookupBinds | undefined
): CreateGcpCprRequestInput => {
  if (!binds) return input;
  const out: CreateGcpCprRequestInput = { ...input };
  if (isGuid(binds.requestId)) {
    out['gcp_Request@odata.bind'] = odataBind('gcp_requests', binds.requestId);
  }
  if (isGuid(binds.projectId)) {
    out['gcp_Project@odata.bind'] = odataBind('gcp_projectses', binds.projectId);
  }
  if (isGuid(binds.companyAccountId)) {
    out['gcp_Company@odata.bind'] = odataBind('accounts', binds.companyAccountId);
  }
  return out;
};

type CreateCprRequestOptions = { lookups?: CprRequestLookupBinds };
type CreateCprRequestResult = { id: string; record?: GcpCprRequest };

const createCprRequest = async (
  input: CreateGcpCprRequestInput,
  options: CreateCprRequestOptions = {}
): Promise<CreateCprRequestResult> => {
  const body = applyLookupBinds(input, options.lookups);

  const res = await powerPagesFetchResponse(BASE_URL, {
    method: 'POST',
    json: body,
    headers: { Prefer: 'return=representation' },
  });

  let entity: GcpCprRequestEntity | undefined;
  const text = await res.text();
  if (text) {
    try {
      entity = JSON.parse(text) as GcpCprRequestEntity;
    } catch {
      entity = undefined;
    }
  }

  if (entity?.gcp_cprrequestgcpid) {
    return { id: entity.gcp_cprrequestgcpid, record: mapGcpCprRequest(entity) };
  }

  const id = extractRecordId(res);
  if (!id) {
    throw new Error('Create CPR request succeeded but no record ID was returned.');
  }
  return { id };
};

/** List CPR request rows belonging to a single parent gcp_request. */
const listCprRequestsByParent = makeListByParent<GcpCprRequestEntity, GcpCprRequest>({
  baseUrl: BASE_URL,
  defaultSelect: DEFAULT_CPR_REQUEST_SELECT,
  map: mapGcpCprRequest,
});

export {
  createCprRequest,
  listCprRequestsByParent,
  ENTITY_SET as CPR_REQUEST_ENTITY_SET,
};
export type {
  CreateCprRequestOptions,
  CreateCprRequestResult,
  CprRequestLookupBinds,
  ListChildOptions as ListCprRequestsOptions,
  ListChildResult as ListCprRequestsResult,
};
