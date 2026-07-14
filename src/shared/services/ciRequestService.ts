// src/shared/services/ciRequestService.ts
// Create service for the gcp_requestcigcp table (display name "Request CI GCP" —
// Contractual Issue Relating to Payment).
//
// Power Pages site settings & table permissions for `gcp_requestcigcp` must be
// configured (Webapi/gcp_requestcigcp/enabled = true, Webapi/gcp_requestcigcp/fields,
// plus a table permission granting the calling web role create/read/write).
//
// NOTE: gcp_company is REQUIRED on this table — always bind companyAccountId.

import {
  extractRecordId,
  odataBind,
  powerPagesFetch,
  powerPagesFetchResponse,
} from '../powerPagesApi';
import {
  DEFAULT_CI_REQUEST_SELECT,
  mapGcpCiRequest,
} from '../../types/ciRequest';
import type {
  CreateGcpCiRequestInput,
  GcpCiRequest,
  GcpCiRequestEntity,
  UpdateGcpCiRequestInput,
} from '../../types/ciRequest';
import { makeListByParent } from './childRequestList';
import type { ListChildOptions, ListChildResult } from './childRequestList';

const ENTITY_SET = 'gcp_requestcigcps';
const BASE_URL = `/_api/${ENTITY_SET}`;

const GUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const isGuid = (v: string | null | undefined): v is string =>
  !!v && GUID_REGEX.test(v);

type CiRequestLookupBinds = {
  /** GUID of the parent gcp_request row this CI belongs to. Required on create. */
  requestId?: string | null;
  /** GUID of the related gcp_project record. */
  projectId?: string | null;
  /** GUID of the related Account (Company). REQUIRED on this table. */
  companyAccountId?: string | null;
};

const applyLookupBinds = (
  input: CreateGcpCiRequestInput,
  binds: CiRequestLookupBinds | undefined
): CreateGcpCiRequestInput => {
  if (!binds) return input;
  const out: CreateGcpCiRequestInput = { ...input };
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

type CreateCiRequestOptions = { lookups?: CiRequestLookupBinds };
type CreateCiRequestResult = { id: string; record?: GcpCiRequest };

const createCiRequest = async (
  input: CreateGcpCiRequestInput,
  options: CreateCiRequestOptions = {}
): Promise<CreateCiRequestResult> => {
  const body = applyLookupBinds(input, options.lookups);

  const res = await powerPagesFetchResponse(BASE_URL, {
    method: 'POST',
    json: body,
    headers: { Prefer: 'return=representation' },
  });

  let entity: GcpCiRequestEntity | undefined;
  const text = await res.text();
  if (text) {
    try {
      entity = JSON.parse(text) as GcpCiRequestEntity;
    } catch {
      entity = undefined;
    }
  }

  if (entity?.gcp_requestcigcpid) {
    return { id: entity.gcp_requestcigcpid, record: mapGcpCiRequest(entity) };
  }

  const id = extractRecordId(res);
  if (!id) {
    throw new Error('Create CI request succeeded but no record ID was returned.');
  }
  return { id };
};

// ── Update ──────────────────────────────────────────────────────────────────
type UpdateCiRequestOptions = { lookups?: CiRequestLookupBinds };

const updateCiRequest = async (
  id: string,
  input: UpdateGcpCiRequestInput,
  options: UpdateCiRequestOptions = {}
): Promise<void> => {
  const body = applyLookupBinds(input as CreateGcpCiRequestInput, options.lookups);
  await powerPagesFetch<void>(`${BASE_URL}(${id})`, {
    method: 'PATCH',
    json: body,
    headers: { 'If-Match': '*' },
  });
};

/** List CI request rows belonging to a single parent gcp_request. */
const listCiRequestsByParent = makeListByParent<GcpCiRequestEntity, GcpCiRequest>({
  baseUrl: BASE_URL,
  defaultSelect: DEFAULT_CI_REQUEST_SELECT,
  map: mapGcpCiRequest,
});

export {
  createCiRequest,
  updateCiRequest,
  listCiRequestsByParent,
  ENTITY_SET as CI_REQUEST_ENTITY_SET,
};
export type {
  CreateCiRequestOptions,
  CreateCiRequestResult,
  UpdateCiRequestOptions,
  CiRequestLookupBinds,
  ListChildOptions as ListCiRequestsOptions,
  ListChildResult as ListCiRequestsResult,
};
