// src/shared/services/caaRequestService.ts
// Create service for the gcp_caarequest table (display name "CAA Request" —
// Client Acceptance of Award).
//
// Power Pages site settings & table permissions for `gcp_caarequest` must be
// configured (Webapi/gcp_caarequest/enabled = true, Webapi/gcp_caarequest/fields,
// plus a table permission granting the calling web role create/read/write).

import {
  extractRecordId,
  odataBind,
  powerPagesFetch,
  powerPagesFetchResponse,
} from '../powerPagesApi';
import { DEFAULT_CAA_REQUEST_SELECT, mapGcpCaaRequest } from '../../types/caaRequest';
import type {
  CreateGcpCaaRequestInput,
  GcpCaaRequest,
  GcpCaaRequestEntity,
  UpdateGcpCaaRequestInput,
} from '../../types/caaRequest';
import { makeListByParent } from './childRequestList';
import type { ListChildOptions, ListChildResult } from './childRequestList';

const ENTITY_SET = 'gcp_caarequests';
const BASE_URL = `/_api/${ENTITY_SET}`;

const GUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const isGuid = (v: string | null | undefined): v is string =>
  !!v && GUID_REGEX.test(v);

type CaaRequestLookupBinds = {
  /** GUID of the parent gcp_request row this CAA belongs to. Required on create. */
  requestId?: string | null;
  /** GUID of the related gcp_project record. */
  projectId?: string | null;
  /** GUID of the related Account (Company). */
  companyAccountId?: string | null;
};

const applyLookupBinds = (
  input: CreateGcpCaaRequestInput,
  binds: CaaRequestLookupBinds | undefined
): CreateGcpCaaRequestInput => {
  if (!binds) return input;
  const out: CreateGcpCaaRequestInput = { ...input };
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

type CreateCaaRequestOptions = { lookups?: CaaRequestLookupBinds };
type CreateCaaRequestResult = { id: string; record?: GcpCaaRequest };

const createCaaRequest = async (
  input: CreateGcpCaaRequestInput,
  options: CreateCaaRequestOptions = {}
): Promise<CreateCaaRequestResult> => {
  const body = applyLookupBinds(input, options.lookups);

  const res = await powerPagesFetchResponse(BASE_URL, {
    method: 'POST',
    json: body,
    headers: { Prefer: 'return=representation' },
  });

  let entity: GcpCaaRequestEntity | undefined;
  const text = await res.text();
  if (text) {
    try {
      entity = JSON.parse(text) as GcpCaaRequestEntity;
    } catch {
      entity = undefined;
    }
  }

  if (entity?.gcp_caarequestid) {
    return { id: entity.gcp_caarequestid, record: mapGcpCaaRequest(entity) };
  }

  const id = extractRecordId(res);
  if (!id) {
    throw new Error('Create CAA request succeeded but no record ID was returned.');
  }
  return { id };
};

// ── Update ──────────────────────────────────────────────────────────────────
type UpdateCaaRequestOptions = {
  lookups?: CaaRequestLookupBinds;
};

const updateCaaRequest = async (
  id: string,
  input: UpdateGcpCaaRequestInput,
  options: UpdateCaaRequestOptions = {}
): Promise<void> => {
  const body = applyLookupBinds(input as CreateGcpCaaRequestInput, options.lookups);
  await powerPagesFetch<void>(`${BASE_URL}(${id})`, {
    method: 'PATCH',
    json: body,
    headers: { 'If-Match': '*' },
  });
};

/** List CAA request rows belonging to a single parent gcp_request. */
const listCaaRequestsByParent = makeListByParent<GcpCaaRequestEntity, GcpCaaRequest>({
  baseUrl: BASE_URL,
  defaultSelect: DEFAULT_CAA_REQUEST_SELECT,
  map: mapGcpCaaRequest,
});

export {
  createCaaRequest,
  updateCaaRequest,
  listCaaRequestsByParent,
  ENTITY_SET as CAA_REQUEST_ENTITY_SET,
};
export type {
  CreateCaaRequestOptions,
  CreateCaaRequestResult,
  UpdateCaaRequestOptions,
  CaaRequestLookupBinds,
  ListChildOptions as ListCaaRequestsOptions,
  ListChildResult as ListCaaRequestsResult,
};
