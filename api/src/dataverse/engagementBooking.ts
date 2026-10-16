import { createHash } from 'node:crypto';
import { bookingChoices as choices } from '../../generated/bookingChoices.js';
import { DataverseError } from './dataverseClient.js';
import { DataverseBatchError, type ChangeSetOperation } from './dataverseBatch.js';

// Logical names and navigation properties mirror src/types/{request,slot,
// engagement}.ts and the existing table services. The schema is externally owned.
type Row = Record<string, unknown> & { '@odata.etag'?: string };
export interface BookingIdentity {
  contactId: string;
  siteId: string;
  dataverseUrl: string;
}
export interface BookingIo {
  getRequest: (id: string) => Promise<Row | null>;
  getEngagement: (id: string) => Promise<Row | null>;
  getSlot: (id: string) => Promise<Row | null>;
  listForRequest: (id: string) => Promise<Row[]>;
  listForSlot: (id: string) => Promise<Row[]>;
  listSlots: () => Promise<Row[]>;
  listScheduledSlots: () => Promise<Row[]>;
  listAllEngagements: () => Promise<Row[]>;
  isAdmin: (contactId: string) => Promise<boolean>;
  ensureConcurrency: () => Promise<void>;
  transact: (operations: readonly ChangeSetOperation[]) => Promise<void>;
  now: () => number;
}
export interface BookingResult {
  ok: true;
  engagementId: string;
  slotId: string | null;
  previousSlotId: string | null;
}
export class BookingError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'BookingError';
  }
}
function conflict(message: string): never {
  throw new BookingError(`${message} Refresh the request and availability.`, 409);
}
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const guid = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || !GUID.test(value)) throw new BookingError(`A valid ${label} is required.`, 400);
  return value.toLowerCase();
};
const text = (value: unknown): string => typeof value === 'string' ? value : '';
const sameId = (left: unknown, right: unknown): boolean =>
  typeof left === 'string' && typeof right === 'string' && left.toLowerCase() === right.toLowerCase();
const statusValue = (label: string): number => {
  const choice = choices.requestStatusChoices.find((candidate) => candidate.label === label);
  if (!choice) throw new Error(`Canonical request status '${label}' is missing`);
  return choice.value;
};
const REVIEW = statusValue('R');
const READY = statusValue('Ready for Engagement');
const scheduled = (row: Row): boolean => row.gcp_engagementstatus === choices.ENGAGEMENT_STATUS_SCHEDULED;
const etag = (row: Row): string => {
  const value = row['@odata.etag'];
  if (!value || !/^(?:W\/)?"[^"\r\n]+"$/.test(value)) {
    throw new BookingError('A required record version is unavailable. Refresh before changing this booking.', 503);
  }
  return value;
};
const patch = (path: string, body: Row, row: Row): ChangeSetOperation => ({
  method: 'PATCH', path, body, headers: { 'If-Match': etag(row) },
});
const instant = (value: unknown): number => typeof value === 'string' && value ? Date.parse(value) : NaN;
const bind = (set: string, id: string): string => `/${set}(${id})`;

/** One operation id names exactly one create in one portal/contact/request.
 * The GUID primary key is the uniqueness constraint; no schema is introduced. */
