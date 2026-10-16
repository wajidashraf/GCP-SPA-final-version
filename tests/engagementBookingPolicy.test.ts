import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canCreateEngagementBooking,
  canRescheduleEngagementBooking,
  isRequestOwnerOrAdmin,
} from '../src/shared/engagementBookingPolicy.ts';

const ownerId = '9d0a67da-099f-41bd-8dd0-21d385e16cb2';
const request = { status: 3, requestorContactId: ownerId };
const owner = { contactId: ownerId.toUpperCase(), isAdmin: false };
const other = { contactId: '790d8199-ef3b-4b56-a277-e698be751fbe', isAdmin: false };

test('only original requester or administrator may reschedule a Booked request', () => {
  assert.equal(canRescheduleEngagementBooking(request, owner), true);
  assert.equal(canRescheduleEngagementBooking(request, { ...other, isAdmin: true }), true);
  // Reviewer/Verifier membership does not confer booking authority.
  assert.equal(canRescheduleEngagementBooking(request, other), false);
  assert.equal(canRescheduleEngagementBooking(request, { contactId: null, isAdmin: false }), false);
});

test('rescheduling never reopens another workflow stage even for an administrator', () => {
  for (const status of [null, 0, 1, 2, 4, 5, 6, 9, 10, 11, 12, 16]) {
    assert.equal(canRescheduleEngagementBooking({ ...request, status }, owner), false);
    assert.equal(canRescheduleEngagementBooking({ ...request, status }, { ...owner, isAdmin: true }), false);
  }
});

test('creation is restricted to Ready for Engagement or a Booked request needing a new booking', () => {
  assert.equal(canCreateEngagementBooking({ ...request, status: 2 }, owner), true);
  assert.equal(canCreateEngagementBooking(request, owner), true);
  assert.equal(canCreateEngagementBooking({ ...request, status: 2 }, other), false);
  assert.equal(canCreateEngagementBooking({ ...request, status: 5 }, owner), false);
});

test('an existing scheduled booking prevents offering another booking at either eligible request stage', () => {
  for (const status of [2, 3]) {
    const savedRequest = { ...request, status };
    assert.equal(canCreateEngagementBooking(savedRequest, owner, true), false);
    assert.equal(canCreateEngagementBooking(savedRequest, { ...other, isAdmin: true }, true), false);
    assert.equal(canCreateEngagementBooking(savedRequest, owner, false), true);
  }
});

test('ownership cannot match absent or malformed identities', () => {
  assert.equal(isRequestOwnerOrAdmin(null, { contactId: null, isAdmin: false }), false);
  assert.equal(isRequestOwnerOrAdmin('not-an-id', { contactId: 'not-an-id', isAdmin: false }), false);
  assert.equal(isRequestOwnerOrAdmin(ownerId, owner), true);
});
