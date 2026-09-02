import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildParentLookupFilter,
  chunkValues,
  classifyRequestIntegrity,
  hasRequiredAssociatedData,
  resolveChildKind,
} from '../src/shared/requestIntegrity.ts';
import type { IntegrityEvidence } from '../src/shared/requestIntegrity.ts';
import type { GcpRequest } from '../src/types/request.ts';
import {
  checkRequestIntegrity,
} from '../src/shared/services/requestIntegrityService.ts';
import type {
  IntegrityLookupQuery,
  IntegrityLookupRow,
} from '../src/shared/services/requestIntegrityService.ts';

const REQUEST_ID = '11111111-1111-1111-1111-111111111111';

const request = (
  overrides: Partial<GcpRequest> = {},
): GcpRequest =>
  ({
    id: REQUEST_ID,
    status: 1,
    soaCode: 5,
    matter: 5,
    ...overrides,
  }) as GcpRequest;

const evidence = (
  overrides: Partial<IntegrityEvidence> = {},
): IntegrityEvidence => ({
  queriedKinds: new Set(['caa']),
  failedKinds: new Set(),
  childParentIds: new Set(),
  pblBidderParentIds: new Set(),
  ...overrides,
});

test('resolves every supported SOA code to its verified child kind', () => {
  const expected = new Map<number, string>([
    [1, 'rtp'],
    [2, 'pbl'],
    [3, 'jvp'],
    [4, 'stsp'],
    [5, 'caa'],
    [6, 'pcca'],
    [7, 'pp'],
    [8, 'vap'],
    [9, 'other'],
    [10, 'rpcca'],
    [11, 'ci'],
    [12, 'cpr'],
    [13, 'other'],
    [14, 'rpp'],
  ]);

  for (const [soaCode, kind] of expected) {
    assert.equal(resolveChildKind(request({ soaCode: soaCode as GcpRequest['soaCode'] })), kind);
  }
});

test('chunks parent IDs without dropping or duplicating values', () => {
  assert.deepEqual(chunkValues(['a', 'b', 'c', 'd', 'e'], 2), [
    ['a', 'b'],
    ['c', 'd'],
    ['e'],
  ]);
  assert.throws(() => chunkValues(['a'], 0), /at least 1/i);
});

test('builds a parent lookup filter for a batched child query', () => {
  const secondId = '22222222-2222-2222-2222-222222222222';
  assert.equal(
    buildParentLookupFilter('_gcp_request_value', [REQUEST_ID, secondId]),
    `_gcp_request_value eq '${REQUEST_ID}' or _gcp_request_value eq '${secondId}'`,
  );
  assert.throws(
    () => buildParentLookupFilter('_gcp_request_value', []),
    /at least one parent/i,
  );
});

test('classifies a successfully queried New parent with no child as missing', () => {
  assert.equal(classifyRequestIntegrity(request(), evidence()), 'missing');
});

test('classifies a visible direct child as complete', () => {
  assert.equal(
    classifyRequestIntegrity(
      request(),
      evidence({ childParentIds: new Set([REQUEST_ID]) }),
    ),
    'complete',
  );
});

test('never offers repair after a failed query or for a non-New request', () => {
  assert.equal(
    classifyRequestIntegrity(
      request(),
      evidence({ failedKinds: new Set(['caa']) }),
    ),
    'unknown',
  );
  assert.equal(
    classifyRequestIntegrity(request({ status: 3 }), evidence()),
    'unknown',
  );
});

test('requires both the direct PBL child and at least one bidder', () => {
  const pblRequest = request({ soaCode: 2, matter: 2 });
  const pblEvidence = evidence({
    queriedKinds: new Set(['pbl']),
    childParentIds: new Set([REQUEST_ID]),
  });

  assert.equal(classifyRequestIntegrity(pblRequest, pblEvidence), 'missing');
  assert.equal(
    classifyRequestIntegrity(pblRequest, {
      ...pblEvidence,
      pblBidderParentIds: new Set([REQUEST_ID]),
    }),
    'complete',
  );
});

test('treats empty child data as incomplete and checks PBL bidders', () => {
  assert.equal(hasRequiredAssociatedData({ type: 'caa', records: [] }), false);
  assert.equal(
    hasRequiredAssociatedData({
      type: 'caa',
      records: [{ id: 'child' }] as never[],
    }),
    true,
  );
  assert.equal(
    hasRequiredAssociatedData({
      type: 'pbl',
      records: [{ id: 'pbl' }] as never[],
      bidders: [],
    }),
    false,
  );
});

test('checks direct children and PBL bidders in grouped lookup queries', async () => {
  const caaId = REQUEST_ID;
  const pblId = '22222222-2222-2222-2222-222222222222';
  const pblChildId = '33333333-3333-3333-3333-333333333333';
  const requests = [
    request({ id: caaId, soaCode: 5, matter: 5 }),
    request({ id: pblId, soaCode: 2, matter: 2 }),
  ];

  const loadRows = async (
    query: IntegrityLookupQuery,
  ): Promise<IntegrityLookupRow[]> => {
    if (query.entitySet === 'gcp_caarequests') {
      return [{ _gcp_request_value: caaId }];
    }
    if (query.entitySet === 'gcp_pblrequests') {
      return [{
        gcp_pblrequestid: pblChildId,
        _gcp_request_value: pblId,
      }];
    }
    if (query.entitySet === 'gcp_pblbidderses') {
      return [{ _gcp_pblrequest_value: pblChildId }];
    }
    return [];
  };

  const result = await checkRequestIntegrity(requests, loadRows);

  assert.equal(result.get(caaId), 'complete');
  assert.equal(result.get(pblId), 'complete');
});

test('isolates a failed child-table query as unknown', async () => {
  const caa = request();
  const loadRows = async (
    query: IntegrityLookupQuery,
  ): Promise<IntegrityLookupRow[]> => {
    if (query.entitySet === 'gcp_caarequests') {
      throw new Error('CAA table denied');
    }
    return [];
  };

  const result = await checkRequestIntegrity([caa], loadRows);

  assert.equal(result.get(caa.id), 'unknown');
});