const createdEngagementId = (operationId: string, identity: BookingIdentity, requestId: string): string => {
  const hash = createHash('sha256').update([
    'gcp-engagement-booking-v1', identity.dataverseUrl.toLowerCase(),
    identity.siteId.toLowerCase(), identity.contactId.toLowerCase(), requestId, operationId,
  ].join('|')).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const details = (input: Row, saved: Row | null): Row => {
  const name = input.name === undefined ? text(saved?.gcp_name).trim() : text(input.name).trim();
  const type = input.type === undefined ? saved?.gcp_engagementtype : input.type;
  const location = input.location === undefined ? saved?.gcp_location : input.location;
  if (!name) throw new BookingError('An engagement name is required.', 400);
  if (!choices.engagementTypeChoices.some((choice) => choice.value === type)) {
    throw new BookingError('Choose a valid engagement type.', 400);
  }
  if (location !== null && location !== undefined && typeof location !== 'string') {
    throw new BookingError('Meeting location must be text or null.', 400);
  }
  if (type === choices.ENGAGEMENT_TYPE_PHYSICAL && !text(location).trim()) {
    throw new BookingError('A meeting location is required for an in-person engagement.', 400);
  }
  return { gcp_name: name, gcp_engagementtype: type,
    gcp_location: type === choices.ENGAGEMENT_TYPE_PHYSICAL ? text(location).trim() : null };
};
const slotData = (slot: Row, requireFuture: boolean, now: number): Row => {
  const start = instant(slot.gcp_start), end = instant(slot.gcp_end), date = instant(slot.gcp_date);
  if (![start, end, date].every(Number.isFinite) || end <= start) conflict('The saved slot has invalid meeting dates.');
  if (requireFuture && start <= now) conflict('The selected slot has already started.');
  const attendee = slot._gcp_attendee_value ?? slot._gcp_attendee_1_value ?? slot._gcp_attendee_2_value;
  return {
    gcp_engagementdate: new Date(date).toISOString(),
    gcp_starttime: slot.gcp_start, gcp_endtime: slot.gcp_end,
    ...(attendee ? { 'gcp_AttendeeEmail@odata.bind': bind('contacts', guid(attendee, 'slot attendee')) } : { gcp_AttendeeEmail: null }),
  };
};
const matchesBody = (row: Row, body: Row): boolean => Object.entries(body).every(([key, value]) => {
  const lookupKeys: Record<string, string> = {
    'gcp_Slot@odata.bind': '_gcp_slot_value',
    'gcp_Request@odata.bind': '_gcp_request_value',
    'gcp_EngagementCreatedBy@odata.bind': '_gcp_engagementcreatedby_value',
    'gcp_AttendeeEmail@odata.bind': '_gcp_attendeeemail_value',
  };
  if (lookupKeys[key]) return sameId(row[lookupKeys[key]], text(value).match(/\(([0-9a-f-]+)\)$/i)?.[1]);
  if (key === 'gcp_AttendeeEmail') return !row._gcp_attendeeemail_value;
  if (['gcp_engagementdate', 'gcp_starttime', 'gcp_endtime'].includes(key)) {
    return Number.isFinite(instant(value)) && instant(row[key]) === instant(value);
  }
  return (row[key] ?? null) === (value ?? null);
});

interface ExpectedState {
  engagementId: string;
  requestId: string;
  originalOwner: string;
  body: Row;
  activeSlotId: string | null;
  expectedSlots: Array<{ id: string; status: number; engagementIds: string[] }>;
}
const reconcile = async (expected: ExpectedState, io: BookingIo): Promise<boolean> => {
  // Reads are deliberately not mutations or retries. An incomplete or changed
  // snapshot cannot prove success and is surfaced to the caller as uncertain.
  try {
    const request = await io.getRequest(expected.requestId);
    const engagement = await io.getEngagement(expected.engagementId);
    if (!request || request.gcp_requeststatus !== REVIEW ||
        !sameId(request._gcp_requestorname_value, expected.originalOwner) ||
        !engagement || !sameId(engagement._gcp_request_value, expected.requestId) ||
        !matchesBody(engagement, expected.body)) return false;
    const active = (await io.listForRequest(expected.requestId)).filter(scheduled);
    if (expected.activeSlotId ? active.length !== 1 || !sameId(active[0].gcp_engagementsid, expected.engagementId)
      : active.length !== 0) return false;
    for (const slot of expected.expectedSlots) {
      const row = await io.getSlot(slot.id);
      const reservations = (await io.listForSlot(slot.id)).filter(scheduled);
      if (!row || row.gcp_slotstatus !== slot.status || reservations.length !== slot.engagementIds.length ||
          !reservations.every((reservation) => slot.engagementIds.some((id) => sameId(id, reservation.gcp_engagementsid)))) return false;
    }
    return true;
  } catch { return false; }
};

/** Authorization and the complete intended transaction, with external IO at
 * the boundary so security, rollback and uncertain writes can be exercised. */
export const executeEngagementBooking = async (
  raw: unknown,
  identity: BookingIdentity,
  io: BookingIo,
): Promise<BookingResult> => {
  if (!identity.contactId || !GUID.test(identity.contactId)) throw new BookingError('A validated portal contact is required.', 403);
  if (!identity.siteId || !GUID.test(identity.siteId) || !identity.dataverseUrl) {
    throw new BookingError('Booking is unavailable until this portal has an environment and site mapping.', 503);
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BookingError('Expected a JSON booking object.', 400);
  const input = raw as Row;
  const action = input.action;
  if (!['create', 'reschedule', 'cancel'].includes(text(action))) throw new BookingError('Choose create, reschedule or cancel.', 400);
  const requestId = guid(input.requestId, 'request ID');
  const operationId = action === 'create' ? guid(input.operationId, 'operation ID') : undefined;
  const engagementId = action === 'create' ? createdEngagementId(operationId!, identity, requestId) : guid(input.engagementId, 'engagement ID');
  const selectedSlotId = action !== 'cancel' ? guid(input.slotId, 'slot ID') : null;
  const request = await io.getRequest(requestId);
  if (!request) throw new BookingError('The request was not found.', 404);
  const admin = await io.isAdmin(identity.contactId);
  if (!sameId(request._gcp_requestorname_value, identity.contactId) && !admin) {
    throw new BookingError('Only the original requester or a site administrator may change this booking.', 403);
  }
  const owner = guid(request._gcp_requestorname_value, 'original requester');
  if (action === 'create' ? ![READY, REVIEW].includes(Number(request.gcp_requeststatus)) : request.gcp_requeststatus !== REVIEW) {
    conflict('This request is no longer at the booking stage.');
  }
  const all = await io.listForRequest(requestId);
  const active = all.filter(scheduled);
  const saved = await io.getEngagement(engagementId);
  if (action !== 'create' && (!saved || !sameId(saved._gcp_request_value, requestId))) {
    conflict('The engagement is not bound to this request.');
  }
  if (action !== 'create' && (!input.expectedVersion || input.expectedVersion !== etag(saved!))) {
    conflict('This booking changed since the editor was opened, or the editor needs updating.');
  }
  const body = action === 'cancel' ? { gcp_engagementstatus: choices.ENGAGEMENT_STATUS_CANCELLED } : details(input, saved);
  // Supported administrator slot deletion detaches engagements while retaining
  // their history. Cancellation must still clear that active booking.
  const detachedCancellation = action === 'cancel' && saved?._gcp_slot_value == null;
  const previousSlotId = action === 'create' || detachedCancellation
    ? null : guid(saved?._gcp_slot_value, 'existing engagement slot');
  const result: BookingResult = { ok: true, engagementId, slotId: selectedSlotId, previousSlotId };
  const expected: ExpectedState = { engagementId, requestId, originalOwner: owner,
    body, activeSlotId: selectedSlotId, expectedSlots: [] };
  const operations: ChangeSetOperation[] = [];
  if (action === 'create') {
    const slot = await io.getSlot(selectedSlotId!);
    if (!slot) conflict('The selected slot was removed.');
    Object.assign(body, slotData(slot, !saved, io.now()), {
      gcp_engagementstatus: choices.ENGAGEMENT_STATUS_SCHEDULED,
      'gcp_Slot@odata.bind': bind('gcp_slots', selectedSlotId!),
      'gcp_Request@odata.bind': bind('gcp_requests', requestId),
      'gcp_EngagementCreatedBy@odata.bind': bind('contacts', identity.contactId.toLowerCase()),
    });
    expected.expectedSlots.push({ id: selectedSlotId!, status: choices.SLOT_STATUS_BOOKED, engagementIds: [engagementId] });
    if (saved) {
      if (await reconcile(expected, io)) return result;
      conflict('This operation ID already belongs to a booking with different or progressed data.');
    }
    if (active.length) conflict('The request already has a scheduled engagement.');
    if (slot.gcp_slotstatus !== choices.SLOT_STATUS_AVAILABLE || (await io.listForSlot(selectedSlotId!)).some(scheduled)) {
      conflict('The selected slot is no longer available.');
    }
    body.gcp_engagementnumber = `R${String(all.filter((row) => row.gcp_engagementstatus === choices.ENGAGEMENT_STATUS_COMPLETED).length + 1).padStart(2, '0')}`;
    operations.push(patch(`gcp_slots(${selectedSlotId})`, { gcp_slotstatus: choices.SLOT_STATUS_BOOKED }, slot),
      { method: 'PATCH', path: `gcp_engagementses(${engagementId})`, body, headers: { 'If-None-Match': '*' } });
  } else {
    if (!scheduled(saved!) || active.length !== 1 || !sameId(active[0].gcp_engagementsid, engagementId)) {
      conflict('The request must have exactly one scheduled engagement.');
    }
    expected.body = { ...body, gcp_engagementnumber: saved!.gcp_engagementnumber,
      _gcp_engagementcreatedby_value: saved!._gcp_engagementcreatedby_value };
    if (detachedCancellation) {
      operations.push(patch(`gcp_engagementses(${engagementId})`, body, saved!));
      Object.assign(expected.body, { _gcp_slot_value: null });
    } else {
      const oldSlot = await io.getSlot(previousSlotId!);
      if (!oldSlot || oldSlot.gcp_slotstatus !== choices.SLOT_STATUS_BOOKED) conflict('The current slot reservation is inconsistent.');
      const oldReservations = (await io.listForSlot(previousSlotId!)).filter(scheduled);
      if (oldReservations.filter((row) => sameId(row.gcp_engagementsid, engagementId)).length !== 1) {
        conflict('The current slot no longer contains this booking.');
      }
      // Historical bookings can still reference a slot that was reused later.
      // Moving/cancelling this engagement must never free the other reservation.
      const remainingReservationIds = oldReservations
        .filter((row) => !sameId(row.gcp_engagementsid, engagementId))
        .map((row) => guid(row.gcp_engagementsid, 'existing reservation ID'));
      const vacatedSlotStatus = remainingReservationIds.length
        ? choices.SLOT_STATUS_BOOKED : choices.SLOT_STATUS_AVAILABLE;
      if (action === 'cancel') {
        const start = instant(saved!.gcp_starttime);
        if (!Number.isFinite(start)) conflict('The engagement has an invalid saved start time.');
        const release = remainingReservationIds.length === 0 && (admin || start - io.now() > 2 * 60 * 60 * 1000);
        operations.push(patch(`gcp_engagementses(${engagementId})`, body, saved!));
        // Even a retained reservation gets a conditional guard in the transaction.
        operations.push(patch(`gcp_slots(${previousSlotId})`, {
          gcp_slotstatus: release ? choices.SLOT_STATUS_AVAILABLE : choices.SLOT_STATUS_BOOKED,
        }, oldSlot));
        Object.assign(expected.body, { 'gcp_Slot@odata.bind': bind('gcp_slots', previousSlotId!) });
        expected.expectedSlots.push({ id: previousSlotId!, status: release ? choices.SLOT_STATUS_AVAILABLE : choices.SLOT_STATUS_BOOKED, engagementIds: remainingReservationIds });
      } else {
        if (selectedSlotId !== previousSlotId) {
          const slot = await io.getSlot(selectedSlotId!);
          if (!slot || slot.gcp_slotstatus !== choices.SLOT_STATUS_AVAILABLE || (await io.listForSlot(selectedSlotId!)).some(scheduled)) {
            conflict('The selected slot is no longer available.');
          }
          Object.assign(body, slotData(slot, true, io.now()), { 'gcp_Slot@odata.bind': bind('gcp_slots', selectedSlotId!) });
          operations.push(patch(`gcp_slots(${selectedSlotId})`, { gcp_slotstatus: choices.SLOT_STATUS_BOOKED }, slot));
          expected.expectedSlots.push({ id: previousSlotId!, status: vacatedSlotStatus, engagementIds: remainingReservationIds });
        }
        expected.expectedSlots.push({ id: selectedSlotId!, status: choices.SLOT_STATUS_BOOKED,
          engagementIds: selectedSlotId === previousSlotId ? [engagementId, ...remainingReservationIds] : [engagementId] });
        operations.push(patch(`gcp_engagementses(${engagementId})`, body, saved!));
        if (selectedSlotId !== previousSlotId) {
          operations.push(patch(`gcp_slots(${previousSlotId})`, { gcp_slotstatus: vacatedSlotStatus }, oldSlot));
        } else {
          // Keep the observed reservation guarded even when its slot is unchanged.
          operations.push(patch(`gcp_slots(${previousSlotId})`, { gcp_slotstatus: choices.SLOT_STATUS_BOOKED }, oldSlot));
        }
        // Preserve identity/status as reconciliation expectations, without writing
        // the creator, number, request binding or completed workflow information.
        Object.assign(expected.body, { gcp_engagementstatus: choices.ENGAGEMENT_STATUS_SCHEDULED,
          'gcp_Slot@odata.bind': bind('gcp_slots', selectedSlotId!), gcp_engagementnumber: saved!.gcp_engagementnumber });
      }
    }
  }
  expected.body = { ...body, ...expected.body };
  const requestGuard = patch(`gcp_requests(${requestId})`, { gcp_requeststatus: REVIEW }, request);
  // Engagement creation runs existing synchronous workflows that also update
  // this parent. Check its observed version before our own workflow changes it,
  // inside the same atomic changeset so any later failure still rolls back all.
  if (action === 'create') operations.unshift(requestGuard);
  else operations.push(requestGuard);
  await io.ensureConcurrency();
  try {
    await io.transact(operations);
    return result;
  } catch (error) {
    // Conditional failures cannot be retried with new ETags. Only a repeated
    // create with the same deterministic id may already match this intent.
    const knownFailure = error instanceof DataverseBatchError ? !error.uncertain
      : error instanceof DataverseError && error.status >= 400 && error.status < 500;
    if (!knownFailure || action === 'create') {
      if (await reconcile(expected, io)) return result;
    }
    if (knownFailure) {
      if (error instanceof DataverseError && [409, 412, 404].includes(error.status)) conflict('The booking or reservation changed while it was being saved.');
      throw new BookingError('The booking transaction was rejected. Your previous booking was preserved; refresh before trying again.', 502);
    }
    throw new BookingError('The booking response could not be confirmed. Refresh the request and availability before trying again; keep the same operation ID for a create retry.', 503);
  }
};

/** Booking reads bypass the Power Pages cache after Function-side writes.
 * The portal identity and owner/admin boundary are identical to mutations. */
export const readEngagementBooking = async (
  input: { requestId?: string; scope?: string }, identity: BookingIdentity, io: BookingIo,
): Promise<{ ok: true; request: Row | null; engagements: Row[]; slots: Row[]; currentSlot: Row | null }> => {
  if (!GUID.test(identity.contactId ?? '')) throw new BookingError('A validated portal contact is required.', 403);
  if (!GUID.test(identity.siteId ?? '') || !identity.dataverseUrl) throw new BookingError('Booking requires an environment and site mapping.', 503);
  const adminScope = input.scope === 'slots' || input.scope === 'management';
  if (input.scope && !adminScope) throw new BookingError('Unknown booking read scope.', 400);
  const requestId = adminScope ? null : guid(input.requestId, 'request ID');
  const request = requestId ? await io.getRequest(requestId) : null;
  if (requestId && !request) throw new BookingError('The request was not found.', 404);
  const admin = await io.isAdmin(identity.contactId);
  if (adminScope ? !admin : !admin && !sameId(request!._gcp_requestorname_value, identity.contactId)) {
    throw new BookingError('Only the original requester or a site administrator may read this booking.', 403);
  }
  const engagements = requestId ? await io.listForRequest(requestId)
    : input.scope === 'management' ? await io.listAllEngagements() : [];
  const [slots, reservations] = await Promise.all([io.listSlots(), io.listScheduledSlots()]);
  const occupied = new Set(reservations.map(row => text(row._gcp_slot_value).toLowerCase()));
  const effectiveSlots = slots.map(slot => occupied.has(text(slot.gcp_slotid).toLowerCase())
    ? { ...slot, gcp_slotstatus: choices.SLOT_STATUS_BOOKED,
      'gcp_slotstatus@OData.Community.Display.V1.FormattedValue': 'Booked' } : slot);
  const current = engagements.find(scheduled);
  const currentSlot = effectiveSlots.find(slot => sameId(slot.gcp_slotid, current?._gcp_slot_value)) ?? null;
  const until = new Date(io.now()); until.setUTCMonth(until.getUTCMonth() + 6);
  return { ok: true, request, engagements, currentSlot,
    slots: adminScope ? effectiveSlots : effectiveSlots.filter(slot =>
      slot.gcp_slotstatus === choices.SLOT_STATUS_AVAILABLE && instant(slot.gcp_start) > io.now() && instant(slot.gcp_start) < until.getTime()),
  };
};
