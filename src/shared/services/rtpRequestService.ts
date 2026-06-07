// src/shared/services/rtpRequestService.ts
// CRUD service for the gcp_rtprequest child table.
//
// Power Pages site settings & table permissions for `gcp_rtprequest` must be
// configured (Webapi/gcp_rtprequest/enabled = true, Webapi/gcp_rtprequest/fields,
// plus a table permission granting the calling web role create/read/write —
// typically a Parental permission scoped via the gcp_Request lookup so portal
// users can only see/modify RTP rows tied to their own gcp_request).

import {
  buildODataQuery,
  combinePrefer,
  escapeODataString,
  extractRecordId,
  includeFormattedValues,
  odataBind,
  pageSizeHeader,
  powerPagesFetch,
  powerPagesFetchResponse,
} from '../powerPagesApi';
import type { ODataListResponse, ODataQuery } from '../powerPagesApi';
import {
  DEFAULT_RTP_REQUEST_SELECT,
  mapGcpRtpRequest,
} from '../../types/rtpRequest';
import type {
  CreateGcpRtpRequestInput,
  GcpRtpRequest,
  GcpRtpRequestEntity,
  UpdateGcpRtpRequestInput,
} from '../../types/rtpRequest';

const ENTITY_SET = 'gcp_rtprequests';
const BASE_URL = `/_api/${ENTITY_SET}`;

const GUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const isGuid = (v: string | null | undefined): v is string =>
  !!v && GUID_REGEX.test(v);

// ── Lookup bind helpers ─────────────────────────────────────────────────────
type RtpRequestLookupBinds = {
  /** GUID of the parent gcp_request row this RTP belongs to. Required on create. */
  requestId?: string | null;
  companyAccountId?: string | null;
  clientsNameContactId?: string | null;
  requesterContactId?: string | null;
  verifiedByContactId?: string | null;
};

const applyLookupBinds = (
  input: CreateGcpRtpRequestInput,
  binds: RtpRequestLookupBinds | undefined
): CreateGcpRtpRequestInput => {
  if (!binds) return input;
  const out: CreateGcpRtpRequestInput = { ...input };
  if (isGuid(binds.requestId)) {
    out['gcp_Request@odata.bind'] = odataBind('gcp_requests', binds.requestId);
  }
  if (isGuid(binds.companyAccountId)) {
    out['gcp_Company@odata.bind'] = odataBind('accounts', binds.companyAccountId);
  }
  if (isGuid(binds.clientsNameContactId)) {
    out['gcp_ClientsName@odata.bind'] = odataBind('contacts', binds.clientsNameContactId);
  }
  if (isGuid(binds.requesterContactId)) {
    out['gcp_Requester@odata.bind'] = odataBind('contacts', binds.requesterContactId);
  }
  if (isGuid(binds.verifiedByContactId)) {
    out['gcp_Verifiedby@odata.bind'] = odataBind('contacts', binds.verifiedByContactId);
  }
  return out;
};

// ── List by parent request ──────────────────────────────────────────────────
type ListRtpRequestsOptions = {
  select?: readonly string[];
  filter?: string;
  orderby?: string;
  pageSize?: number;
  nextLink?: string;
  withFormattedValues?: boolean;
};

type ListRtpRequestsResult = {
  items: GcpRtpRequest[];
  totalCount?: number;
  nextLink?: string;
};

const runList = async (
  url: string,
  pageSize: number,
  withFormattedValues: boolean
): Promise<ListRtpRequestsResult> => {
  const headers = withFormattedValues
    ? combinePrefer(pageSizeHeader(pageSize), includeFormattedValues())
    : pageSizeHeader(pageSize);

  const res = await powerPagesFetch<ODataListResponse<GcpRtpRequestEntity>>(url, {
    method: 'GET',
    headers,
  });

  return {
    items: (res?.value ?? []).map(mapGcpRtpRequest),
    totalCount: res?.['@odata.count'],
    nextLink: res?.['@odata.nextLink'],
  };
};

