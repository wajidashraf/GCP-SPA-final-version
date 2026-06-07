// src/shared/services/otherRequestService.ts
// Create service for the gcp_otherrequests table (display name "Other Requests").
// Shared by the GCPC "Others Form" and the GCP "GCP - Others" matters.
//
// Power Pages site settings & table permissions for `gcp_otherrequests` must be
// configured (Webapi/gcp_otherrequests/enabled = true, Webapi/gcp_otherrequests/fields,
// plus a table permission granting the calling web role create/read/write).
//
// NOTE: the parent link uses the `gcp_Requestlookup` navigation property, not
// `gcp_Request` — see applyLookupBinds below.

import {
  extractRecordId,
  odataBind,
  powerPagesFetchResponse,
} from '../powerPagesApi';
import {
  DEFAULT_OTHER_REQUEST_SELECT,
  mapGcpOtherRequest,
} from '../../types/otherRequest';
import type {
  CreateGcpOtherRequestInput,
  GcpOtherRequest,
  GcpOtherRequestEntity,
} from '../../types/otherRequest';
import { makeListByParent } from './childRequestList';
import type { ListChildOptions, ListChildResult } from './childRequestList';

const ENTITY_SET = 'gcp_otherrequestses';
const BASE_URL = `/_api/${ENTITY_SET}`;

const GUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const isGuid = (v: string | null | undefined): v is string =>
  !!v && GUID_REGEX.test(v);

type OtherRequestLookupBinds = {
  /** GUID of the parent gcp_request row this Other request belongs to. Required on create. */
  requestId?: string | null;
  /** GUID of the related gcp_project record. */
  projectId?: string | null;
  /** GUID of the related Account (Company). */
  companyAccountId?: string | null;
};

const applyLookupBinds = (
  input: CreateGcpOtherRequestInput,
  binds: OtherRequestLookupBinds | undefined
): CreateGcpOtherRequestInput => {
  if (!binds) return input;
  const out: CreateGcpOtherRequestInput = { ...input };
  if (isGuid(binds.requestId)) {
    // Parent lookup nav property is gcp_Requestlookup (not gcp_Request).
    out['gcp_Requestlookup@odata.bind'] = odataBind('gcp_requests', binds.requestId);
  }
  if (isGuid(binds.projectId)) {
    out['gcp_Project@odata.bind'] = odataBind('gcp_projectses', binds.projectId);
  }
  if (isGuid(binds.companyAccountId)) {
    out['gcp_Company@odata.bind'] = odataBind('accounts', binds.companyAccountId);
  }
  return out;
};

type CreateOtherRequestOptions = { lookups?: OtherRequestLookupBinds };
type CreateOtherRequestResult = { id: string; record?: GcpOtherRequest };

const createOtherRequest = async (
  input: CreateGcpOtherRequestInput,
  options: CreateOtherRequestOptions = {}
): Promise<CreateOtherRequestResult> => {
  const body = applyLookupBinds(input, options.lookups);

  const res = await powerPagesFetchResponse(BASE_URL, {
    method: 'POST',
    json: body,
    headers: { Prefer: 'return=representation' },
  });

  let entity: GcpOtherRequestEntity | undefined;
  const text = await res.text();
  if (text) {
    try {
      entity = JSON.parse(text) as GcpOtherRequestEntity;
    } catch {
      entity = undefined;
    }
  }

  if (entity?.gcp_otherrequestsid) {
    return { id: entity.gcp_otherrequestsid, record: mapGcpOtherRequest(entity) };
  }

  const id = extractRecordId(res);
  if (!id) {
    throw new Error('Create Other request succeeded but no record ID was returned.');
  }
  return { id };
};

/** List Other request rows belonging to a single parent gcp_request. */
const listOtherRequestsByParent = makeListByParent<
  GcpOtherRequestEntity,
  GcpOtherRequest
>({
  baseUrl: BASE_URL,
  defaultSelect: DEFAULT_OTHER_REQUEST_SELECT,
  map: mapGcpOtherRequest,
  parentValueField: '_gcp_requestlookup_value',
});

export {
  createOtherRequest,
  listOtherRequestsByParent,
  ENTITY_SET as OTHER_REQUEST_ENTITY_SET,
};
export type {
  CreateOtherRequestOptions,
  CreateOtherRequestResult,
  OtherRequestLookupBinds,
  ListChildOptions as ListOtherRequestsOptions,
  ListChildResult as ListOtherRequestsResult,
};
