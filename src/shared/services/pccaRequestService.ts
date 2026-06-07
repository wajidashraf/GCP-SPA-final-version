// src/shared/services/pccaRequestService.ts
// Create service for the gcp_pccarequest table (display name "PCCA Request").
//
// Power Pages site settings & table permissions for `gcp_pccarequest` must be
// configured (Webapi/gcp_pccarequest/enabled = true, Webapi/gcp_pccarequest/fields,
// plus a table permission granting the calling web role create/read/write).

import {
  extractRecordId,
  odataBind,
  powerPagesFetchResponse,
} from '../powerPagesApi';
import {
  DEFAULT_PCCA_REQUEST_SELECT,
  mapGcpPccaRequest,
} from '../../types/pccaRequest';
import type {
  CreateGcpPccaRequestInput,
  GcpPccaRequest,
  GcpPccaRequestEntity,
} from '../../types/pccaRequest';
import { makeListByParent } from './childRequestList';
import type { ListChildOptions, ListChildResult } from './childRequestList';

const ENTITY_SET = 'gcp_pccarequests';
const BASE_URL = `/_api/${ENTITY_SET}`;

const GUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const isGuid = (v: string | null | undefined): v is string =>
  !!v && GUID_REGEX.test(v);

type PccaRequestLookupBinds = {
  /** GUID of the parent gcp_request row this PCCA belongs to. Required on create. */
  requestId?: string | null;
  /** GUID of the related gcp_project record. */
  projectId?: string | null;
  /** GUID of the related Account (Company). */
  companyAccountId?: string | null;
};

const applyLookupBinds = (
  input: CreateGcpPccaRequestInput,
  binds: PccaRequestLookupBinds | undefined
): CreateGcpPccaRequestInput => {
  if (!binds) return input;
  const out: CreateGcpPccaRequestInput = { ...input };
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

type CreatePccaRequestOptions = { lookups?: PccaRequestLookupBinds };
type CreatePccaRequestResult = { id: string; record?: GcpPccaRequest };

const createPccaRequest = async (
  input: CreateGcpPccaRequestInput,
  options: CreatePccaRequestOptions = {}
): Promise<CreatePccaRequestResult> => {
  const body = applyLookupBinds(input, options.lookups);

  const res = await powerPagesFetchResponse(BASE_URL, {
    method: 'POST',
    json: body,
    headers: { Prefer: 'return=representation' },
  });

  let entity: GcpPccaRequestEntity | undefined;
  const text = await res.text();
  if (text) {
    try {
      entity = JSON.parse(text) as GcpPccaRequestEntity;
    } catch {
      entity = undefined;
    }
  }

  if (entity?.gcp_pccarequestid) {
    return { id: entity.gcp_pccarequestid, record: mapGcpPccaRequest(entity) };
  }

  const id = extractRecordId(res);
  if (!id) {
    throw new Error('Create PCCA request succeeded but no record ID was returned.');
  }
  return { id };
};

/** List PCCA request rows belonging to a single parent gcp_request. */
const listPccaRequestsByParent = makeListByParent<
  GcpPccaRequestEntity,
  GcpPccaRequest
>({
  baseUrl: BASE_URL,
  defaultSelect: DEFAULT_PCCA_REQUEST_SELECT,
  map: mapGcpPccaRequest,
});

export {
  createPccaRequest,
  listPccaRequestsByParent,
  ENTITY_SET as PCCA_REQUEST_ENTITY_SET,
};
export type {
  CreatePccaRequestOptions,
  CreatePccaRequestResult,
  PccaRequestLookupBinds,
  ListChildOptions as ListPccaRequestsOptions,
  ListChildResult as ListPccaRequestsResult,
};
