// src/shared/services/rpccaRequestService.ts
// Create service for the gcp_rpccarequestgcp table (display name "Revised PCCA
// Request").
//
// Power Pages site settings & table permissions for `gcp_rpccarequestgcp` must
// be configured (Webapi/gcp_rpccarequestgcp/enabled = true,
// Webapi/gcp_rpccarequestgcp/fields, plus a table permission granting the
// calling web role create/read/write).

import {
  extractRecordId,
  odataBind,
  powerPagesFetch,
  powerPagesFetchResponse,
} from '../powerPagesApi';
import {
  DEFAULT_RPCCA_REQUEST_SELECT,
  mapGcpRpccaRequest,
} from '../../types/rpccaRequest';
import type {
  CreateGcpRpccaRequestInput,
  GcpRpccaRequest,
  GcpRpccaRequestEntity,
  UpdateGcpRpccaRequestInput,
} from '../../types/rpccaRequest';
import { makeListByParent } from './childRequestList';
import type { ListChildOptions, ListChildResult } from './childRequestList';

const ENTITY_SET = 'gcp_rpccarequestgcps';
const BASE_URL = `/_api/${ENTITY_SET}`;

const GUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const isGuid = (v: string | null | undefined): v is string =>
  !!v && GUID_REGEX.test(v);

type RpccaRequestLookupBinds = {
  /** GUID of the parent gcp_request row this Revised PCCA belongs to. Required on create. */
  requestId?: string | null;
};

const applyLookupBinds = (
  input: CreateGcpRpccaRequestInput,
  binds: RpccaRequestLookupBinds | undefined
): CreateGcpRpccaRequestInput => {
  if (!binds) return input;
  const out: CreateGcpRpccaRequestInput = { ...input };
  if (isGuid(binds.requestId)) {
    out['gcp_Request@odata.bind'] = odataBind('gcp_requests', binds.requestId);
  }
  return out;
};

type CreateRpccaRequestOptions = { lookups?: RpccaRequestLookupBinds };
type CreateRpccaRequestResult = { id: string; record?: GcpRpccaRequest };

const createRpccaRequest = async (
  input: CreateGcpRpccaRequestInput,
  options: CreateRpccaRequestOptions = {}
): Promise<CreateRpccaRequestResult> => {
  const body = applyLookupBinds(input, options.lookups);

  const res = await powerPagesFetchResponse(BASE_URL, {
    method: 'POST',
    json: body,
    headers: { Prefer: 'return=representation' },
  });

  let entity: GcpRpccaRequestEntity | undefined;
  const text = await res.text();
  if (text) {
    try {
      entity = JSON.parse(text) as GcpRpccaRequestEntity;
    } catch {
      entity = undefined;
    }
  }

  if (entity?.gcp_rpccarequestgcpid) {
    return { id: entity.gcp_rpccarequestgcpid, record: mapGcpRpccaRequest(entity) };
  }

  const id = extractRecordId(res);
  if (!id) {
    throw new Error('Create Revised PCCA request succeeded but no record ID was returned.');
  }
  return { id };
};

// ── Update ──────────────────────────────────────────────────────────────────
type UpdateRpccaRequestOptions = { lookups?: RpccaRequestLookupBinds };

const updateRpccaRequest = async (
  id: string,
  input: UpdateGcpRpccaRequestInput,
  options: UpdateRpccaRequestOptions = {}
): Promise<void> => {
  const body = applyLookupBinds(input as CreateGcpRpccaRequestInput, options.lookups);
  await powerPagesFetch<void>(`${BASE_URL}(${id})`, {
    method: 'PATCH',
    json: body,
    headers: { 'If-Match': '*' },
  });
};

/** List Revised PCCA request rows belonging to a single parent gcp_request. */
const listRpccaRequestsByParent = makeListByParent<
  GcpRpccaRequestEntity,
  GcpRpccaRequest
>({
  baseUrl: BASE_URL,
  defaultSelect: DEFAULT_RPCCA_REQUEST_SELECT,
  map: mapGcpRpccaRequest,
});

export {
  createRpccaRequest,
  updateRpccaRequest,
  listRpccaRequestsByParent,
  ENTITY_SET as RPCCA_REQUEST_ENTITY_SET,
};
export type {
  CreateRpccaRequestOptions,
  CreateRpccaRequestResult,
  UpdateRpccaRequestOptions,
  RpccaRequestLookupBinds,
  ListChildOptions as ListRpccaRequestsOptions,
  ListChildResult as ListRpccaRequestsResult,
};
