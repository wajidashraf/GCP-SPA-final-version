import { acquirePortalToken, clearPortalToken } from './portalToken';
import { uploadConfig } from './uploadConfig';
import type { EngagementTypeValue } from '../data/engagementChoices';
import { mapGcpEngagement, type GcpEngagementEntity } from '../types/engagement';
import { mapGcpSlot, type GcpSlotEntity } from '../types/slot';
import { requestStatusChoices } from '../data/requestChoices';
import { parseChoiceValue } from '../data/types';
import type { RequestStatusSnapshot } from './requestStatusPresentation';

export const loadRequestStatuses = async (ids: string[]): Promise<RequestStatusSnapshot[]> => {
  if (!ids.length) return [];
  if (!uploadConfig.isConfigured) throw new Error('Current request statuses are unavailable. Contact your administrator.');
  const token = await acquirePortalToken();
  const query = new URLSearchParams({ scope: 'request-statuses', requestIds: ids.join(',') });
  const response = await fetch(`${uploadConfig.functionBaseUrl}/api/engagementBookings?${query}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(60_000),
  });
  if (response.status === 401) clearPortalToken();
  const body = await response.json() as { ok?: boolean; requests?: Array<{ id: string; status: number | null }>; error?: string };
  if (!response.ok || !body.ok || !Array.isArray(body.requests)) {
    throw new Error(body.error || 'Could not verify current request statuses. Refresh the Requests list to retry.');
  }
  return body.requests.map(row => {
    const status = row.status === null ? null : parseChoiceValue(requestStatusChoices, String(row.status));
    if (typeof row.id !== 'string' || !ids.some(id => id.toLowerCase() === row.id.toLowerCase()) || status === undefined) {
      throw new Error('The current request statuses could not be verified.');
    }
    return { id: row.id, status };
  });
};

type BookingSnapshot = {
  ok: true;
  request: { gcp_requestid: string; gcp_requeststatus: number | null; _gcp_requestorname_value: string | null } | null;
  engagements: GcpEngagementEntity[];
  slots: GcpSlotEntity[];
  currentSlot: GcpSlotEntity | null;
};

const readBookingSnapshot = async (query: URLSearchParams): Promise<BookingSnapshot> => {
  if (!uploadConfig.isConfigured) throw new Error('Booking is not configured. Contact your administrator.');
  const token = await acquirePortalToken();
  const response = await fetch(`${uploadConfig.functionBaseUrl}/api/engagementBookings?${query}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(60_000),
  });
  if (response.status === 401) clearPortalToken();
  const body = await response.json() as Partial<BookingSnapshot> & { error?: string };
  if (!response.ok || !body.ok || !Array.isArray(body.slots) || !Array.isArray(body.engagements)) {
    throw new Error(body.error || 'Could not load the current booking and availability. Close and reopen the form to retry.');
  }
  return body as BookingSnapshot;
};

/** Fresh reads use the same portal identity and server-side authorization as saves. */
export const loadEngagementBooking = async (requestId: string) => {
  const snapshot = await readBookingSnapshot(new URLSearchParams({ requestId }));
  if (!snapshot.request) throw new Error('The request was not found.');
  return { request: { status: parseChoiceValue(requestStatusChoices, String(snapshot.request.gcp_requeststatus)) ?? null,
    requestorContactId: snapshot.request._gcp_requestorname_value },
    engagements: snapshot.engagements.map(mapGcpEngagement), slots: snapshot.slots.map(mapGcpSlot),
    currentSlot: snapshot.currentSlot ? mapGcpSlot(snapshot.currentSlot) : null };
};

export const loadBookingManagementSlots = async () =>
  (await readBookingSnapshot(new URLSearchParams({ scope: 'slots' }))).slots.map(mapGcpSlot);

export const loadBookingManagementEngagements = async () =>
  (await readBookingSnapshot(new URLSearchParams({ scope: 'management' }))).engagements.map(mapGcpEngagement);

export type BookingMutation = {
  action: 'create' | 'reschedule' | 'cancel';
  requestId: string;
  engagementId?: string;
  slotId?: string;
  name?: string;
  type?: EngagementTypeValue;
  location?: string | null;
  operationId?: string;
  expectedVersion?: string;
};

export type BookingMutationResult = {
  ok: true;
  engagementId: string;
  slotId: string | null;
  previousSlotId: string | null;
};

/** Do not automatically replay booking mutations after an uncertain response. */
export const saveEngagementBooking = async (input: BookingMutation): Promise<BookingMutationResult> => {
  if (!uploadConfig.isConfigured) {
    throw new Error('Booking is not configured. Contact your administrator.');
  }
  const token = await acquirePortalToken();
  let response: Response;
  try {
    response = await fetch(`${uploadConfig.functionBaseUrl}/api/engagementBookings`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new Error('The booking result could not be confirmed. Refresh the request to check the saved booking before trying again.');
  }
  if (response.status === 401) clearPortalToken();
  let body: (Partial<BookingMutationResult> & { error?: string }) | null = null;
  try {
    body = await response.json();
  } catch {
    // A proxy error or lost response must not become a successful booking.
  }
  if (!response.ok || !body?.ok || !body.engagementId) {
    throw new Error(body?.error?.trim() || `The booking result could not be confirmed (HTTP ${response.status}). Refresh the request before retrying.`);
  }
  return body as BookingMutationResult;
};
