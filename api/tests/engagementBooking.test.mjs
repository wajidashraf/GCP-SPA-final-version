import assert from 'node:assert/strict';
import { test } from 'node:test';

const booking = await import('../dist/src/dataverse/engagementBooking.js');
const batch = await import('../dist/src/dataverse/dataverseBatch.js');
const handlerModule = await import('../dist/src/booking/engagementBookingHandler.js');
const { readBookingCollection, readBookingEngagement } = await import('../dist/src/dataverse/engagementBookingIo.js');
const { DataverseError } = await import('../dist/src/dataverse/dataverseClient.js');
const run = booking.executeEngagementBooking;
const enabled = { skip: typeof run !== 'function' };
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const OWNER = id(1), OTHER = id(2), REQUEST = id(3), ENGAGEMENT = id(4);
const OLD = id(5), NEW = id(6), SITE = id(7), OPERATION = id(8);
const NOW = Date.parse('2026-10-15T00:00:00Z');
const identity = { contactId: OWNER, siteId: SITE, dataverseUrl: 'https://dev.crm.dynamics.com' };
const input = { action: 'reschedule', requestId: REQUEST, engagementId: ENGAGEMENT,
  expectedVersion: 'W/"engagement1"',
  slotId: NEW, name: 'Saved meeting', type: 2, location: null };
const requestRow = () => ({ gcp_requestid: REQUEST, gcp_requeststatus: 3,
  _gcp_requestorname_value: OWNER, '@odata.etag': 'W/"request1"' });
const engagementRow = () => ({ gcp_engagementsid: ENGAGEMENT, gcp_name: 'Old meeting',
  gcp_engagementnumber: 'R02', gcp_engagementstatus: 1, gcp_engagementtype: 1,
  gcp_location: 'Room', _gcp_request_value: REQUEST, _gcp_slot_value: OLD,
  _gcp_engagementcreatedby_value: OWNER, _gcp_attendeeemail_value: OTHER,
  gcp_engagementdate: '2026-10-16', gcp_starttime: '2026-10-16T09:00:00Z',
  gcp_endtime: '2026-10-16T10:00:00Z', '@odata.etag': 'W/"engagement1"' });
const slotRow = (slotId, status) => ({ gcp_slotid: slotId, gcp_slotstatus: status,
  gcp_date: '2026-10-17', gcp_start: '2026-10-17T09:00:00Z',
  gcp_end: '2026-10-17T10:00:00Z', _gcp_attendee_value: OTHER,
  '@odata.etag': `W/"slot${slotId}"` });

function fixture() {
  const records = new Map([
    [`gcp_requests(${REQUEST})`, requestRow()],
    [`gcp_engagementses(${ENGAGEMENT})`, engagementRow()],
    [`gcp_slots(${OLD})`, slotRow(OLD, 1)],
    [`gcp_slots(${NEW})`, slotRow(NEW, 2)],
  ]);
  const state = { records, transactions: [], admin: false, concurrency: true,
    beforeCommit: null, afterCommit: null, afterOperation: null, failAt: -1 };
  const rows = () => [...records.entries()].filter(([k]) => k.startsWith('gcp_engagementses(')).map(([, v]) => v);
  const copy = (value) => value ? structuredClone(value) : null;
  const io = {
    now: () => NOW,
    isAdmin: async () => state.admin,
    ensureConcurrency: async () => { if (!state.concurrency) throw new Error('Concurrency unavailable'); },
    getRequest: async (key) => copy(records.get(`gcp_requests(${key})`)),
    getEngagement: async (key) => copy(records.get(`gcp_engagementses(${key})`)),
    getSlot: async (key) => copy(records.get(`gcp_slots(${key})`)),
    listForRequest: async (key) => copy(rows().filter((r) => r._gcp_request_value === key)),
    listForSlot: async (key) => copy(rows().filter((r) => r._gcp_slot_value === key && r.gcp_engagementstatus === 1)),
    listSlots: async () => copy([...records.values()].filter(r => r.gcp_slotid)),
    listScheduledSlots: async () => copy(rows().filter(r => r.gcp_engagementstatus === 1).map(r => ({ _gcp_slot_value: r._gcp_slot_value }))),
    listAllEngagements: async () => copy(rows()),
    transact: async (operations) => {
      state.transactions.push(structuredClone(operations));
      await state.beforeCommit?.();
      const staged = new Map([...records].map(([k, v]) => [k, copy(v)]));
      for (const [index, op] of operations.entries()) {
        if (index === state.failAt) throw new batch.DataverseBatchError('Rejected operation', 400);
        const current = staged.get(op.path);
        if (op.headers['If-None-Match'] === '*' ? !!current : current?.['@odata.etag'] !== op.headers['If-Match']) {
          throw new batch.DataverseBatchError('Concurrent write', 412);
        }
        const next = { ...current, ...op.body, '@odata.etag': `W/"committed${index}"` };
        for (const [key, value] of Object.entries(op.body)) {
          if (key.endsWith('@odata.bind')) {
            next[`_${key.slice(0, -11).toLowerCase()}_value`] = value.slice(value.indexOf('(') + 1, -1);
          }
        }
        if (!current) next.gcp_engagementsid = op.path.slice(op.path.indexOf('(') + 1, -1);
        staged.set(op.path, next);
        if (state.afterOperation) state.afterOperation(op, staged, !current);
      }
      records.clear(); for (const [key, value] of staged) records.set(key, value);
      await state.afterCommit?.();
    },
  };
  return { state, io, request: records.get(`gcp_requests(${REQUEST})`),
    engagement: records.get(`gcp_engagementses(${ENGAGEMENT})`),
    oldSlot: records.get(`gcp_slots(${OLD})`), newSlot: records.get(`gcp_slots(${NEW})`) };
}
const rejectsStatus = async (promise, status) => assert.rejects(promise, (error) => error.status === status);

