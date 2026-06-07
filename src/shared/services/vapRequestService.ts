// src/shared/services/vapRequestService.ts
// Create service for the gcp_vaprequest table (display name "VAP Request" —
// Vendor Appointment and Procurement).
//
// Power Pages site settings & table permissions for `gcp_vaprequest` must be
// configured (Webapi/gcp_vaprequest/enabled = true, Webapi/gcp_vaprequest/fields,
// plus a table permission granting the calling web role create/read/write).

import {
  extractRecordId,
  odataBind,
  powerPagesFetchResponse,
} from '../powerPagesApi';
import {
  DEFAULT_VAP_REQUEST_SELECT,
  mapGcpVapRequest,
} from '../../types/vapRequest';
import type {
  CreateGcpVapRequestInput,
  GcpVapRequest,
  GcpVapRequestEntity,
} from '../../types/vapRequest';
import { makeListByParent } from './childRequestList';
import type { ListChildOptions, ListChildResult } from './childRequestList';

const ENTITY_SET = 'gcp_vaprequests';
const BASE_URL = `/_api/${ENTITY_SET}`;

const GUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const isGuid = (v: string | null | undefined): v is string =>
  !!v && GUID_REGEX.test(v);

type VapRequestLookupBinds = {
  /** GUID of the parent gcp_request row this VAP belongs to. Required on create. */
  requestId?: string | null;
  /** GUID of the related gcp_project record. */
  projectId?: string | null;
  /** GUID of the related Account (Company). */
  companyAccountId?: string | null;
};

const applyLookupBinds = (
  input: CreateGcpVapRequestInput,
  binds: VapRequestLookupBinds | undefined
): CreateGcpVapRequestInput => {
  if (!binds) return input;
  const out: CreateGcpVapRequestInput = { ...input };
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

type CreateVapRequestOptions = { lookups?: VapRequestLookupBinds };
type CreateVapRequestResult = { id: string; record?: GcpVapRequest };

const createVapRequest = async (
  input: CreateGcpVapRequestInput,
  options: CreateVapRequestOptions = {}
): Promise<CreateVapRequestResult> => {
  const body = applyLookupBinds(input, options.lookups);

  const res = await powerPagesFetchResponse(BASE_URL, {
    method: 'POST',
    json: body,
    headers: { Prefer: 'return=representation' },
  });

  let entity: GcpVapRequestEntity | undefined;
  const text = await res.text();
  if (text) {
    try {
      entity = JSON.parse(text) as GcpVapRequestEntity;
    } catch {
      entity = undefined;
    }
  }

  if (entity?.gcp_vaprequestid) {
    return { id: entity.gcp_vaprequestid, record: mapGcpVapRequest(entity) };
  }

  const id = extractRecordId(res);
  if (!id) {
    throw new Error('Create VAP request succeeded but no record ID was returned.');
  }
  return { id };
};

/** List VAP request rows belonging to a single parent gcp_request. */
const listVapRequestsByParent = makeListByParent<GcpVapRequestEntity, GcpVapRequest>({
  baseUrl: BASE_URL,
  defaultSelect: DEFAULT_VAP_REQUEST_SELECT,
  map: mapGcpVapRequest,
});

export {
  createVapRequest,
  listVapRequestsByParent,
  ENTITY_SET as VAP_REQUEST_ENTITY_SET,
};
export type {
  CreateVapRequestOptions,
  CreateVapRequestResult,
  VapRequestLookupBinds,
  ListChildOptions as ListVapRequestsOptions,
  ListChildResult as ListVapRequestsResult,
};
