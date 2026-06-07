// src/shared/services/engagementService.ts
// CRUD service for the gcp_engagements table (scheduled engagements/meetings).
//
// Power Pages site settings & table permissions for `gcp_engagements` must be
// configured before this works at runtime:
//   - Webapi/gcp_engagements/enabled = true
//   - Webapi/gcp_engagements/fields  = gcp_name,gcp_engagementnumber,
//       gcp_engagementdate,gcp_starttime,gcp_endtime,gcp_engagementtype,
//       gcp_engagementstatus,gcp_location,gcp_Slot,gcp_Request,
//       gcp_EngagementCreatedBy,gcp_AttendeeEmail
//   - a table permission granting the calling web role Create + Read + Write.

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
  DEFAULT_ENGAGEMENT_SELECT,
  mapGcpEngagement,
} from '../../types/engagement';
import type {
  CreateGcpEngagementInput,
  Engagement,
  GcpEngagementEntity,
} from '../../types/engagement';
import type {
  EngagementStatusValue,
  EngagementTypeValue,
} from '../../data/engagementChoices';

const ENTITY_SET = 'gcp_engagementses';
const BASE_URL = `/_api/${ENTITY_SET}`;

const GUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const isGuid = (v: string | null | undefined): v is string =>
  !!v && GUID_REGEX.test(v);

// ── List engagements for a request ───────────────────────────────────────────
const listEngagementsByRequest = async (
  requestId: string
): Promise<Engagement[]> => {
  const query: ODataQuery = {
    select: DEFAULT_ENGAGEMENT_SELECT,
    filter: `_gcp_request_value eq ${escapeODataString(requestId)}`,
    orderby: 'gcp_engagementdate asc',
  };
  const res = await powerPagesFetch<ODataListResponse<GcpEngagementEntity>>(
    `${BASE_URL}${buildODataQuery(query)}`,
    {
      method: 'GET',
      headers: combinePrefer(pageSizeHeader(100), includeFormattedValues()),
    }
  );
  return (res?.value ?? []).map(mapGcpEngagement);
};

// ── List all engagements (admin) ─────────────────────────────────────────────
const listEngagements = async (): Promise<Engagement[]> => {
  const query: ODataQuery = {
    select: DEFAULT_ENGAGEMENT_SELECT,
    orderby: 'gcp_engagementdate desc',
  };
  const res = await powerPagesFetch<ODataListResponse<GcpEngagementEntity>>(
    `${BASE_URL}${buildODataQuery(query)}`,
    {
      method: 'GET',
      headers: combinePrefer(pageSizeHeader(200), includeFormattedValues()),
    }
  );
  return (res?.value ?? []).map(mapGcpEngagement);
};

// ── Create ───────────────────────────────────────────────────────────────────
type EngagementBinds = {
  slotId?: string | null;
  requestId?: string | null;
  createdByContactId?: string | null;
  attendeeContactId?: string | null;
};

const applyBinds = (
  input: CreateGcpEngagementInput,
  binds: EngagementBinds
): CreateGcpEngagementInput => {
  const out: CreateGcpEngagementInput = { ...input };
  if (isGuid(binds.slotId)) out['gcp_Slot@odata.bind'] = odataBind('gcp_slots', binds.slotId);
  if (isGuid(binds.requestId)) out['gcp_Request@odata.bind'] = odataBind('gcp_requests', binds.requestId);
  if (isGuid(binds.createdByContactId))
    out['gcp_EngagementCreatedBy@odata.bind'] = odataBind('contacts', binds.createdByContactId);
  if (isGuid(binds.attendeeContactId))
    out['gcp_AttendeeEmail@odata.bind'] = odataBind('contacts', binds.attendeeContactId);
  return out;
};

const createEngagement = async (
  input: CreateGcpEngagementInput,
  binds: EngagementBinds = {}
): Promise<string> => {
  const body = applyBinds(input, binds);
  const res = await powerPagesFetchResponse(BASE_URL, {
    method: 'POST',
    json: body,
    headers: { Prefer: 'return=representation' },
  });

  let entity: GcpEngagementEntity | undefined;
  const text = await res.text();
  if (text) {
    try {
      entity = JSON.parse(text) as GcpEngagementEntity;
    } catch {
      entity = undefined;
    }
  }
  if (entity?.gcp_engagementsid) return entity.gcp_engagementsid;

  const id = extractRecordId(res);
  if (!id) throw new Error('Create engagement succeeded but no record ID was returned.');
  return id;
};

// ── Update status (e.g. cancel) ──────────────────────────────────────────────
const updateEngagementStatus = async (
  id: string,
  status: EngagementStatusValue
): Promise<void> => {
  await powerPagesFetch<void>(`${BASE_URL}(${id})`, {
    method: 'PATCH',
    json: { gcp_engagementstatus: status },
    headers: { 'If-Match': '*' },
  });
};

// ── Update engagement (admin — slot, type, location) ─────────────────────────
type UpdateGcpEngagementInput = {
  gcp_engagementdate?: string | null;
  gcp_starttime?: string | null;
  gcp_endtime?: string | null;
  gcp_engagementtype?: EngagementTypeValue;
  gcp_engagementstatus?: EngagementStatusValue;
  gcp_location?: string | null;
};

const applyUpdateBinds = (
  body: Record<string, unknown>,
  binds: EngagementBinds
): Record<string, unknown> => {
  const out = { ...body };
  if (isGuid(binds.slotId)) out['gcp_Slot@odata.bind'] = odataBind('gcp_slots', binds.slotId);
  if (isGuid(binds.attendeeContactId))
    out['gcp_AttendeeEmail@odata.bind'] = odataBind('contacts', binds.attendeeContactId);
  return out;
};

const updateEngagement = async (
  id: string,
  input: UpdateGcpEngagementInput,
  binds: EngagementBinds = {}
): Promise<void> => {
  const body = applyUpdateBinds(input as Record<string, unknown>, binds);
  await powerPagesFetch<void>(`${BASE_URL}(${id})`, {
    method: 'PATCH',
    json: body,
    headers: { 'If-Match': '*' },
  });
};

export {
  listEngagementsByRequest,
  listEngagements,
  createEngagement,
  updateEngagementStatus,
  updateEngagement,
  ENTITY_SET as ENGAGEMENT_ENTITY_SET,
};
export type { EngagementBinds, UpdateGcpEngagementInput };
