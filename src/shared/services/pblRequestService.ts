// src/shared/services/pblRequestService.ts
// Create service for the gcp_pblrequest table.

import {
  extractRecordId,
  odataBind,
  powerPagesFetchResponse,
} from '../powerPagesApi';
import { DEFAULT_PBL_REQUEST_SELECT, mapGcpPblRequest } from '../../types/pblRequest';
import type {
  CreateGcpPblRequestInput,
  GcpPblRequest,
  GcpPblRequestEntity,
} from '../../types/pblRequest';
import { makeListByParent } from './childRequestList';
import type { ListChildOptions, ListChildResult } from './childRequestList';

const ENTITY_SET = 'gcp_pblrequests';
const BASE_URL = `/_api/${ENTITY_SET}`;

const GUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const isGuid = (v: string | null | undefined): v is string =>
  !!v && GUID_REGEX.test(v);

type PblRequestLookupBinds = {
  /** GUID of the parent gcp_request row this PBL belongs to. Required on create. */
  requestId?: string | null;
  /** GUID of the related gcp_project record. */
  projectId?: string | null;
};

const applyLookupBinds = (
  input: CreateGcpPblRequestInput,
  binds: PblRequestLookupBinds | undefined
): CreateGcpPblRequestInput => {
  if (!binds) return input;
  const out: CreateGcpPblRequestInput = { ...input };
  if (isGuid(binds.requestId)) {
    out['gcp_Request@odata.bind'] = odataBind('gcp_requests', binds.requestId);
  }
  if (isGuid(binds.projectId)) {
    out['gcp_Project@odata.bind'] = odataBind('gcp_projectses', binds.projectId);
  }
  return out;
};

type CreatePblRequestOptions = { lookups?: PblRequestLookupBinds };
type CreatePblRequestResult = { id: string; record?: GcpPblRequest };

const createPblRequest = async (
  input: CreateGcpPblRequestInput,
  options: CreatePblRequestOptions = {}
): Promise<CreatePblRequestResult> => {
  const body = applyLookupBinds(input, options.lookups);

  const res = await powerPagesFetchResponse(BASE_URL, {
    method: 'POST',
    json: body,
    headers: { Prefer: 'return=representation' },
  });

  let entity: GcpPblRequestEntity | undefined;
  const text = await res.text();
  if (text) {
    try {
      entity = JSON.parse(text) as GcpPblRequestEntity;
    } catch {
      entity = undefined;
    }
  }

  if (entity?.gcp_pblrequestid) {
    return { id: entity.gcp_pblrequestid, record: mapGcpPblRequest(entity) };
  }

  const id = extractRecordId(res);
  if (!id) {
    throw new Error('Create PBL request succeeded but no record ID was returned.');
  }
  return { id };
};

/** List PBL request rows belonging to a single parent gcp_request. */
const listPblRequestsByParent = makeListByParent<GcpPblRequestEntity, GcpPblRequest>({
  baseUrl: BASE_URL,
  defaultSelect: DEFAULT_PBL_REQUEST_SELECT,
  map: mapGcpPblRequest,
});

export {
  createPblRequest,
  listPblRequestsByParent,
  ENTITY_SET as PBL_REQUEST_ENTITY_SET,
};
export type {
  CreatePblRequestOptions,
  CreatePblRequestResult,
  PblRequestLookupBinds,
  ListChildOptions as ListPblRequestsOptions,
  ListChildResult as ListPblRequestsResult,
};
