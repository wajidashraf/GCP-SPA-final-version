// src/shared/services/jvpRequestService.ts
// Create service for the gcp_jvmrequest table (display name "JVP Request";
// schema name uses the "JVM" prefix).
//
// Power Pages site settings & table permissions for `gcp_jvmrequest` must be
// configured (Webapi/gcp_jvmrequest/enabled = true, Webapi/gcp_jvmrequest/fields,
// plus a table permission granting the calling web role create/read/write).

import {
  extractRecordId,
  odataBind,
  powerPagesFetchResponse,
} from '../powerPagesApi';
import { DEFAULT_JVP_REQUEST_SELECT, mapGcpJvpRequest } from '../../types/jvpRequest';
import type {
  CreateGcpJvpRequestInput,
  GcpJvpRequest,
  GcpJvpRequestEntity,
} from '../../types/jvpRequest';
import { makeListByParent } from './childRequestList';
import type { ListChildOptions, ListChildResult } from './childRequestList';

const ENTITY_SET = 'gcp_jvmrequests';
const BASE_URL = `/_api/${ENTITY_SET}`;

const GUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const isGuid = (v: string | null | undefined): v is string =>
  !!v && GUID_REGEX.test(v);

type JvpRequestLookupBinds = {
  /** GUID of the parent gcp_request row this JVP belongs to. Required on create. */
  requestId?: string | null;
  /** GUID of the related gcp_project record. */
  projectId?: string | null;
};

const applyLookupBinds = (
  input: CreateGcpJvpRequestInput,
  binds: JvpRequestLookupBinds | undefined
): CreateGcpJvpRequestInput => {
  if (!binds) return input;
  const out: CreateGcpJvpRequestInput = { ...input };
  if (isGuid(binds.requestId)) {
    out['gcp_Request@odata.bind'] = odataBind('gcp_requests', binds.requestId);
  }
  if (isGuid(binds.projectId)) {
    out['gcp_Project@odata.bind'] = odataBind('gcp_projectses', binds.projectId);
  }
  return out;
};

type CreateJvpRequestOptions = { lookups?: JvpRequestLookupBinds };
type CreateJvpRequestResult = { id: string; record?: GcpJvpRequest };

const createJvpRequest = async (
  input: CreateGcpJvpRequestInput,
  options: CreateJvpRequestOptions = {}
): Promise<CreateJvpRequestResult> => {
  const body = applyLookupBinds(input, options.lookups);

  const res = await powerPagesFetchResponse(BASE_URL, {
    method: 'POST',
    json: body,
    headers: { Prefer: 'return=representation' },
  });

  let entity: GcpJvpRequestEntity | undefined;
  const text = await res.text();
  if (text) {
    try {
      entity = JSON.parse(text) as GcpJvpRequestEntity;
    } catch {
      entity = undefined;
    }
  }

  if (entity?.gcp_jvmrequestid) {
    return { id: entity.gcp_jvmrequestid, record: mapGcpJvpRequest(entity) };
  }

  const id = extractRecordId(res);
  if (!id) {
    throw new Error('Create JVP request succeeded but no record ID was returned.');
  }
  return { id };
};

/** List JVP (gcp_jvmrequest) rows belonging to a single parent gcp_request. */
const listJvpRequestsByParent = makeListByParent<GcpJvpRequestEntity, GcpJvpRequest>({
  baseUrl: BASE_URL,
  defaultSelect: DEFAULT_JVP_REQUEST_SELECT,
  map: mapGcpJvpRequest,
});

export {
  createJvpRequest,
  listJvpRequestsByParent,
  ENTITY_SET as JVP_REQUEST_ENTITY_SET,
};
export type {
  CreateJvpRequestOptions,
  CreateJvpRequestResult,
  JvpRequestLookupBinds,
  ListChildOptions as ListJvpRequestsOptions,
  ListChildResult as ListJvpRequestsResult,
};
