// src/shared/services/slotService.ts
// CRUD service for the gcp_slot table (meeting / engagement slots).
//
// Power Pages site settings & table permissions for `gcp_slot` must be
// configured before this works at runtime:
//   - Webapi/gcp_slot/enabled = true
//   - Webapi/gcp_slot/fields = gcp_type,gcp_slotstatus,gcp_date,gcp_start,
//       gcp_end,gcp_Attendee,gcp_Attendee_1,gcp_Attendee_2
//   - a table permission granting the calling web role Create + Read (Global
//       scope, plus Read on `contact` for the attendee lookups).

import {
  buildODataQuery,
  combinePrefer,
  extractRecordId,
  includeFormattedValues,
  odataBind,
  pageSizeHeader,
  powerPagesFetch,
  powerPagesFetchResponse,
} from '../powerPagesApi';
import type { ODataListResponse, ODataQuery } from '../powerPagesApi';
import {
  SLOT_STATUS_AVAILABLE,
  type SlotStatusValue,
} from '../../data/slotChoices';
import {
  DEFAULT_SLOT_SELECT,
  mapGcpSlot,
  type CreateGcpSlotInput,
  type GcpSlotEntity,
  type Slot,
} from '../../types/slot';

const ENTITY_SET = 'gcp_slots';
const BASE_URL = `/_api/${ENTITY_SET}`;

const GUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const isGuid = (v: string | null | undefined): v is string =>
  !!v && GUID_REGEX.test(v);

// The three attendee lookups, in the order users add them. Each accepts a
// contact GUID and is written via its `@odata.bind` navigation property. The
// parallel text columns store each attendee's email, paired by index.
const ATTENDEE_BINDS = [
  'gcp_Attendee@odata.bind',
  'gcp_Attendee_1@odata.bind',
  'gcp_Attendee_2@odata.bind',
] as const;

const ATTENDEE_EMAIL_COLS = [
  'gcp_attendeeemail',
  'gcp_attendeeemail_1',
  'gcp_attendeeemail_2',
] as const;

const MAX_ATTENDEES = ATTENDEE_BINDS.length;

/** A slot attendee to write: a contact GUID plus their email (for the text column). */
type SlotAttendeeInput = { contactId: string; email?: string | null };

const applyAttendeeBinds = (
  input: CreateGcpSlotInput,
  attendees: readonly (SlotAttendeeInput | null | undefined)[] | undefined
): CreateGcpSlotInput => {
  if (!attendees?.length) return input;
  const out: CreateGcpSlotInput = { ...input };
  attendees
    .filter((a): a is SlotAttendeeInput => isGuid(a?.contactId))
    .slice(0, MAX_ATTENDEES)
    .forEach((a, i) => {
      out[ATTENDEE_BINDS[i]] = odataBind('contacts', a.contactId);
      out[ATTENDEE_EMAIL_COLS[i]] = a.email ?? null;
    });
  return out;
};

// ── List ────────────────────────────────────────────────────────────────────
type SlotTab = 'available' | 'booked';

type ListSlotsOptions = {
  /** Which tab to load. `available` = status is Available; `booked` = anything else. */
  tab?: SlotTab;
  pageSize?: number;
  nextLink?: string;
};

type ListSlotsResult = {
  items: Slot[];
  totalCount?: number;
  nextLink?: string;
};

const tabFilter = (tab: SlotTab | undefined): string | undefined => {
  if (tab === 'available') return `gcp_slotstatus eq ${SLOT_STATUS_AVAILABLE}`;
  if (tab === 'booked') return `gcp_slotstatus ne ${SLOT_STATUS_AVAILABLE}`;
  return undefined;
};

const listSlots = async (
  options: ListSlotsOptions = {}
): Promise<ListSlotsResult> => {
  const pageSize = options.pageSize ?? 50;

  let url: string;
  if (options.nextLink) {
    url = options.nextLink;
  } else {
    const query: ODataQuery = {
      select: DEFAULT_SLOT_SELECT,
      filter: tabFilter(options.tab),
      orderby: 'gcp_start asc',
      count: true,
    };
    url = `${BASE_URL}${buildODataQuery(query)}`;
  }

  const res = await powerPagesFetch<ODataListResponse<GcpSlotEntity>>(url, {
    method: 'GET',
    headers: combinePrefer(pageSizeHeader(pageSize), includeFormattedValues()),
  });

  return {
    items: (res?.value ?? []).map(mapGcpSlot),
    totalCount: res?.['@odata.count'],
    nextLink: res?.['@odata.nextLink'],
  };
};

// ── Create ──────────────────────────────────────────────────────────────────
type CreateSlotOptions = {
  /** The (up to 3) attendees for the slot lookups, in order. */
  attendees?: readonly (SlotAttendeeInput | null | undefined)[];
};

type CreateSlotResult = { id: string; record?: Slot };

