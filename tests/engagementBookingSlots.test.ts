import assert from 'node:assert/strict';
import test from 'node:test';
import type { Slot } from '../src/types/slot.ts';
import { withCurrentEngagementSlot as merge } from '../src/shared/engagementBookingSlots.ts';
import * as slotChoices from '../src/shared/engagementBookingSlots.ts';
import { mapGcpEngagement } from '../src/types/engagement.ts';
const slot: Slot = { id: 'shared-slot', title: 'Meeting', status: 1, statusLabel: 'Booked',
  date: '2026-12-23', start: '2026-12-23T11:10:00Z', end: '2026-12-23T11:40:00Z', attendees: [], createdOn: null };
const booking = { slotId: slot.id, date: '2026-09-29', startTime: '2026-09-29T08:10:00Z', endTime: '2026-09-29T08:40:00Z' };

test('available choices exclude the current booking and every booked slot from the count', () => {
  assert.equal(typeof slotChoices.availableEngagementSlots, 'function');
  const available = { ...slot, id: 'new-slot', status: 2 };
  assert.deepEqual(slotChoices.availableEngagementSlots([slot, available, { ...slot, status: 2 }], slot.id), [available]);
});
test('fresh unformatted engagement records retain canonical status and type labels', () => {
  assert.equal(mapGcpEngagement({ gcp_engagementstatus: 2, gcp_engagementtype: 2 }).statusLabel, 'Completed');
  assert.equal(mapGcpEngagement({ gcp_engagementstatus: 0 }).statusLabel, 'Cancelled');
  assert.equal(mapGcpEngagement({ gcp_engagementstatus: 1, gcp_engagementtype: 2 }).typeLabel, 'Virtual');
});

test('the current booking choice shows its saved dates when the linked slot was reused', () => {
  assert.equal(typeof merge, 'function');
  const other = { ...slot, id: 'available-slot', status: 2 };
  const result = merge!([other], slot, booking);
  assert.equal(result.length, 2);
  assert.deepEqual([result[0].date, result[0].start, result[0].end], [booking.date, booking.startTime, booking.endTime]);
  assert.equal(result[0].id, slot.id);
  assert.equal(result[0].status, 1);
  assert.equal(result[1], other);
  assert.equal(slot.date, '2026-12-23', 'Display mapping must not mutate the slot record.');
});
test('a current slot already in availability is represented once using saved engagement dates', () => {
  assert.equal(typeof merge, 'function');
  const result = merge!([{ ...slot, status: 2 }], slot, booking);
  assert.equal(result.length, 1);
  assert.equal(result[0].start, booking.startTime);
  assert.equal(result[0].status, 1);
});
test('missing or unrelated current slot records cannot relabel an available slot as the saved booking', () => {
  assert.equal(typeof merge, 'function');
  const available = [{ ...slot, id: 'different-slot', status: 2 }];
  assert.equal(merge!(available, null, booking), available);
  assert.equal(merge!(available, slot, null), available);
  assert.equal(merge!(available, available[0], booking), available);
});
