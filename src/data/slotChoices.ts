import type { DataverseChoice } from './types';

// gcp_slot.gcp_slotstatus — Dataverse choice.
// Only the "Available" value (2) is confirmed; a freshly created slot is set to
// Available on creation. Other statuses (e.g. Booked) exist in Dataverse but
// their integer values aren't mirrored here yet, so the Booked tab filters on
// "status is not Available" (see slotService) rather than a hard-coded value.
// Do NOT invent additional values here — add them only once confirmed against
// the Dataverse choice definition.
const slotStatusChoices = [
  { label: 'Booked', value: 1 },
  { label: 'Available', value: 2 },
] as const satisfies readonly DataverseChoice[];

/** The slot status applied to every newly created slot. */
const SLOT_STATUS_AVAILABLE = 2 as const;

/** The slot status applied once a slot is taken by a scheduled engagement. */
const SLOT_STATUS_BOOKED = 1 as const;

// UI-only helper (NOT a Dataverse choice column): meeting durations offered in
// the Create Slot modal. `value` is minutes — used to auto-compute the end time
// from the chosen start. Kept here (rather than inlined in the component) so the
// option list lives in one place, per the project's no-inline-options rule.
const slotDurationChoices = [
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '45 minutes', value: 45 },
  { label: '60 minutes', value: 60 },
] as const satisfies readonly DataverseChoice[];

type SlotStatusValue = (typeof slotStatusChoices)[number]['value'];
type SlotDurationValue = (typeof slotDurationChoices)[number]['value'];

export {
  slotStatusChoices,
  slotDurationChoices,
  SLOT_STATUS_AVAILABLE,
  SLOT_STATUS_BOOKED,
};
export type { SlotStatusValue, SlotDurationValue };
