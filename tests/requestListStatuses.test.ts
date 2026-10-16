import assert from 'node:assert/strict';
import test from 'node:test';
import * as statuses from '../src/shared/requestStatusPresentation.ts';
import { filterRequestList, parseRequestListState } from '../src/shared/requestListState.ts';
const request = { id: 'req-1283', status: 2 as const, projectName: 'Project', companyName: 'Company', companyCode: null,
  matter: 1, submittedOn: null, title: 'REQ-1283' };
test('fresh saved status replaces cached Ready before display and filtering', async () => {
  assert.equal(typeof statuses.refreshRequestListStatuses, 'function');
  const refreshed = await statuses.refreshRequestListStatuses([request], async ids => {
    assert.deepEqual(ids, [request.id]); return [{ id: request.id, status: 3 }];
  });
  assert.equal(statuses.getRequestStatusDisplayLabel(refreshed[0].status), 'Booked (R)');
  assert.equal(filterRequestList(refreshed, parseRequestListState(new URLSearchParams('status=2')), new Map()).length, 0);
  assert.equal(filterRequestList(refreshed, parseRequestListState(new URLSearchParams('status=3')), new Map()).length, 1);
  assert.equal(request.status, 2, 'Do not mutate portal records');
});
test('fresh later workflow status cannot be pinned to Booked by an older booking', async () => {
  assert.equal(typeof statuses.refreshRequestListStatuses, 'function');
  const refreshed = await statuses.refreshRequestListStatuses([request], async () => [{ id: request.id, status: 5 }]);
  assert.equal(refreshed[0].status, 5);
  assert.equal(refreshed[0].title, request.title);
});
test('a missing or no-longer-authorized request is omitted rather than displaying its stale status', async () => {
  assert.equal(typeof statuses.refreshRequestListStatuses, 'function');
  assert.deepEqual(await statuses.refreshRequestListStatuses([request], async () => []), []);
});
test('failed status refresh is surfaced instead of treating cached data as fresh', async () => {
  assert.equal(typeof statuses.refreshRequestListStatuses, 'function');
  await assert.rejects(statuses.refreshRequestListStatuses([request], async () => { throw new Error('Read unavailable'); }), /Read unavailable/);
});
test('status refresh batches large pages and preserves row order and fields', async () => {
  const records = Array.from({ length: 101 }, (_, i) => ({ ...request, id: `request-${i}` }));
  const sizes: number[] = [];
  const result = await statuses.refreshRequestListStatuses(records, async ids => {
    sizes.push(ids.length);
    return [...ids].reverse().map(id => ({ id, status: 3 }));
  });
  assert.deepEqual(sizes, [100, 1]);
  assert.deepEqual(result.map(row => row.id), records.map(row => row.id));
  assert.ok(result.every(row => row.status === 3 && row.title === request.title));
});
