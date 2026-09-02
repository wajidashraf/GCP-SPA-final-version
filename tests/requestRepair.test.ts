import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertStillMissing,
  buildRepairParentPayload,
  resolveParentWrite,
  selectPblRepairPath,
} from '../src/forms/repairRequest.ts';
import type { GcpRequest } from '../src/types/request.ts';

const REQUEST_ID = '11111111-1111-1111-1111-111111111111';

const request = {
  id: REQUEST_ID,
  status: 1,
  soaCode: 5,
  matter: 5,
} as GcpRequest;

test('repair parent payload excludes identity and workflow fields', () => {
  const payload = buildRepairParentPayload(
    {
      categoryValue: 2,
      matterValue: 5,
      projectName: 'Test Project',
      projectCode: 'PRO-1000',
      projectDescription: 'Saved description',
      acknowledged: true,
    },
    [{ name: 'award.pdf', url: 'https://files.example/award.pdf' }],
  );

  assert.deepEqual(payload, {
    gcp_category: 2,
    gcp_mattertype: 5,
    gcp_project_name: 'Test Project',
    gcp_projectcode: 'PRO-1000',
    gcp_projectdiscription: 'Saved description',
    gcp_acknowledgement: true,
    gcp_documentsurl:
      '[{"name":"award.pdf","url":"https://files.example/award.pdf"}]',
  });
  assert.equal('gcp_requestoremail' in payload, false);
  assert.equal('gcp_requeststatus' in payload, false);
  assert.equal('gcp_Company@odata.bind' in payload, false);
});

test('does not clear an existing project code when a form does not own it', () => {
  const payload = buildRepairParentPayload(
    {
      categoryValue: 2,
      matterValue: 1,
      projectName: 'New RTP Project',
      projectDescription: 'Tender registration',
      acknowledged: true,
    },
    [],
  );

  assert.equal('gcp_projectcode' in payload, false);
});

test('selects parent reuse only when an existing parent ID is provided', () => {
  assert.deepEqual(resolveParentWrite(REQUEST_ID), {
    mode: 'reuse',
    requestId: REQUEST_ID,
  });
  assert.deepEqual(resolveParentWrite(null), { mode: 'create' });
});

test('preflight allows only a freshly verified missing request', async () => {
  await assert.doesNotReject(
    assertStillMissing(request, async () => new Map([[REQUEST_ID, 'missing']])),
  );
  await assert.rejects(
    assertStillMissing(request, async () => new Map([[REQUEST_ID, 'complete']])),
    /already exists/i,
  );
  await assert.rejects(
    assertStillMissing(request, async () => new Map([[REQUEST_ID, 'unknown']])),
    /could not be verified/i,
  );
});

test('chooses bidder repair without creating a second PBL child', () => {
  assert.equal(
    selectPblRepairPath({ childCount: 0, bidderCount: 0 }),
    'create-child',
  );
  assert.equal(
    selectPblRepairPath({ childCount: 1, bidderCount: 0 }),
    'add-bidders',
  );
  assert.equal(
    selectPblRepairPath({ childCount: 1, bidderCount: 1 }),
    'complete',
  );
});
