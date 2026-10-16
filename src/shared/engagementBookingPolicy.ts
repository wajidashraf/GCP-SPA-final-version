// Presentation guards only. The booking Function independently authorizes
// the portal identity against the saved request before any mutation.
type BookingActor = {
  contactId: string | null | undefined;
  isAdmin: boolean;
};

type BookingRequest = {
  status: number | null | undefined;
  requestorContactId: string | null | undefined;
};

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isRequestOwnerOrAdmin = (
  requestorContactId: string | null | undefined,
  actor: BookingActor,
): boolean => {
  if (actor.isAdmin) return true;
  const owner = requestorContactId?.trim() ?? '';
  const contact = actor.contactId?.trim() ?? '';
  return GUID.test(owner) && GUID.test(contact) && owner.toLowerCase() === contact.toLowerCase();
};

export const canRescheduleEngagementBooking = (request: BookingRequest, actor: BookingActor): boolean =>
  request.status === 3 && isRequestOwnerOrAdmin(request.requestorContactId, actor);

export const canCreateEngagementBooking = (
  request: BookingRequest,
  actor: BookingActor,
  hasScheduled = false,
): boolean =>
  !hasScheduled && (request.status === 2 || request.status === 3) && isRequestOwnerOrAdmin(request.requestorContactId, actor);
