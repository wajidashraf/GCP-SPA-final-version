import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canDeleteRequests,
  deleteRequestTree,
  RequestDeletionError,
} from '../src/shared/services/requestDeletionService.ts';
import type { RequestDeletionIo } from '../src/shared/services/requestDeletionService.ts';
import type { GcpRequest } from '../src/types/request.ts';

type DeletableRequest = Pick<GcpRequest, 'id' | 'soaCode' | 'matter'>;

const request = (
  overrides: Partial<DeletableRequest> = {},
): DeletableRequest => ({
  id: 'request-1',
  soaCode: 2,
  matter: 2,
  ...overrides,
});

const createIo = (
  rows: Record<string, string[]> = {},
  deleteFailure?: (entitySet: string, id: string) => unknown,
) => {
  const events: string[] = [];
  const notFound = Symbol('not-found');
  const io: RequestDeletionIo = {
    listIds: async (source, parentId) => {
      events.push(`list:${source.entitySet}:${parentId}`);
      return rows[`${source.entitySet}:${parentId}`] ?? [];
    },
    deleteRecord: async (entitySet, id) => {
      events.push(`delete:${entitySet}:${id}`);
      const failure = deleteFailure?.(entitySet, id);
      if (failure) throw failure;
    },
    isNotFound: (error) => error === notFound,
  };
  return { events, io, notFound };
};

test('deletes PBL bidders before the child and parent request', async () => {
  const { events, io } = createIo({
    'gcp_pblrequests:request-1': ['pbl-1'],
    'gcp_pblbidderses:pbl-1': ['bidder-1'],
  });

  assert.deepEqual(await deleteRequestTree(request(), io), {
    deletedBidders: 1,
    deletedChildren: 1,
    parentDeleted: true,
  });
  assert.deepEqual(events, [
    'list:gcp_pblrequests:request-1',
    'list:gcp_pblbidderses:pbl-1',
    'delete:gcp_pblbidderses:bidder-1',
    'delete:gcp_pblrequests:pbl-1',
    'delete:gcp_requests:request-1',
  ]);
});

test('deletes a non-PBL child before its parent', async () => {
  const { events, io } = createIo({
    'gcp_rtprequests:request-1': ['rtp-1'],
  });

  await deleteRequestTree(request({ soaCode: 1, matter: 1 }), io);
  assert.deepEqual(events, [
    'list:gcp_rtprequests:request-1',
    'delete:gcp_rtprequests:rtp-1',
    'delete:gcp_requests:request-1',
  ]);
});

test('deletes the parent when no direct child rows exist', async () => {
  const { events, io } = createIo();

  assert.deepEqual(await deleteRequestTree(request(), io), {
    deletedBidders: 0,
    deletedChildren: 0,
    parentDeleted: true,
  });
  assert.deepEqual(events, [
    'list:gcp_pblrequests:request-1',
    'delete:gcp_requests:request-1',
  ]);
});

test('rejects unsupported request types before any I/O', async () => {
  const { events, io } = createIo();

  await assert.rejects(
    deleteRequestTree(request({ soaCode: null, matter: null }), io),
    (error: unknown) =>
      error instanceof RequestDeletionError && error.stage === 'child',
  );
  assert.deepEqual(events, []);
});

test('continues after idempotent 404 delete responses', async () => {
  const { events, io, notFound } = createIo(
    { 'gcp_rtprequests:request-1': ['rtp-1'] },
    (entitySet) => (entitySet === 'gcp_rtprequests' ? notFound : undefined),
  );

  assert.deepEqual(
    await deleteRequestTree(request({ soaCode: 1, matter: 1 }), io),
    {
      deletedBidders: 0,
      deletedChildren: 0,
      parentDeleted: true,
    },
  );
  assert.deepEqual(events, [
    'list:gcp_rtprequests:request-1',
    'delete:gcp_rtprequests:rtp-1',
    'delete:gcp_requests:request-1',
  ]);
});

test('stops before deleting the parent after a non-404 child failure', async () => {
  const failure = new Error('permission denied');
  const { events, io } = createIo(
    { 'gcp_rtprequests:request-1': ['rtp-1'] },
    (entitySet) => (entitySet === 'gcp_rtprequests' ? failure : undefined),
  );

  await assert.rejects(
    deleteRequestTree(request({ soaCode: 1, matter: 1 }), io),
    (error: unknown) =>
      error instanceof RequestDeletionError &&
      error.stage === 'child' &&
      error.cause === failure,
  );
  assert.deepEqual(events, [
    'list:gcp_rtprequests:request-1',
    'delete:gcp_rtprequests:rtp-1',
  ]);
});

test('recognizes the Administrator role case-insensitively', () => {
  assert.equal(canDeleteRequests(['Administrators']), true);
  assert.equal(canDeleteRequests([' administrators ']), true);
  assert.equal(canDeleteRequests(['Requestor']), false);
});
