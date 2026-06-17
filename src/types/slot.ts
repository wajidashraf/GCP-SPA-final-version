// src/types/slot.ts
// TypeScript mirror of the gcp_slot Dataverse table (meeting / engagement slots).
// Logical name: gcp_slot  |  Entity set: gcp_slots
// Primary name: gcp_type  |  PK: gcp_slotid
//
// A slot has up to three attendee lookups to the `contact` table:
//   gcp_Attendee   → _gcp_attendee_value
//   gcp_Attendee_1 → _gcp_attendee_1_value
//   gcp_Attendee_2 → _gcp_attendee_2_value
// Lookups are written via `<NavProperty>@odata.bind` and read back via the
// `_<logicalname>_value` form (plus a FormattedValue annotation for the name).

// ── Raw OData entity (as it comes back from /_api/gcp_slots) ─────────────────
// FormattedValue annotations (present when the request prefers
// `odata.include-annotations="OData.Community.Display.V1.FormattedValue"`) are
// declared explicitly — TS index signatures can't use literal key types.
type GcpSlotEntity = {
  '@odata.etag'?: string;
  gcp_slotid?: string;
  /** Primary name column — used here as the meeting title / type. */
  gcp_type?: string | null;
  gcp_slotstatus?: number | null;
  'gcp_slotstatus@OData.Community.Display.V1.FormattedValue'?: string;
  /** Calendar date of the slot. */
  gcp_date?: string | null;
  /** Start datetime (ISO UTC). */
  gcp_start?: string | null;
  /** End datetime (ISO UTC). */
  gcp_end?: string | null;

  _gcp_attendee_value?: string | null;
  _gcp_attendee_1_value?: string | null;
  _gcp_attendee_2_value?: string | null;
  '_gcp_attendee_value@OData.Community.Display.V1.FormattedValue'?: string;
  '_gcp_attendee_1_value@OData.Community.Display.V1.FormattedValue'?: string;
  '_gcp_attendee_2_value@OData.Community.Display.V1.FormattedValue'?: string;

  /** Denormalised attendee emails, paired with the lookups above by index. */
  gcp_attendeeemail?: string | null;
  gcp_attendeeemail_1?: string | null;
  gcp_attendeeemail_2?: string | null;

  createdon?: string;
  modifiedon?: string;
};

// ── Clean domain type used by the React UI ──────────────────────────────────
type SlotAttendee = {
  contactId: string;
  name: string | null;
  email: string | null;
};

type Slot = {
  id: string;
  title: string | null;
  status: number | null;
  statusLabel: string | null;
  date: string | null;
  start: string | null;
  end: string | null;
  attendees: SlotAttendee[];
  createdOn: string | null;
};

// ── Input shape for create ──────────────────────────────────────────────────
type CreateGcpSlotInput = {
  gcp_type?: string | null;
  gcp_slotstatus?: number;
  gcp_date?: string | null;
  gcp_start?: string | null;
  gcp_end?: string | null;

  'gcp_Attendee@odata.bind'?: string;
  'gcp_Attendee_1@odata.bind'?: string;
  'gcp_Attendee_2@odata.bind'?: string;

  gcp_attendeeemail?: string | null;
  gcp_attendeeemail_1?: string | null;
  gcp_attendeeemail_2?: string | null;
};

const attendeeFrom = (
  id: string | null | undefined,
  name: string | undefined,
  email: string | null | undefined
): SlotAttendee | null =>
  id ? { contactId: id, name: name ?? null, email: email ?? null } : null;

const mapGcpSlot = (e: GcpSlotEntity): Slot => ({
  id: e.gcp_slotid ?? '',
  title: e.gcp_type ?? null,
  status: e.gcp_slotstatus ?? null,
  statusLabel:
    e['gcp_slotstatus@OData.Community.Display.V1.FormattedValue'] ?? null,
  date: e.gcp_date ?? null,
  start: e.gcp_start ?? null,
  end: e.gcp_end ?? null,
  attendees: [
    attendeeFrom(
      e._gcp_attendee_value,
      e['_gcp_attendee_value@OData.Community.Display.V1.FormattedValue'],
      e.gcp_attendeeemail
    ),
    attendeeFrom(
      e._gcp_attendee_1_value,
      e['_gcp_attendee_1_value@OData.Community.Display.V1.FormattedValue'],
      e.gcp_attendeeemail_1
    ),
    attendeeFrom(
      e._gcp_attendee_2_value,
      e['_gcp_attendee_2_value@OData.Community.Display.V1.FormattedValue'],
      e.gcp_attendeeemail_2
    ),
  ].filter((a): a is SlotAttendee => a !== null),
  createdOn: e.createdon ?? null,
});

const DEFAULT_SLOT_SELECT: readonly string[] = [
  'gcp_slotid',
  'gcp_type',
  'gcp_slotstatus',
  'gcp_date',
  'gcp_start',
  'gcp_end',
  '_gcp_attendee_value',
  '_gcp_attendee_1_value',
  '_gcp_attendee_2_value',
  'gcp_attendeeemail',
  'gcp_attendeeemail_1',
  'gcp_attendeeemail_2',
];

export { mapGcpSlot, DEFAULT_SLOT_SELECT };
export type { Slot, SlotAttendee, GcpSlotEntity, CreateGcpSlotInput };