test('first booking survives the existing synchronous engagement-create workflow updating its parent request', async () => {
  const f = fixture();
  f.state.records.delete(`gcp_engagementses(${ENGAGEMENT})`);
  f.request.gcp_requeststatus = 2;
  f.state.afterOperation = (op, staged, created) => {
    if (created && op.path.startsWith('gcp_engagementses(')) {
      const parent = staged.get(`gcp_requests(${REQUEST})`);
      parent.gcp_requeststatus = 3;
      parent['@odata.etag'] = 'W/"real-time-workflow"';
    }
  };
  const result = await run({ action: 'create', requestId: REQUEST, operationId: OPERATION,
    slotId: NEW, name: 'First meeting', type: 2 }, identity, f.io);
  assert.equal(f.state.records.get(`gcp_engagementses(${result.engagementId})`)._gcp_slot_value, NEW);
  assert.equal(f.state.records.get(`gcp_requests(${REQUEST})`).gcp_requeststatus, 3);
});

test('fresh booking reads authorize the request before reading its engagements or slots', async () => {
  assert.equal(typeof booking.readEngagementBooking, 'function');
  const f = fixture();
  f.io.listForRequest = f.io.listSlots = f.io.listScheduledSlots = assert.fail;
  await rejectsStatus(booking.readEngagementBooking({ requestId: REQUEST }, { ...identity, contactId: OTHER }, f.io), 403);
});
test('fresh reads return the current saved slot and exclude reservations even if slot status is incorrectly available', async () => {
  assert.equal(typeof booking.readEngagementBooking, 'function');
  const f = fixture();
  f.oldSlot.gcp_slotstatus = 2;
  const snapshot = await booking.readEngagementBooking({ requestId: REQUEST }, identity, f.io);
  assert.equal(snapshot.engagements[0]._gcp_slot_value, OLD);
  assert.equal(snapshot.currentSlot.gcp_slotid, OLD);
  assert.deepEqual(snapshot.slots.map(s => s.gcp_slotid), [NEW]);
});
test('all-slot management reads require site administrator privileges and reflect active reservations', async () => {
  assert.equal(typeof booking.readEngagementBooking, 'function');
  const f = fixture();
  await rejectsStatus(booking.readEngagementBooking({ scope: 'slots' }, identity, f.io), 403);
  f.state.admin = true; f.oldSlot.gcp_slotstatus = 2;
  const snapshot = await booking.readEngagementBooking({ scope: 'slots' }, identity, f.io);
  assert.equal(snapshot.slots.find(s => s.gcp_slotid === OLD).gcp_slotstatus, 1);
});
test('fresh request reads validate IDs before accessing Dataverse', async () => {
  const f = fixture(); f.io.getRequest = assert.fail;
  await rejectsStatus(booking.readEngagementBooking({ requestId: '../contacts' }, identity, f.io), 400);
});
test('an editor opened before another reschedule cannot silently restore the old slot', async () => {
  const f = fixture();
  f.engagement['@odata.etag'] = 'W/"rescheduled-in-another-editor"';
  await rejectsStatus(run(input, identity, f.io), 409);
  assert.equal(f.state.transactions.length, 0);
});
test('a legacy editor without a booking version must refresh before saving', async () => {
  const f = fixture();
  await rejectsStatus(run({ ...input, expectedVersion: undefined }, identity, f.io), 409);
  assert.equal(f.state.transactions.length, 0);
});
test('admin engagement management reads current meetings and deny other roles', async () => {
  const f = fixture();
  await rejectsStatus(booking.readEngagementBooking({ scope: 'management' }, identity, f.io), 403);
  f.state.admin = true;
  const snapshot = await booking.readEngagementBooking({ scope: 'management' }, identity, f.io);
  assert.equal(snapshot.engagements[0]._gcp_slot_value, OLD);
  assert.equal(snapshot.request, null);
});
test('a concurrent parent change still rejects creation before the synchronous workflow can run', async () => {
  const f = fixture(); f.state.records.delete(`gcp_engagementses(${ENGAGEMENT})`); f.request.gcp_requeststatus = 2;
  let created = false;
  f.state.beforeCommit = () => { f.request['@odata.etag'] = 'W/"external-change"'; };
  f.state.afterOperation = op => { if (op.path.startsWith('gcp_engagementses(')) created = true; };
  await rejectsStatus(run({ action: 'create', requestId: REQUEST, operationId: OPERATION, slotId: NEW,
    name: 'First meeting', type: 2 }, identity, f.io), 409);
  assert.equal(created, false);
  assert.equal(f.newSlot.gcp_slotstatus, 2);
  assert.equal([...f.state.records.values()].some(r => r.gcp_engagementsid), false);
});
for (const failAt of [1, 2]) {
  test(`first-booking operation ${failAt + 1} failure rolls back the earlier parent guard`, async () => {
    const f = fixture(); f.state.records.delete(`gcp_engagementses(${ENGAGEMENT})`); f.request.gcp_requeststatus = 2;
    f.state.failAt = failAt;
    await assert.rejects(run({ action: 'create', requestId: REQUEST, operationId: OPERATION, slotId: NEW,
      name: 'First meeting', type: 2 }, identity, f.io));
    assert.equal(f.state.records.get(`gcp_requests(${REQUEST})`).gcp_requeststatus, 2);
    assert.equal(f.state.records.get(`gcp_slots(${NEW})`).gcp_slotstatus, 2);
  });
}
test('GET booking context is portal-scoped, authenticated, uncached and never mutates records', async () => {
  const f = fixture();
  let pinned = false;
  const guarded = Object.fromEntries(Object.entries(f.io).map(([key, value]) => [key, (...args) => {
    assert.equal(pinned, true); return value(...args);
  }]));
  const handler = handlerModule.createEngagementBookingHandler({
    authenticate: async () => ({ contactId: OWNER, portalBaseUrl: 'https://prod.example.com' }),
    assertMapping: portal => assert.equal(portal, 'https://prod.example.com'),
    runForPortal: async (_portal, callback) => { pinned = true; try { return await callback(); } finally { pinned = false; } },
    getIdentity: () => identity, createIo: () => guarded,
  });
  const response = await handler({ method: 'GET', headers: new Headers(), query: new URLSearchParams({ requestId: REQUEST }), json: assert.fail }, { error: assert.fail });
  assert.equal(response.status, 200);
  assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.equal(response.jsonBody.currentSlot.gcp_slotid, OLD);
  assert.equal(f.state.transactions.length, 0);
});

