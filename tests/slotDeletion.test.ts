import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { WebApiError } from '../src/shared/powerPagesApi.ts';
import {
  buildEngagementsBySlotQuery,
  listEngagementsBySlot,
  type EngagementListPageIo,
} from '../src/shared/services/engagementService.ts';
import {
  deleteSlotPreservingEngagements,
  type SlotDeletionIo,
} from '../src/shared/services/slotService.ts';

const SLOT_ID = '11111111-1111-4111-8111-111111111111';
const ENGAGEMENT_ONE = '22222222-2222-4222-8222-222222222222';
const ENGAGEMENT_TWO = '33333333-3333-4333-8333-333333333333';

test('builds an engagement query scoped to a slot lookup', () => {
  const query = buildEngagementsBySlotQuery(SLOT_ID);
  const params = new URLSearchParams(query.slice(1));

  assert.equal(params.get('$filter'), `_gcp_slot_value eq ${SLOT_ID}`);
  assert.equal(params.get('$orderby'), 'createdon asc');
});

test('rejects an invalid slot id before building an engagement query', () => {
  assert.throws(() => buildEngagementsBySlotQuery('not-a-guid'), /valid slot ID/i);
});

test('loads every page of engagements linked to a slot', async () => {
  const urls: string[] = [];
  const io: EngagementListPageIo = {
    getPage: async (url) => {
      urls.push(url);
      if (urls.length === 1) {
        return {
          value: [{ gcp_engagementsid: ENGAGEMENT_ONE }],
          '@odata.nextLink': '/_api/gcp_engagementses?$skiptoken=next',
        };
      }
      return { value: [{ gcp_engagementsid: ENGAGEMENT_TWO }] };
    },
  };

  const rows = await listEngagementsBySlot(SLOT_ID, io);

  assert.deepEqual(rows.map((row) => row.id), [ENGAGEMENT_ONE, ENGAGEMENT_TWO]);
  assert.equal(urls.length, 2);
  assert.match(urls[0], /^\/_api\/gcp_engagementses\?/);
  assert.equal(urls[1], '/_api/gcp_engagementses?$skiptoken=next');
});

test('detaches linked engagements before deleting a booked slot', async () => {
  const events: string[] = [];
  const io: SlotDeletionIo = {
    listEngagementsBySlot: async () => [
      { id: ENGAGEMENT_ONE },
      { id: ENGAGEMENT_TWO },
    ],
    clearEngagementSlot: async (id) => { events.push(`clear:${id}`); },
    restoreEngagementSlot: async (id, slotId) => {
      events.push(`restore:${id}:${slotId}`);
    },
    deleteSlot: async (id) => { events.push(`delete:${id}`); },
  };

  assert.deepEqual(
    await deleteSlotPreservingEngagements(SLOT_ID, io),
    { detachedEngagementCount: 2 },
  );
  assert.deepEqual(events, [
    `clear:${ENGAGEMENT_ONE}`,
    `clear:${ENGAGEMENT_TWO}`,
    `delete:${SLOT_ID}`,
  ]);
});

test('restores detached engagement links when deleting the slot fails', async () => {
  const events: string[] = [];
  const io: SlotDeletionIo = {
    listEngagementsBySlot: async () => [
      { id: ENGAGEMENT_ONE },
      { id: ENGAGEMENT_TWO },
    ],
    clearEngagementSlot: async (id) => { events.push(`clear:${id}`); },
    restoreEngagementSlot: async (id, slotId) => {
      events.push(`restore:${id}:${slotId}`);
    },
    deleteSlot: async () => { throw new Error('delete failed'); },
  };

  await assert.rejects(
    deleteSlotPreservingEngagements(SLOT_ID, io),
    /delete failed/i,
  );
  assert.deepEqual(events, [
    `clear:${ENGAGEMENT_ONE}`,
    `clear:${ENGAGEMENT_TWO}`,
    `restore:${ENGAGEMENT_ONE}:${SLOT_ID}`,
    `restore:${ENGAGEMENT_TWO}:${SLOT_ID}`,
  ]);
});

test('restores every attempted link and does not delete when a detach response is uncertain', async () => {
  const events: string[] = [];
  const io: SlotDeletionIo = {
    listEngagementsBySlot: async () => [
      { id: ENGAGEMENT_ONE },
      { id: ENGAGEMENT_TWO },
    ],
    clearEngagementSlot: async (id) => {
      events.push(`clear:${id}`);
      if (id === ENGAGEMENT_TWO) throw new Error('clear failed');
    },
    restoreEngagementSlot: async (id, slotId) => {
      events.push(`restore:${id}:${slotId}`);
    },
    deleteSlot: async (id) => { events.push(`delete:${id}`); },
  };

  await assert.rejects(
    deleteSlotPreservingEngagements(SLOT_ID, io),
    /clear failed/i,
  );
  assert.deepEqual(events, [
    `clear:${ENGAGEMENT_ONE}`,
    `clear:${ENGAGEMENT_TWO}`,
    `restore:${ENGAGEMENT_ONE}:${SLOT_ID}`,
    `restore:${ENGAGEMENT_TWO}:${SLOT_ID}`,
  ]);
});

test('does not restore a failed engagement after a deterministic 4xx detach', async () => {
  const events: string[] = [];
  const io: SlotDeletionIo = {
    listEngagementsBySlot: async () => [
      { id: ENGAGEMENT_ONE },
      { id: ENGAGEMENT_TWO },
    ],
    clearEngagementSlot: async (id) => {
      events.push(`clear:${id}`);
      if (id === ENGAGEMENT_TWO) {
        throw new WebApiError('permission denied', 403);
      }
    },
    restoreEngagementSlot: async (id, slotId) => {
      events.push(`restore:${id}:${slotId}`);
    },
    deleteSlot: async (id) => { events.push(`delete:${id}`); },
  };

  await assert.rejects(
    deleteSlotPreservingEngagements(SLOT_ID, io),
    /permission denied/i,
  );
  assert.deepEqual(events, [
    `clear:${ENGAGEMENT_ONE}`,
    `clear:${ENGAGEMENT_TWO}`,
    `restore:${ENGAGEMENT_ONE}:${SLOT_ID}`,
  ]);
});

test('slot delete permission is restricted to Administrators', async () => {
  const permission = await readFile(
    new URL(
      '../.powerpages-site/table-permissions/Slot-Admin-Delete.tablepermission.yml',
      import.meta.url,
    ),
    'utf8',
  );

  assert.match(permission, /entitylogicalname:\s*gcp_slot/);
  assert.match(permission, /delete:\s*true/);
  assert.match(permission, /f48675b4-13bf-459d-8a1d-f9a42f468dba/);
  assert.doesNotMatch(permission, /a479817d-fa2b-43f4-9838-3a5a8d2a2b07/);
});
