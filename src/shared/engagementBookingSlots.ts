import type { Engagement } from '../types/engagement';
import type { Slot } from '../types/slot';
import { SLOT_STATUS_AVAILABLE } from '../data/slotChoices.ts';

export const availableEngagementSlots = (slots: Slot[], currentSlotId?: string | null): Slot[] =>
  slots.filter(slot => slot.status === SLOT_STATUS_AVAILABLE && slot.id.toLowerCase() !== currentSlotId?.toLowerCase());

/** A reused slot must not replace the meeting dates saved on this engagement. */
export const withCurrentEngagementSlot = (
  available: Slot[],
  current: Slot | null,
  engagement: Pick<Engagement, 'slotId' | 'date' | 'startTime' | 'endTime'> | null,
): Slot[] => {
  if (!current || !engagement?.slotId || current.id.toLowerCase() !== engagement.slotId.toLowerCase()) return available;
  return [{ ...current, date: engagement.date, start: engagement.startTime, end: engagement.endTime },
    ...available.filter((slot) => slot.id.toLowerCase() !== current.id.toLowerCase())];
};