test('booking orchestration is available to authenticated callers', () => {
  assert.equal(typeof run, 'function', 'missing transactional booking implementation');
});

test('owner reschedules atomically while preserving engagement identity and request R', enabled, async () => {
  const { state, io } = fixture();
  const result = await run(input, identity, io);
  assert.deepEqual(result, { ok: true, engagementId: ENGAGEMENT, slotId: NEW, previousSlotId: OLD });
  assert.equal(state.transactions.length, 1);
  assert.deepEqual(state.transactions[0].map((o) => o.path), [
    `gcp_slots(${NEW})`, `gcp_engagementses(${ENGAGEMENT})`, `gcp_slots(${OLD})`, `gcp_requests(${REQUEST})`,
  ]);
  assert.equal(state.records.get(`gcp_slots(${NEW})`).gcp_slotstatus, 1);
  assert.equal(state.records.get(`gcp_slots(${OLD})`).gcp_slotstatus, 2);
  const row = state.records.get(`gcp_engagementses(${ENGAGEMENT})`);
  assert.equal(row._gcp_slot_value, NEW);
  assert.equal(row.gcp_starttime, '2026-10-17T09:00:00Z');
  assert.equal(row.gcp_engagementnumber, 'R02');
  assert.equal(row._gcp_engagementcreatedby_value, OWNER);
  assert.equal(row._gcp_request_value, REQUEST);
  assert.equal(state.records.get(`gcp_requests(${REQUEST})`).gcp_requeststatus, 3);
  assert.equal(state.transactions[0][3].headers['If-Match'], 'W/"request1"');
});

test('a site administrator may reschedule another original requester booking', enabled, async () => {
  const { state, io } = fixture(); state.admin = true;
  await run(input, { ...identity, contactId: OTHER }, io);
  assert.equal(state.records.get(`gcp_engagementses(${ENGAGEMENT})`)._gcp_engagementcreatedby_value, OWNER);
});

