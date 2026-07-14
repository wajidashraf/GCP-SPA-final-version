// src/shared/services/ppRequestService.ts
// Create service for the gcp_pprequest table (display name "PP Request" —
// Procurement Plan).
//
// Power Pages site settings & table permissions for `gcp_pprequest` must be
// configured (Webapi/gcp_pprequest/enabled = true, Webapi/gcp_pprequest/fields,
// plus a table permission granting the calling web role create/read/write).

import {
  extractRecordId,
  odataBind,
  powerPagesFetch,
  powerPagesFetchResponse,
} from '../powerPagesApi';
import {
  DEFAULT_PP_REQUEST_SELECT,
  mapGcpPpRequest,
} from '../../types/ppRequest';
import type {
  CreateGcpPpRequestInput,
  GcpPpRequest,
  GcpPpRequestEntity,
  UpdateGcpPpRequestInput,
} from '../../types/ppRequest';
import { makeListByParent } from './childRequestList';
import type { ListChildOptions, ListChildResult } from './childRequestList';

const ENTITY_SET = 'gcp_pprequests';
const BASE_URL = `/_api/${ENTITY_SET}`;

const GUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const isGuid = (v: string | null | undefined): v is string =>
  !!v && GUID_REGEX.test(v);

type PpRequestLookupBinds = {
  /** GUID of the parent gcp_request row this PP belongs to. Required on create. */
  requestId?: string | null;
  /** GUID of the related gcp_project record. */
  projectId?: string | null;
  /** GUID of the related Account (Company). */
  companyAccountId?: string | null;
};

const applyLookupBinds = (
  input: CreateGcpPpRequestInput,
  binds: PpRequestLookupBinds | undefined
): CreateGcpPpRequestInput => {
  if (!binds) return input;
  const out: CreateGcpPpRequestInput = { ...input };
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

type CreatePpRequestOptions = { lookups?: PpRequestLookupBinds };
type CreatePpRequestResult = { id: string; record?: GcpPpRequest };

const createPpRequest = async (
  input: CreateGcpPpRequestInput,
  options: CreatePpRequestOptions = {}
): Promise<CreatePpRequestResult> => {
  const body = applyLookupBinds(input, options.lookups);

  const res = await powerPagesFetchResponse(BASE_URL, {
    method: 'POST',
    json: body,
    headers: { Prefer: 'return=representation' },
  });

  let entity: GcpPpRequestEntity | undefined;
  const text = await res.text();
  if (text) {
    try {
      entity = JSON.parse(text) as GcpPpRequestEntity;
    } catch {
      entity = undefined;
    }
  }

  if (entity?.gcp_pprequestid) {
    return { id: entity.gcp_pprequestid, record: mapGcpPpRequest(entity) };
  }

  const id = extractRecordId(res);
  if (!id) {
    throw new Error('Create PP request succeeded but no record ID was returned.');
  }
  return { id };
};

// ── Update ──────────────────────────────────────────────────────────────────
type UpdatePpRequestOptions = { lookups?: PpRequestLookupBinds };

const updatePpRequest = async (
  id: string,
  input: UpdateGcpPpRequestInput,
  options: UpdatePpRequestOptions = {}
): Promise<void> => {
  const body = applyLookupBinds(input as CreateGcpPpRequestInput, options.lookups);
  await powerPagesFetch<void>(`${BASE_URL}(${id})`, {
    method: 'PATCH',
    json: body,
    headers: { 'If-Match': '*' },
  });
};

/** List PP request rows belonging to a single parent gcp_request. */
const listPpRequestsByParent = makeListByParent<GcpPpRequestEntity, GcpPpRequest>({
  baseUrl: BASE_URL,
  defaultSelect: DEFAULT_PP_REQUEST_SELECT,
  map: mapGcpPpRequest,
});

export {
  createPpRequest,
  updatePpRequest,
  listPpRequestsByParent,
  ENTITY_SET as PP_REQUEST_ENTITY_SET,
};
export type {
  CreatePpRequestOptions,
  CreatePpRequestResult,
  UpdatePpRequestOptions,
  PpRequestLookupBinds,
  ListChildOptions as ListPpRequestsOptions,
  ListChildResult as ListPpRequestsResult,
};
