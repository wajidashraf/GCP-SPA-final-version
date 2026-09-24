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
} from '../powerPagesApi.ts';
import type { ODataListResponse, ODataQuery } from '../powerPagesApi.ts';
import {
  buildLatestCompletedEngagementQuery,
  DEFAULT_ENGAGEMENT_SELECT,
  mapGcpEngagement,
  readLatestEngagementNumber,
} from '../../types/engagement.ts';
import type {
  CreateGcpEngagementInput,
  Engagement,
  EngagementNumberListResponse,
  GcpEngagementEntity,
} from '../../types/engagement.ts';
import type {
  EngagementStatusValue,
  EngagementTypeValue,
} from '../../data/engagementChoices.ts';

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

const getLatestCompletedEngagementNumberByRequest = async (
  requestId: string,
): Promise<string | null> => {
  const query = buildLatestCompletedEngagementQuery(requestId);
  const response = await powerPagesFetch<EngagementNumberListResponse>(
    `${BASE_URL}${buildODataQuery(query)}`,
    { method: 'GET' },
  );
  return readLatestEngagementNumber(response);
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

const buildEngagementsBySlotQuery = (slotId: string): string => {
  if (!isGuid(slotId)) throw new Error('A valid slot ID is required.');
  return buildODataQuery({
    select: DEFAULT_ENGAGEMENT_SELECT,
    filter: `_gcp_slot_value eq ${slotId}`,
    orderby: 'createdon asc',
  });
};

type EngagementListPageIo = {
  getPage: (
    url: string,
  ) => Promise<ODataListResponse<GcpEngagementEntity>>;
};

const defaultEngagementListPageIo: EngagementListPageIo = {
  getPage: (url) =>
    powerPagesFetch<ODataListResponse<GcpEngagementEntity>>(url, {
      method: 'GET',
      headers: combinePrefer(pageSizeHeader(200), includeFormattedValues()),
    }),
};

const listEngagementsBySlot = async (
  slotId: string,
  io: EngagementListPageIo = defaultEngagementListPageIo,
): Promise<Engagement[]> => {
  let url = `${BASE_URL}${buildEngagementsBySlotQuery(slotId)}`;
  const rows: Engagement[] = [];
  while (url) {
    const response = await io.getPage(url);
    rows.push(...(response?.value ?? []).map(mapGcpEngagement));
    url = response?.['@odata.nextLink'] ?? '';
  }
  return rows;
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

const clearEngagementSlot = async (id: string): Promise<void> => {
  if (!isGuid(id)) throw new Error('A valid engagement ID is required.');
  await powerPagesFetch<void>(`${BASE_URL}(${id})`, {
    method: 'PATCH',
    json: { gcp_Slot: null },
    headers: { 'If-Match': '*' },
  });
};

const restoreEngagementSlot = async (
  id: string,
  slotId: string,
): Promise<void> => {
  if (!isGuid(id)) throw new Error('A valid engagement ID is required.');
  if (!isGuid(slotId)) throw new Error('A valid slot ID is required.');
  await powerPagesFetch<void>(`${BASE_URL}(${id})`, {
    method: 'PATCH',
    json: { 'gcp_Slot@odata.bind': odataBind('gcp_slots', slotId) },
    headers: { 'If-Match': '*' },
  });
};

export {
  getLatestCompletedEngagementNumberByRequest,
  listEngagementsByRequest,
  listEngagements,
  listEngagementsBySlot,
  buildEngagementsBySlotQuery,
  createEngagement,
  updateEngagementStatus,
  updateEngagement,
  clearEngagementSlot,
  restoreEngagementSlot,
  ENTITY_SET as ENGAGEMENT_ENTITY_SET,
};
export type {
  EngagementBinds,
  EngagementListPageIo,
  UpdateGcpEngagementInput,
};