for (const role of ['Reviewer', 'Verifier']) {
  test(`non-owner ${role} cannot mutate bookings`, enabled, async () => {
    const { state, io } = fixture();
    await rejectsStatus(run(input, { ...identity, contactId: OTHER, roles: [role] }, io), 403);
    assert.equal(state.transactions.length, 0);
  });
}
test('owner matching is case-insensitive and is not lost through Reviewer membership', enabled, async () => {
  const { io, request } = fixture(); request._gcp_requestorname_value = 'abcdefab-0000-0000-0000-000000000001';
  await run(input, { ...identity, contactId: 'ABCDEFAB-0000-0000-0000-000000000001', roles: ['Reviewer'] }, io);
});
for (const field of ['contactId', 'siteId', 'dataverseUrl']) {
  test(`missing ${field} fails closed before Dataverse access`, enabled, async () => {
    const { state, io } = fixture();
    await rejectsStatus(run(input, { ...identity, [field]: '' }, io), field === 'contactId' ? 403 : 503);
    assert.equal(state.transactions.length, 0);
  });
}
for (const [label, mutate] of [
  ['request has progressed', (f) => { f.request.gcp_requeststatus = 5; }],
  ['engagement belongs to another request', (f) => { f.engagement._gcp_request_value = id(99); }],
  ['engagement is completed', (f) => { f.engagement.gcp_engagementstatus = 2; }],
  ['new slot is booked', (f) => { f.newSlot.gcp_slotstatus = 1; }],
  ['old slot is not booked', (f) => { f.oldSlot.gcp_slotstatus = 2; }],
  ['request ETag is unavailable', (f) => { delete f.request['@odata.etag']; }],
]) {
  test(`${label} prevents all mutations`, enabled, async () => {
    const f = fixture(); mutate(f);
    await assert.rejects(run(input, identity, f.io));
    assert.equal(f.state.transactions.length, 0);
  });
}
test('another scheduled engagement for the request is an explicit anomaly', enabled, async () => {
  const { state, io } = fixture();
  state.records.set(`gcp_engagementses(${id(10)})`, { ...engagementRow(), gcp_engagementsid: id(10), _gcp_slot_value: NEW });
  await rejectsStatus(run(input, identity, io), 409);
  assert.equal(state.transactions.length, 0);
});
function sharedSlotFixture() {
  const f = fixture();
  const other = { ...engagementRow(), gcp_engagementsid: id(10), _gcp_request_value: id(99),
    gcp_starttime: '2026-12-23T11:10:00Z', gcp_endtime: '2026-12-23T11:40:00Z' };
  f.state.records.set(`gcp_engagementses(${id(10)})`, other);
  // Model REQ-1262: an older engagement still points to a slot now representing
  // another request's December booking.
  f.oldSlot.gcp_start = other.gcp_starttime;
  f.oldSlot.gcp_end = other.gcp_endtime;
  return { ...f, other };
}
for (const admin of [false, true]) {
  test(`${admin ? 'administrator' : 'owner'} can move off a shared old slot without releasing another request reservation`, enabled, async () => {
    const { state, io, other } = sharedSlotFixture(); state.admin = admin;
    const before = structuredClone(other);
    const result = await run(input, { ...identity, contactId: admin ? OTHER : OWNER }, io);
    assert.equal(result.slotId, NEW);
    assert.equal(state.records.get(`gcp_engagementses(${ENGAGEMENT})`)._gcp_slot_value, NEW);
    assert.equal(state.records.get(`gcp_slots(${NEW})`).gcp_slotstatus, 1);
    assert.equal(state.records.get(`gcp_slots(${OLD})`).gcp_slotstatus, 1);
    assert.deepEqual(state.records.get(`gcp_engagementses(${id(10)})`), before);
    assert.deepEqual(state.transactions[0].map(op => op.path), [
      `gcp_slots(${NEW})`, `gcp_engagementses(${ENGAGEMENT})`, `gcp_slots(${OLD})`, `gcp_requests(${REQUEST})`,
    ]);
    assert.deepEqual(state.transactions[0][2].body, { gcp_slotstatus: 1 });
    assert.equal(state.transactions[0][2].headers['If-Match'], `W/"slot${OLD}"`);
  });
}
test('shared-slot edits preserve all reservations without moving the engagement', enabled, async () => {
  const { state, io, other } = sharedSlotFixture();
  const before = structuredClone(other);
  await run({ ...input, slotId: OLD }, identity, io);
  assert.equal(state.records.get(`gcp_engagementses(${ENGAGEMENT})`)._gcp_slot_value, OLD);
  assert.equal(state.records.get(`gcp_engagementses(${ENGAGEMENT})`).gcp_starttime, '2026-10-16T09:00:00Z');
  assert.equal(state.records.get(`gcp_engagementses(${ENGAGEMENT})`).gcp_endtime, '2026-10-16T10:00:00Z');
  assert.equal(state.records.get(`gcp_slots(${OLD})`).gcp_slotstatus, 1);
  assert.deepEqual(state.records.get(`gcp_engagementses(${id(10)})`), before);
});
test('shared-slot reschedule still rejects an occupied destination', enabled, async () => {
  const { state, io } = sharedSlotFixture();
  state.records.set(`gcp_engagementses(${id(11)})`, { ...engagementRow(), gcp_engagementsid: id(11), _gcp_request_value: id(98), _gcp_slot_value: NEW });
  await assert.rejects(run(input, identity, io), /selected slot is no longer available/);
  assert.equal(state.transactions.length, 0);
});
test('the current engagement must still be present in the old slot collection', enabled, async () => {
  const { state, io } = sharedSlotFixture();
  io.listForSlot = async key => [...state.records.values()].filter(row => row._gcp_slot_value === key && row.gcp_engagementsid !== ENGAGEMENT);
  await rejectsStatus(run(input, identity, io), 409);
  assert.equal(state.transactions.length, 0);
});
test('a concurrent shared-slot change rolls back the move and preserves both bookings', enabled, async () => {
  const { state, io, other } = sharedSlotFixture();
  const before = structuredClone(other);
  state.beforeCommit = () => { state.records.get(`gcp_slots(${OLD})`)['@odata.etag'] = 'W/"other-reservation-change"'; };
  await rejectsStatus(run(input, identity, io), 409);
  assert.equal(state.transactions.length, 1);
  assert.equal(state.records.get(`gcp_engagementses(${ENGAGEMENT})`)._gcp_slot_value, OLD);
  assert.equal(state.records.get(`gcp_slots(${NEW})`).gcp_slotstatus, 2);
  assert.equal(state.records.get(`gcp_slots(${OLD})`).gcp_slotstatus, 1);
  assert.deepEqual(state.records.get(`gcp_engagementses(${id(10)})`), before);
});
test('a lost shared-slot reschedule response reconciles retained and new reservations without replay', enabled, async () => {
  const { state, io } = sharedSlotFixture();
  state.afterCommit = () => { throw new TypeError('response lost'); };
  assert.equal((await run(input, identity, io)).slotId, NEW);
  assert.equal(state.transactions.length, 1);
});
for (const change of ['old-slot-released', 'other-reservation-removed']) {
  test(`lost-response reconciliation rejects ${change} after a shared-slot move`, enabled, async () => {
    const { state, io } = sharedSlotFixture();
    state.afterCommit = () => {
      if (change === 'old-slot-released') state.records.get(`gcp_slots(${OLD})`).gcp_slotstatus = 2;
      else state.records.delete(`gcp_engagementses(${id(10)})`);
      throw new TypeError('response lost');
    };
    await rejectsStatus(run(input, identity, io), 503);
    assert.equal(state.transactions.length, 1);
  });
}
for (const admin of [false, true]) {
  test(`${admin ? 'administrator' : 'owner'} cancellation retains a shared slot even when the time policy permits release`, enabled, async () => {
    const { state, io, other } = sharedSlotFixture(); state.admin = admin;
    const before = structuredClone(other);
    await run({ action: 'cancel', requestId: REQUEST, engagementId: ENGAGEMENT, expectedVersion: 'W/"engagement1"' }, { ...identity, contactId: admin ? OTHER : OWNER }, io);
    assert.equal(state.records.get(`gcp_engagementses(${ENGAGEMENT})`).gcp_engagementstatus, 0);
    assert.equal(state.records.get(`gcp_slots(${OLD})`).gcp_slotstatus, 1);
    assert.deepEqual(state.records.get(`gcp_engagementses(${id(10)})`), before);
  });
}
test('an available slot with a scheduled conflicting row cannot be reserved', enabled, async () => {
  const { state, io } = fixture();
  state.records.set(`gcp_engagementses(${id(10)})`, { ...engagementRow(), gcp_engagementsid: id(10), _gcp_request_value: id(99), _gcp_slot_value: NEW });
  await rejectsStatus(run(input, identity, io), 409);
});
test('same-slot edits change details without releasing or reserving the slot', enabled, async () => {
  const { state, io } = fixture();
  await run({ ...input, slotId: OLD }, identity, io);
  assert.deepEqual(state.transactions[0].map((o) => o.path), [
    `gcp_engagementses(${ENGAGEMENT})`, `gcp_slots(${OLD})`, `gcp_requests(${REQUEST})`,
  ]);
  assert.deepEqual(state.transactions[0][1].body, { gcp_slotstatus: 1 });
  assert.equal(state.transactions[0][1].headers['If-Match'], `W/"slot${OLD}"`);
  assert.equal(state.records.get(`gcp_slots(${OLD})`).gcp_slotstatus, 1);
  const changes = state.transactions[0][0].body;
  assert.equal(Object.hasOwn(changes, 'gcp_engagementnumber'), false);
  assert.equal(Object.hasOwn(changes, 'gcp_EngagementCreatedBy@odata.bind'), false);
  assert.equal(Object.hasOwn(changes, 'gcp_engagementstatus'), false);
  assert.equal(Object.hasOwn(changes, 'gcp_Slot@odata.bind'), false);
});