/** List RTP request rows belonging to a single parent gcp_request. */
const listRtpRequestsByParent = async (
  requestId: string,
  options: ListRtpRequestsOptions = {}
): Promise<ListRtpRequestsResult> => {
  if (!isGuid(requestId)) {
    return { items: [], totalCount: 0 };
  }

  const pageSize = options.pageSize ?? 25;
  let url: string;
  if (options.nextLink) {
    url = options.nextLink;
  } else {
    const parentFilter = `_gcp_request_value eq ${escapeODataString(requestId)}`;
    const filter = options.filter
      ? `(${parentFilter}) and (${options.filter})`
      : parentFilter;
    const query: ODataQuery = {
      select: options.select ?? DEFAULT_RTP_REQUEST_SELECT,
      filter,
      orderby: options.orderby ?? 'createdon desc',
      count: true,
    };
    url = `${BASE_URL}${buildODataQuery(query)}`;
  }

  return runList(url, pageSize, options.withFormattedValues === true);
};

// ── Get by ID ───────────────────────────────────────────────────────────────
const getRtpRequestById = async (
  id: string,
  options: { select?: readonly string[]; withFormattedValues?: boolean } = {}
): Promise<GcpRtpRequest | null> => {
  const query: ODataQuery = {
    select: options.select ?? DEFAULT_RTP_REQUEST_SELECT,
  };
  const url = `${BASE_URL}(${id})${buildODataQuery(query)}`;
  try {
    const entity = await powerPagesFetch<GcpRtpRequestEntity>(url, {
      method: 'GET',
      headers: options.withFormattedValues ? includeFormattedValues() : undefined,
    });
    return entity ? mapGcpRtpRequest(entity) : null;
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status === 404) return null;
    throw err;
  }
};

// ── Create ──────────────────────────────────────────────────────────────────
type CreateRtpRequestOptions = {
  lookups?: RtpRequestLookupBinds;
};

type CreateRtpRequestResult = {
  id: string;
  record?: GcpRtpRequest;
};

const createRtpRequest = async (
  input: CreateGcpRtpRequestInput,
  options: CreateRtpRequestOptions = {}
): Promise<CreateRtpRequestResult> => {
  const body = applyLookupBinds(input, options.lookups);

  const res = await powerPagesFetchResponse(BASE_URL, {
    method: 'POST',
    json: body,
    headers: { Prefer: 'return=representation' },
  });

  let entity: GcpRtpRequestEntity | undefined;
  const text = await res.text();
  if (text) {
    try {
      entity = JSON.parse(text) as GcpRtpRequestEntity;
    } catch {
      entity = undefined;
    }
  }

  if (entity?.gcp_rtprequestid) {
    return { id: entity.gcp_rtprequestid, record: mapGcpRtpRequest(entity) };
  }

  const id = extractRecordId(res);
  if (!id) {
    throw new Error('Create RTP request succeeded but no record ID was returned.');
  }
  const record = await getRtpRequestById(id);
  return { id, record: record ?? undefined };
};

// ── Update ──────────────────────────────────────────────────────────────────
type UpdateRtpRequestOptions = {
  lookups?: RtpRequestLookupBinds;
};

const updateRtpRequest = async (
  id: string,
  input: UpdateGcpRtpRequestInput,
  options: UpdateRtpRequestOptions = {}
): Promise<void> => {
  const body = applyLookupBinds(input as CreateGcpRtpRequestInput, options.lookups);
  await powerPagesFetch<void>(`${BASE_URL}(${id})`, {
    method: 'PATCH',
    json: body,
    headers: { 'If-Match': '*' },
  });
};

export {
  listRtpRequestsByParent,
  getRtpRequestById,
  createRtpRequest,
  updateRtpRequest,
  ENTITY_SET as RTP_REQUEST_ENTITY_SET,
};
export type {
  ListRtpRequestsOptions,
  ListRtpRequestsResult,
  CreateRtpRequestOptions,
  CreateRtpRequestResult,
  UpdateRtpRequestOptions,
  RtpRequestLookupBinds,
};
