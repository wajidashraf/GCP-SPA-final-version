// src/shared/services/rppRequestService.ts
// Create service for the gcp_rpprequest table (display name "RPP Request" —
// Revised Procurement Plan).
//
// Power Pages site settings & table permissions for `gcp_rpprequest` must be
// configured (Webapi/gcp_rpprequest/enabled = true, Webapi/gcp_rpprequest/fields,
// plus a table permission granting the calling web role create/read/write).

import {
  extractRecordId,
  odataBind,
  powerPagesFetchResponse,
} from '../powerPagesApi';
import {
  DEFAULT_RPP_REQUEST_SELECT,
  mapGcpRppRequest,
} from '../../types/rppRequest';
import type {
  CreateGcpRppRequestInput,
  GcpRppRequest,
  GcpRppRequestEntity,
} from '../../types/rppRequest';
import { makeListByParent } from './childRequestList';
import type { ListChildOptions, ListChildResult } from './childRequestList';

const ENTITY_SET = 'gcp_rpprequests';
const BASE_URL = `/_api/${ENTITY_SET}`;

const GUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const isGuid = (v: string | null | undefined): v is string =>
  !!v && GUID_REGEX.test(v);

type RppRequestLookupBinds = {
  /** GUID of the parent gcp_request row this RPP belongs to. Required on create. */
  requestId?: string | null;
  /** GUID of the related gcp_project record. */
  projectId?: string | null;
  /** GUID of the related Account (Company). */
  companyAccountId?: string | null;
};

const applyLookupBinds = (
  input: CreateGcpRppRequestInput,
  binds: RppRequestLookupBinds | undefined
): CreateGcpRppRequestInput => {
  if (!binds) return input;
  const out: CreateGcpRppRequestInput = { ...input };
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

type CreateRppRequestOptions = { lookups?: RppRequestLookupBinds };
type CreateRppRequestResult = { id: string; record?: GcpRppRequest };

const createRppRequest = async (
  input: CreateGcpRppRequestInput,
  options: CreateRppRequestOptions = {}
): Promise<CreateRppRequestResult> => {
  const body = applyLookupBinds(input, options.lookups);

  const res = await powerPagesFetchResponse(BASE_URL, {
    method: 'POST',
    json: body,
    headers: { Prefer: 'return=representation' },
  });

  let entity: GcpRppRequestEntity | undefined;
  const text = await res.text();
  if (text) {
    try {
      entity = JSON.parse(text) as GcpRppRequestEntity;
    } catch {
      entity = undefined;
    }
  }

  if (entity?.gcp_rpprequestid) {
    return { id: entity.gcp_rpprequestid, record: mapGcpRppRequest(entity) };
  }

  const id = extractRecordId(res);
  if (!id) {
    throw new Error('Create RPP request succeeded but no record ID was returned.');
  }
  return { id };
};

/** List RPP request rows belonging to a single parent gcp_request. */
const listRppRequestsByParent = makeListByParent<GcpRppRequestEntity, GcpRppRequest>({
  baseUrl: BASE_URL,
  defaultSelect: DEFAULT_RPP_REQUEST_SELECT,
  map: mapGcpRppRequest,
});

export {
  createRppRequest,
  listRppRequestsByParent,
  ENTITY_SET as RPP_REQUEST_ENTITY_SET,
};
export type {
  CreateRppRequestOptions,
  CreateRppRequestResult,
  RppRequestLookupBinds,
  ListChildOptions as ListRppRequestsOptions,
  ListChildResult as ListRppRequestsResult,
};