test('same-slot edits reject a concurrent slot release and preserve the saved engagement details', enabled, async () => {
  const { state, io } = fixture();
  state.beforeCommit = () => {
    const slot = state.records.get(`gcp_slots(${OLD})`);
    slot.gcp_slotstatus = 2;
    slot['@odata.etag'] = 'W/"admin-released"';
  };

  await rejectsStatus(run({ ...input, slotId: OLD }, identity, io), 409);

  const saved = state.records.get(`gcp_engagementses(${ENGAGEMENT})`);
  assert.equal(saved.gcp_name, 'Old meeting');
  assert.equal(saved.gcp_engagementtype, 1);
  assert.equal(saved.gcp_location, 'Room');
  assert.equal(saved._gcp_slot_value, OLD);
  assert.equal(saved.gcp_engagementstatus, 1);
  assert.equal(state.records.get(`gcp_slots(${OLD})`).gcp_slotstatus, 2);
  assert.equal(state.records.get(`gcp_requests(${REQUEST})`).gcp_requeststatus, 3);
  assert.equal(state.transactions.length, 1);
});
for (const failedOperation of [0, 1, 2, 3]) {
  test(`changeset operation ${failedOperation + 1} failure preserves the old booking and reservation`, enabled, async () => {
    const { state, io } = fixture(); state.failAt = failedOperation;
    await assert.rejects(run(input, identity, io));
    assert.equal(state.records.get(`gcp_engagementses(${ENGAGEMENT})`)._gcp_slot_value, OLD);
    assert.equal(state.records.get(`gcp_slots(${OLD})`).gcp_slotstatus, 1);
    assert.equal(state.records.get(`gcp_slots(${NEW})`).gcp_slotstatus, 2);
    assert.equal(state.transactions.length, 1);
  });
}
for (const changedKey of [`gcp_slots(${NEW})`, `gcp_requests(${REQUEST})`]) {
  test(`concurrent change to ${changedKey} rolls back the whole change set`, enabled, async () => {
    const { state, io } = fixture();
    state.beforeCommit = () => { state.records.get(changedKey)['@odata.etag'] = 'W/"other"'; };
    await rejectsStatus(run(input, identity, io), 409);
    assert.equal(state.records.get(`gcp_engagementses(${ENGAGEMENT})`)._gcp_slot_value, OLD);
    assert.equal(state.records.get(`gcp_slots(${OLD})`).gcp_slotstatus, 1);
    assert.equal(state.transactions.length, 1);
  });
}
test('lost committed response reconciles saved engagement and both slot statuses without replay', enabled, async () => {
  const { state, io } = fixture(); state.afterCommit = () => { throw new TypeError('socket closed'); };
  assert.equal((await run(input, identity, io)).slotId, NEW);
  assert.equal(state.transactions.length, 1);
});
test('lost uncommitted response reports uncertainty and never blindly retries', enabled, async () => {
  const { state, io } = fixture(); state.beforeCommit = () => { throw new TypeError('socket closed'); };
  await rejectsStatus(run(input, identity, io), 503);
  assert.equal(state.transactions.length, 1);
  assert.equal(state.records.get(`gcp_engagementses(${ENGAGEMENT})`)._gcp_slot_value, OLD);
});
test('uncertain response cannot succeed if old reservation is still booked', enabled, async () => {
  const { state, io } = fixture(); state.afterCommit = () => {
    state.records.get(`gcp_slots(${OLD})`).gcp_slotstatus = 1;
    throw new TypeError('socket closed');
  };
  await rejectsStatus(run(input, identity, io), 503);
});
test('uncertain response cannot report success if original engagement creator changed', enabled, async () => {
  const { state, io } = fixture(); state.afterCommit = () => {
    state.records.get(`gcp_engagementses(${ENGAGEMENT})`)._gcp_engagementcreatedby_value = id(99);
    throw new TypeError('socket closed');
  };
  await rejectsStatus(run(input, identity, io), 503);
});
for (const [field, value] of [['gcp_starttime', '2026-10-19T09:00:00Z'], ['_gcp_attendeeemail_value', id(99)]]) {
  test(`uncertain response must verify saved ${field}`, enabled, async () => {
    const { state, io } = fixture(); state.afterCommit = () => {
      state.records.get(`gcp_engagementses(${ENGAGEMENT})`)[field] = value;
      throw new TypeError('socket closed');
    };
    await rejectsStatus(run(input, identity, io), 503);
  });
}
test('an outer gateway error after commit is reconciled instead of being declared rolled back', enabled, async () => {
  const { state, io } = fixture(); state.afterCommit = () => { throw new DataverseError('Gateway unavailable', 503); };
  assert.equal((await run(input, identity, io)).slotId, NEW);
  assert.equal(state.transactions.length, 1);
});

