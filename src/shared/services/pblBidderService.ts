// src/shared/services/pblBidderService.ts
// Create/update/delete service for the gcp_pblbidders table.

import {
  extractRecordId,
  odataBind,
  powerPagesFetch,
  powerPagesFetchResponse,
  WebApiError,
} from '../powerPagesApi';
import {
  DEFAULT_PBL_BIDDER_SELECT,
  mapGcpPblBidder,
} from '../../types/pblBidder';
import type {
  CreateGcpPblBidderInput,
  GcpPblBidder,
  GcpPblBidderEntity,
  UpdateGcpPblBidderInput,
} from '../../types/pblBidder';
import { makeListByParent } from './childRequestList';
import type { ListChildOptions, ListChildResult } from './childRequestList';

const ENTITY_SET = 'gcp_pblbidderses';
const BASE_URL = `/_api/${ENTITY_SET}`;

const GUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const isGuid = (v: string | null | undefined): v is string =>
  !!v && GUID_REGEX.test(v);

type PblBidderLookupBinds = {
  /** GUID of the parent gcp_pblrequest row. Required on create. */
  pblRequestId?: string | null;
  /** GUID of the related Account (gcp_CompanyName lookup). */
  companyAccountId?: string | null;
};

const applyLookupBinds = (
  input: CreateGcpPblBidderInput,
  binds: PblBidderLookupBinds | undefined
): CreateGcpPblBidderInput => {
  if (!binds) return input;
  const out: CreateGcpPblBidderInput = { ...input };
  if (isGuid(binds.pblRequestId)) {
    out['gcp_PBLRequest@odata.bind'] = odataBind(
      'gcp_pblrequests',
      binds.pblRequestId
    );
  }
  if (isGuid(binds.companyAccountId)) {
    out['gcp_CompanyName@odata.bind'] = odataBind(
      'accounts',
      binds.companyAccountId
    );
  }
  return out;
};

type CreatePblBidderOptions = { lookups?: PblBidderLookupBinds };
type CreatePblBidderResult = { id: string };

const createPblBidder = async (
  input: CreateGcpPblBidderInput,
  options: CreatePblBidderOptions = {}
): Promise<CreatePblBidderResult> => {
  const body = applyLookupBinds(input, options.lookups);

  const res = await powerPagesFetchResponse(BASE_URL, {
    method: 'POST',
    json: body,
    headers: { Prefer: 'return=representation' },
  });

  let entity: GcpPblBidderEntity | undefined;
  const text = await res.text();
  if (text) {
    try {
      entity = JSON.parse(text) as GcpPblBidderEntity;
    } catch {
      entity = undefined;
    }
  }

  if (entity?.gcp_pblbiddersid) {
    return { id: entity.gcp_pblbiddersid };
  }
  const id = extractRecordId(res);
  if (!id) {
    throw new Error('Create PBL bidder succeeded but no record ID was returned.');
  }
  return { id };
};

// ── Update / delete (edit mode) ─────────────────────────────────────────────
const updatePblBidder = async (
  id: string,
  input: UpdateGcpPblBidderInput
): Promise<void> => {
  await powerPagesFetch<void>(`${BASE_URL}(${id})`, {
    method: 'PATCH',
    json: input,
    headers: { 'If-Match': '*' },
  });
};

/**
 * Hard-delete a bidder row (edit mode removes rows permanently — see
 * docs/edit-request-mode-plan.md). 404 is treated as success so a retried
 * save after a partial failure is idempotent.
 */
const deletePblBidder = async (id: string): Promise<void> => {
  try {
    await powerPagesFetch<void>(`${BASE_URL}(${id})`, { method: 'DELETE' });
  } catch (err) {
    if (err instanceof WebApiError && err.status === 404) return;
    throw err;
  }
};

/**
 * List bidder rows belonging to a single parent gcp_pblrequest. Bidders relate
 * to the PBL request (not directly to gcp_request) via the `gcp_PBLRequest`
 * lookup, exposed on GET as `_gcp_pblrequest_value`.
 */
const listBiddersByPblRequest = makeListByParent<GcpPblBidderEntity, GcpPblBidder>({
  baseUrl: BASE_URL,
  defaultSelect: DEFAULT_PBL_BIDDER_SELECT,
  map: mapGcpPblBidder,
  parentValueField: '_gcp_pblrequest_value',
});

export {
  createPblBidder,
  updatePblBidder,
  deletePblBidder,
  listBiddersByPblRequest,
  ENTITY_SET as PBL_BIDDER_ENTITY_SET,
};
export type {
  CreatePblBidderOptions,
  CreatePblBidderResult,
  PblBidderLookupBinds,
  ListChildOptions as ListPblBiddersOptions,
  ListChildResult as ListPblBiddersResult,
};