const createSlot = async (
  input: CreateGcpSlotInput,
  options: CreateSlotOptions = {}
): Promise<CreateSlotResult> => {
  const body = applyAttendeeBinds(input, options.attendees);

  const res = await powerPagesFetchResponse(BASE_URL, {
    method: 'POST',
    json: body,
    headers: { Prefer: 'return=representation' },
  });

  let entity: GcpSlotEntity | undefined;
  const text = await res.text();
  if (text) {
    try {
      entity = JSON.parse(text) as GcpSlotEntity;
    } catch {
      entity = undefined;
    }
  }

  if (entity?.gcp_slotid) {
    return { id: entity.gcp_slotid, record: mapGcpSlot(entity) };
  }

  const id = extractRecordId(res);
  if (!id) {
    throw new Error('Create slot succeeded but no record ID was returned.');
  }
  return { id };
};

// ── Available slots within the next N months (for engagement booking) ────────
const listAvailableSlotsWithin = async (months = 6): Promise<Slot[]> => {
  const filter =
    `(Microsoft.Dynamics.CRM.NextXMonths(PropertyName='gcp_date',PropertyValue=${months})` +
    ` and gcp_slotstatus eq ${SLOT_STATUS_AVAILABLE})`;
  const query: ODataQuery = {
    select: DEFAULT_SLOT_SELECT,
    filter,
    orderby: 'gcp_date asc',
  };
  const res = await powerPagesFetch<ODataListResponse<GcpSlotEntity>>(
    `${BASE_URL}${buildODataQuery(query)}`,
    {
      method: 'GET',
      headers: combinePrefer(pageSizeHeader(200), includeFormattedValues()),
    }
  );
  return (res?.value ?? []).map(mapGcpSlot);
};

// ── Update slot status (book / free) ─────────────────────────────────────────
const updateSlotStatus = async (
  id: string,
  status: SlotStatusValue
): Promise<void> => {
  await powerPagesFetch<void>(`${BASE_URL}(${id})`, {
    method: 'PATCH',
    json: { gcp_slotstatus: status },
    headers: { 'If-Match': '*' },
  });
};

// ── Update slot (admin edit — title, date/time, status, attendees) ────────────
type UpdateSlotInput = {
  gcp_type?: string | null;
  gcp_slotstatus?: number | null;
  gcp_date?: string | null;
  gcp_start?: string | null;
  gcp_end?: string | null;
};

type UpdateSlotOptions = {
  /**
   * New attendees for the three attendee slots (index 0-2).
   * Pass `null` to explicitly clear that attendee slot, `undefined` to leave it unchanged.
   */
  attendees?: readonly (SlotAttendeeInput | null | undefined)[];
};

const ATTENDEE_NAV_PROPS = ['gcp_Attendee', 'gcp_Attendee_1', 'gcp_Attendee_2'] as const;

const applyAttendeeUpdates = (
  body: Record<string, unknown>,
  attendees: readonly (SlotAttendeeInput | null | undefined)[] | undefined
): Record<string, unknown> => {
  if (!attendees) return body;
  const out = { ...body };
  attendees.slice(0, ATTENDEE_NAV_PROPS.length).forEach((attendee, i) => {
    if (attendee === undefined) return; // leave this slot unchanged
    const nav = ATTENDEE_NAV_PROPS[i];
    const set = attendee && isGuid(attendee.contactId);
    if (set) {
      // Associate: append @odata.bind to the navigation property name.
      out[`${nav}@odata.bind`] = odataBind('contacts', attendee.contactId);
    } else {
      // Disassociate: set the navigation property name itself to null —
      // WITHOUT the @odata.bind annotation (setting `<nav>@odata.bind: null`
      // is rejected by Dataverse). See "Disassociate by using a single-valued
      // navigation property" in the Web API docs.
      out[nav] = null;
    }
    out[ATTENDEE_EMAIL_COLS[i]] = set ? attendee.email ?? null : null;
  });
  return out;
};

const updateSlot = async (
  id: string,
  input: UpdateSlotInput,
  options: UpdateSlotOptions = {}
): Promise<void> => {
  const body = applyAttendeeUpdates(input as Record<string, unknown>, options.attendees);
  await powerPagesFetch<void>(`${BASE_URL}(${id})`, {
    method: 'PATCH',
    json: body,
    headers: { 'If-Match': '*' },
  });
};

export {
  listSlots,
  createSlot,
  listAvailableSlotsWithin,
  updateSlotStatus,
  updateSlot,
  MAX_ATTENDEES,
  ENTITY_SET as SLOT_ENTITY_SET,
};
export type {
  SlotTab,
  ListSlotsOptions,
  ListSlotsResult,
  CreateSlotOptions,
  CreateSlotResult,
  UpdateSlotInput,
  UpdateSlotOptions,
  SlotAttendeeInput,
};
