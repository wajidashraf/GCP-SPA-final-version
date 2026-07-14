// src/shared/services/stspRequestService.ts
// Create service for the gcp_stsprequest table (display name "ST/SP Request";
// Submission of Tender / Proposal).
//
// Power Pages site settings & table permissions for `gcp_stsprequest` must be
// configured (Webapi/gcp_stsprequest/enabled = true, Webapi/gcp_stsprequest/fields,
// plus a table permission granting the calling web role create/read/write).

import {
  extractRecordId,
  odataBind,
  powerPagesFetch,
  powerPagesFetchResponse,
} from '../powerPagesApi';
import { DEFAULT_STSP_REQUEST_SELECT, mapGcpStspRequest } from '../../types/stspRequest';
import type {
  CreateGcpStspRequestInput,
  GcpStspRequest,
  GcpStspRequestEntity,
  UpdateGcpStspRequestInput,
} from '../../types/stspRequest';
import { makeListByParent } from './childRequestList';
import type { ListChildOptions, ListChildResult } from './childRequestList';

const ENTITY_SET = 'gcp_stsprequests';
const BASE_URL = `/_api/${ENTITY_SET}`;

const GUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const isGuid = (v: string | null | undefined): v is string =>
  !!v && GUID_REGEX.test(v);

type StspRequestLookupBinds = {
  /** GUID of the parent gcp_request row this ST/SP belongs to. Required on create. */
  requestId?: string | null;
  /** GUID of the related gcp_project record. */
  projectId?: string | null;
};

const applyLookupBinds = (
  input: CreateGcpStspRequestInput,
  binds: StspRequestLookupBinds | undefined
): CreateGcpStspRequestInput => {
  if (!binds) return input;
  const out: CreateGcpStspRequestInput = { ...input };
  if (isGuid(binds.requestId)) {
    out['gcp_Request@odata.bind'] = odataBind('gcp_requests', binds.requestId);
  }
  if (isGuid(binds.projectId)) {
    out['gcp_Project@odata.bind'] = odataBind('gcp_projectses', binds.projectId);
  }
  return out;
};

type CreateStspRequestOptions = { lookups?: StspRequestLookupBinds };
type CreateStspRequestResult = { id: string; record?: GcpStspRequest };

const createStspRequest = async (
  input: CreateGcpStspRequestInput,
  options: CreateStspRequestOptions = {}
): Promise<CreateStspRequestResult> => {
  const body = applyLookupBinds(input, options.lookups);

  const res = await powerPagesFetchResponse(BASE_URL, {
    method: 'POST',
    json: body,
    headers: { Prefer: 'return=representation' },
  });

  let entity: GcpStspRequestEntity | undefined;
  const text = await res.text();
  if (text) {
    try {
      entity = JSON.parse(text) as GcpStspRequestEntity;
    } catch {
      entity = undefined;
    }
  }

  if (entity?.gcp_stsprequestid) {
    return { id: entity.gcp_stsprequestid, record: mapGcpStspRequest(entity) };
  }

  const id = extractRecordId(res);
  if (!id) {
    throw new Error(
      'Create ST/SP request succeeded but no record ID was returned.'
    );
  }
  return { id };
};

// ── Update ──────────────────────────────────────────────────────────────────
type UpdateStspRequestOptions = {
  lookups?: StspRequestLookupBinds;
};

const updateStspRequest = async (
  id: string,
  input: UpdateGcpStspRequestInput,
  options: UpdateStspRequestOptions = {}
): Promise<void> => {
  const body = applyLookupBinds(input as CreateGcpStspRequestInput, options.lookups);
  await powerPagesFetch<void>(`${BASE_URL}(${id})`, {
    method: 'PATCH',
    json: body,
    headers: { 'If-Match': '*' },
  });
};

/** List ST/SP request rows belonging to a single parent gcp_request. */
const listStspRequestsByParent = makeListByParent<GcpStspRequestEntity, GcpStspRequest>({
  baseUrl: BASE_URL,
  defaultSelect: DEFAULT_STSP_REQUEST_SELECT,
  map: mapGcpStspRequest,
});

export {
  createStspRequest,
  updateStspRequest,
  listStspRequestsByParent,
  ENTITY_SET as STSP_REQUEST_ENTITY_SET,
};
export type {
  CreateStspRequestOptions,
  CreateStspRequestResult,
  UpdateStspRequestOptions,
  StspRequestLookupBinds,
  ListChildOptions as ListStspRequestsOptions,
  ListChildResult as ListStspRequestsResult,
};