function creationFixture() {
  const f = fixture(); f.state.records.delete(`gcp_engagementses(${ENGAGEMENT})`);
  f.request.gcp_requeststatus = 2;
  return f;
}
const createInput = { ...input, action: 'create', engagementId: undefined, operationId: OPERATION };
test('create derives identity, number and slot data server-side and advances Ready for Engagement to R', enabled, async () => {
  const { state, io } = creationFixture();
  const result = await run({ ...createInput, gcp_engagementnumber: 'HACK', createdByContactId: OTHER, gcp_starttime: 'invalid' }, identity, io);
  const row = state.records.get(`gcp_engagementses(${result.engagementId})`);
  assert.equal(row.gcp_engagementnumber, 'R01');
  assert.equal(row._gcp_engagementcreatedby_value, OWNER);
  assert.equal(row._gcp_attendeeemail_value, OTHER);
  assert.equal(row.gcp_starttime, '2026-10-17T09:00:00Z');
  assert.equal(state.records.get(`gcp_requests(${REQUEST})`).gcp_requeststatus, 3);
  assert.equal(state.transactions[0][2].headers['If-None-Match'], '*');
});
test('create uses completed history for numbering and can rebook a cancelled request at R', enabled, async () => {
  const { state, io, request } = creationFixture(); request.gcp_requeststatus = 3;
  state.records.set(`gcp_engagementses(${ENGAGEMENT})`, { ...engagementRow(), gcp_engagementstatus: 2 });
  const result = await run(createInput, identity, io);
  assert.equal(state.records.get(`gcp_engagementses(${result.engagementId})`).gcp_engagementnumber, 'R02');
});
test('create requires a stable operationId', enabled, async () => {
  const { state, io } = creationFixture();
  await rejectsStatus(run({ ...createInput, operationId: undefined }, identity, io), 400);
  assert.equal(state.transactions.length, 0);
});
test('create response loss and caller retry reuse one deterministic engagement GUID', enabled, async () => {
  const { state, io } = creationFixture(); state.afterCommit = () => { throw new TypeError('response lost'); };
  const first = await run(createInput, identity, io);
  const retry = await run(createInput, identity, io);
  assert.equal(first.engagementId, retry.engagementId);
  assert.equal(state.transactions.length, 1);
  assert.equal([...state.records.keys()].filter((key) => key.startsWith('gcp_engagementses(')).length, 1);
});
test('reusing a create operationId with different details cannot overwrite its booking', enabled, async () => {
  const { state, io } = creationFixture(); await run(createInput, identity, io);
  await rejectsStatus(run({ ...createInput, name: 'Different' }, identity, io), 409);
  assert.equal(state.transactions.length, 1);
});
test('simultaneous creates for one request cannot both commit even with different operationIds and slots', enabled, async () => {
  const { state, io } = creationFixture(); state.records.get(`gcp_slots(${OLD})`).gcp_slotstatus = 2;
  let arrived = 0, resume;
  const gate = new Promise((resolve) => { resume = resolve; });
  state.beforeCommit = async () => { if (++arrived === 2) resume(); await gate; };
  const results = await Promise.allSettled([
    run(createInput, identity, io),
    run({ ...createInput, operationId: id(99), slotId: OLD }, identity, io),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal([...state.records.values()].filter((r) => r.gcp_engagementstatus === 1).length, 1);
  assert.equal(results.find((r) => r.status === 'rejected').reason.status, 409);
});
test('concurrent retries of one create operation both resolve to the same single row', enabled, async () => {
  const { state, io } = creationFixture();
  let arrived = 0, resume;
  const gate = new Promise((resolve) => { resume = resolve; });
  state.beforeCommit = async () => { if (++arrived === 2) resume(); await gate; };
  const results = await Promise.all([run(createInput, identity, io), run(createInput, identity, io)]);
  assert.equal(results[0].engagementId, results[1].engagementId);
  assert.equal([...state.records.values()].filter((r) => r.gcp_engagementstatus === 1).length, 1);
});
for (const [label, inputChange] of [
  ['invalid request GUID', { requestId: '../contacts' }],
  ['invalid engagement GUID', { engagementId: 'anything' }],
  ['invalid slot GUID', { slotId: 'anything' }],
  ['empty name', { name: ' ' }],
  ['unknown type', { type: 99 }],
  ['string type', { type: '2' }],
  ['in-person without location', { type: 1, location: null }],
]) {
  test(`${label} is rejected before mutation`, enabled, async () => {
    const { state, io } = fixture();
    await rejectsStatus(run({ ...input, ...inputChange }, identity, io), 400);
    assert.equal(state.transactions.length, 0);
  });
}
test('disabled optimistic concurrency prevents all booking mutations', enabled, async () => {
  const { state, io } = fixture(); state.concurrency = false;
  await assert.rejects(run(input, identity, io));
  assert.equal(state.transactions.length, 0);
});
for (const [minutes, admin, released] of [[121, false, true], [120, false, false], [119, false, false], [-1, true, true]]) {
  test(`cancellation ${minutes} minutes before start by ${admin ? 'admin' : 'owner'} ${released ? 'releases' : 'retains'} reservation`, enabled, async () => {
    const { state, io, engagement, oldSlot } = fixture(); state.admin = admin;
    engagement.gcp_starttime = new Date(NOW + minutes * 60000).toISOString();
    oldSlot.gcp_start = engagement.gcp_starttime;
    const result = await run({ action: 'cancel', requestId: REQUEST, engagementId: ENGAGEMENT, expectedVersion: 'W/"engagement1"' }, identity, io);
    assert.equal(result.slotId, null);
    assert.equal(state.records.get(`gcp_engagementses(${ENGAGEMENT})`).gcp_engagementstatus, 0);
    assert.equal(state.records.get(`gcp_slots(${OLD})`).gcp_slotstatus, released ? 2 : 1);
  });
}

function detachedBookingFixture() {
  const f = fixture();
  f.engagement._gcp_slot_value = null;
  f.state.records.delete(`gcp_slots(${OLD})`);
  const normalSlotIo = { getSlot: f.io.getSlot, listForSlot: f.io.listForSlot };
  let slotCalls = 0;
  f.io.getSlot = f.io.listForSlot = async () => {
    slotCalls += 1;
    throw new Error('Detached cancellation must not access slot records');
  };
  return { ...f, normalSlotIo, slotCalls: () => slotCalls };
}
const cancelInput = { action: 'cancel', requestId: REQUEST, engagementId: ENGAGEMENT, expectedVersion: 'W/"engagement1"' };
for (const admin of [false, true]) {
  test(`detached booking cancellation by ${admin ? 'administrator' : 'original owner'} updates only engagement and request and permits rebooking`, enabled, async () => {
    const { state, io, normalSlotIo, slotCalls } = detachedBookingFixture(); state.admin = admin;
    const actor = { ...identity, contactId: admin ? OTHER : OWNER };
    const result = await run(cancelInput, actor, io);
    assert.deepEqual(result, { ok: true, engagementId: ENGAGEMENT, slotId: null, previousSlotId: null });
    assert.equal(slotCalls(), 0);
    assert.deepEqual(state.transactions[0].map((op) => op.path), [`gcp_engagementses(${ENGAGEMENT})`, `gcp_requests(${REQUEST})`]);
    assert.equal(state.transactions[0][0].headers['If-Match'], 'W/"engagement1"');
    assert.equal(state.transactions[0][1].headers['If-Match'], 'W/"request1"');
    assert.deepEqual(state.transactions[0][1].body, { gcp_requeststatus: 3 });
    assert.equal(state.records.get(`gcp_engagementses(${ENGAGEMENT})`).gcp_engagementstatus, 0);
    assert.equal(state.records.get(`gcp_engagementses(${ENGAGEMENT})`)._gcp_slot_value, null);
    assert.equal(state.records.has(`gcp_slots(${OLD})`), false);
    Object.assign(io, normalSlotIo);
    const newBooking = await run({ ...createInput, operationId: id(101) }, actor, io);
    assert.notEqual(newBooking.engagementId, ENGAGEMENT);
    assert.equal([...state.records.values()].filter((row) => row.gcp_engagementstatus === 1).length, 1);
  });
}
for (const changedKey of [`gcp_engagementses(${ENGAGEMENT})`, `gcp_requests(${REQUEST})`]) {
  test(`detached cancellation concurrent change to ${changedKey} preserves the scheduled engagement`, enabled, async () => {
    const { state, io, slotCalls } = detachedBookingFixture();
    state.beforeCommit = () => { state.records.get(changedKey)['@odata.etag'] = 'W/"changed"'; };
    await rejectsStatus(run(cancelInput, identity, io), 409);
    assert.equal(state.records.get(`gcp_engagementses(${ENGAGEMENT})`).gcp_engagementstatus, 1);
    assert.equal(state.records.get(`gcp_requests(${REQUEST})`).gcp_requeststatus, 3);
    assert.equal(slotCalls(), 0);
    assert.deepEqual(state.transactions[0].map((op) => op.path), [`gcp_engagementses(${ENGAGEMENT})`, `gcp_requests(${REQUEST})`]);
  });
}
test('detached cancellation still denies a non-owner without site administrator privileges', enabled, async () => {
  const { state, io, slotCalls } = detachedBookingFixture();
  await rejectsStatus(run(cancelInput, { ...identity, contactId: OTHER }, io), 403);
  assert.equal(state.transactions.length, 0);
  assert.equal(slotCalls(), 0);
});
test('detached cancellation still requires a Scheduled engagement bound to the request at R', enabled, async () => {
  for (const mutate of [
    (f) => { f.request.gcp_requeststatus = 5; },
    (f) => { f.engagement.gcp_engagementstatus = 2; },
    (f) => { f.engagement._gcp_request_value = id(99); },
  ]) {
    const f = detachedBookingFixture(); mutate(f);
    await rejectsStatus(run(cancelInput, identity, f.io), 409);
    assert.equal(f.state.transactions.length, 0);
    assert.equal(f.slotCalls(), 0);
  }
});
test('detached engagement rescheduling remains unavailable until its reservation can be verified', enabled, async () => {
  const { state, io, slotCalls } = detachedBookingFixture();
  await rejectsStatus(run(input, identity, io), 400);
  assert.equal(state.transactions.length, 0);
  assert.equal(slotCalls(), 0);
});
test('detached cancellation reconciles a lost committed response without slot access or replay', enabled, async () => {
  const { state, io, slotCalls } = detachedBookingFixture();
  state.afterCommit = () => { throw new TypeError('response lost'); };
  assert.deepEqual(await run(cancelInput, identity, io), { ok: true, engagementId: ENGAGEMENT, slotId: null, previousSlotId: null });
  assert.equal(state.transactions.length, 1);
  assert.equal(slotCalls(), 0);
});

test('batch builder and response parser are available', () => {
  assert.equal(typeof batch.buildChangeSet, 'function');
  assert.equal(typeof batch.validateChangeSetResponse, 'function');
});
const batchEnabled = { skip: typeof batch.buildChangeSet !== 'function' };
const multipart = (statuses) => {
  const parts = statuses.map((status, index) => `--change\r\nContent-Type: application/http\r\nContent-Transfer-Encoding: binary\r\nContent-ID: ${index + 1}\r\n\r\nHTTP/1.1 ${status} Result\r\nContent-Type: application/json\r\n\r\n${status >= 400 ? '{"error":{"message":"Rejected"}}' : ''}\r\n`).join('');
  return `--outer\r\nContent-Type: multipart/mixed; boundary=change\r\n\r\n${parts}--change--\r\n--outer--\r\n`;
};
test('batch builder uses one changeset with CRLF and per-record conditional headers', batchEnabled, () => {
  const built = batch.buildChangeSet([{ method: 'PATCH', path: `gcp_slots(${NEW})`, body: { gcp_slotstatus: 1 }, headers: { 'If-Match': 'W/"slot"' } }], 'https://dev.crm.dynamics.com/api/data/v9.2/');
  assert.match(built.body, /PATCH https:\/\/dev\.crm\.dynamics\.com\/api\/data\/v9\.2\/gcp_slots\(/);
  assert.match(built.body, /If-Match: W\/"slot"\r\n/);
  assert.equal(built.body.replace(/\r\n/g, '').includes('\n'), false);
  assert.equal((built.body.match(/Content-Type: multipart\/mixed; boundary=changeset_/g) ?? []).length, 1);
});
test('outer success with a nested failed operation is rejected', batchEnabled, () => {
  assert.throws(() => batch.validateChangeSetResponse('multipart/mixed; boundary=outer', multipart([204, 412]), 2), (error) => error.status === 412);
});
test('valid complete multipart success accepts every expected nested operation', batchEnabled, () => {
  batch.validateChangeSetResponse('multipart/mixed; boundary=outer', multipart([204, 204, 204, 204]), 4);
});
for (const [label, body] of [['missing operation', multipart([204])], ['unclosed multipart', multipart([204, 204]).replace('--outer--', '')], ['unparseable', 'not a batch response']]) {
  test(`malformed batch ${label} cannot report success`, batchEnabled, () => {
    assert.throws(() => batch.validateChangeSetResponse('multipart/mixed; boundary=outer', body, 2));
  });
}
test('a rejected changeset represented as a single outer HTTP part is a confirmed failure', batchEnabled, () => {
  const body = '--outer\r\nContent-Type: application/http\r\n\r\nHTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\n\r\n{"error":{"message":"Rejected"}}\r\n--outer--\r\n';
  assert.throws(() => batch.validateChangeSetResponse('multipart/mixed; boundary=outer', body, 4), (e) => e.status === 400 && !e.uncertain);
});
test('HTTP-looking body text cannot manufacture a successful nested operation', batchEnabled, () => {
  const body = multipart([204]).replace('--change--', 'HTTP/1.1 204 No Content\r\n--change--');
  assert.throws(() => batch.validateChangeSetResponse('multipart/mixed; boundary=outer', body, 2));
});
test('booked records on later collection pages are included in duplicate detection', async () => {
  const paths = [];
  const rows = await readBookingCollection('gcp_engagementses?$filter=x', async (path) => {
    paths.push(path);
    return paths.length === 1 ? { value: [], '@odata.nextLink': 'https://dev.crm.dynamics.com/api/data/v9.2/gcp_engagementses?$skiptoken=next' }
      : { value: [engagementRow()] };
  }, 'https://dev.crm.dynamics.com/api/data/v9.2/');
  assert.equal(rows[0].gcp_engagementsid, ENGAGEMENT);
  assert.equal(paths[1], 'gcp_engagementses?$skiptoken=next');
});
test('reconciliation contact identity comes from the verified engagement navigation properties', async () => {
  let queriedPath;
  assert.equal(typeof readBookingEngagement, 'function', 'missing verified navigation projection');
  const row = await readBookingEngagement(ENGAGEMENT, async (path) => {
    queriedPath = path;
    return { ...engagementRow(), _gcp_engagementcreatedby_value: undefined,
      _gcp_attendeeemail_value: undefined, gcp_EngagementCreatedBy: { contactid: OWNER },
      gcp_AttendeeEmail: { contactid: OTHER } };
  });
  const query = new URLSearchParams(queriedPath.slice(queriedPath.indexOf('?') + 1));
  assert.equal(query.get('$select').includes('_gcp_engagementcreatedby_value'), false);
  assert.equal(query.get('$select').includes('_gcp_attendeeemail_value'), false);
  assert.equal(query.get('$expand'), 'gcp_EngagementCreatedBy($select=contactid),gcp_AttendeeEmail($select=contactid)');
  assert.equal(row._gcp_engagementcreatedby_value, OWNER);
  assert.equal(row._gcp_attendeeemail_value, OTHER);
  assert.equal(row['@odata.etag'], 'W/"engagement1"');
});
test('collection pagination cannot follow a different Dataverse environment', async () => {
  await rejectsStatus(readBookingCollection('gcp_engagementses', async () => ({ value: [],
    '@odata.nextLink': 'https://prod.crm.dynamics.com/api/data/v9.2/gcp_engagementses',
  }), 'https://dev.crm.dynamics.com/api/data/v9.2/'), 502);
});
test('multi-portal mutations reject fallback org or site mappings', () => {
  const env = { PORTAL_BASE_URLS: 'https://dev.example.com,https://prod.example.com',
    DATAVERSE_URLS: 'https://dev.crm.dynamics.com,', DATAVERSE_URL: 'https://dev.crm.dynamics.com',
    POWERPAGE_SITE_IDS: `${SITE},`, POWERPAGE_SITE_ID: SITE };
  assert.throws(() => handlerModule.assertBookingPortalMapping('https://prod.example.com', env), (e) => e.status === 503);
});
test('explicit multi-portal mapping accepts the selected environment and site', () => {
  handlerModule.assertBookingPortalMapping('https://prod.example.com', {
    PORTAL_BASE_URLS: 'https://dev.example.com,https://prod.example.com',
    DATAVERSE_URLS: 'https://dev.crm.dynamics.com,https://prod.crm.dynamics.com', POWERPAGE_SITE_IDS: `${SITE},${id(9)}`,
  });
});
test('invalid configured Dataverse target is rejected before privileged IO', () => {
  assert.throws(() => handlerModule.assertBookingPortalMapping('https://dev.example.com', {
    PORTAL_BASE_URLS: 'https://dev.example.com', DATAVERSE_URL: 'not-an-org-url', POWERPAGE_SITE_ID: SITE,
  }), (e) => e.status === 503);
});
test('handler pins token issuer context before role checks, reads and mutations', async () => {
  const { state, io } = fixture();
  let pinned = false;
  const guarded = Object.fromEntries(Object.entries(io).map(([key, value]) => [key, (...args) => {
    assert.equal(pinned, true, `${key} ran without portal scope`); return value(...args);
  }]));
  const handler = handlerModule.createEngagementBookingHandler({
    authenticate: async (auth) => { assert.equal(auth, 'Bearer trusted-token'); return { contactId: OWNER, portalBaseUrl: 'https://prod.example.com' }; },
    assertMapping: (portal) => assert.equal(portal, 'https://prod.example.com'),
    runForPortal: async (portal, callback) => { assert.equal(portal, 'https://prod.example.com'); pinned = true; try { return await callback(); } finally { pinned = false; } },
    getIdentity: () => { assert.equal(pinned, true); return identity; }, createIo: () => guarded,
  });
  const response = await handler({ headers: new Headers({ authorization: 'Bearer trusted-token' }), json: async () => input }, { error: assert.fail });
  assert.equal(response.status, 200);
  assert.equal(response.jsonBody.engagementId, ENGAGEMENT);
  assert.equal(state.transactions.length, 1);
});
test('handler rejects unsigned identity without constructing privileged IO', async () => {
  const handler = handlerModule.createEngagementBookingHandler({ authenticate: async () => ({ contactId: '', portalBaseUrl: 'https://dev.example.com' }),
    assertMapping: assert.fail, runForPortal: assert.fail, getIdentity: assert.fail, createIo: assert.fail });
  const response = await handler({ headers: new Headers(), json: async () => input }, { error: assert.fail });
  assert.equal(response.status, 403);
  assert.equal(response.jsonBody.ok, false);
});
