import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAcceptReviewPayload } from '../src/shared/acceptReviewPayload.ts';

test('maps the unified choice to Code 1a and clears legacy Code 1b data', () => {
  assert.deepEqual(
    buildAcceptReviewPayload(
      { code: '1a', targetStatus: 9 },
      '2026-08-24',
    ),
    {
      gcp_reviewconclusioncode1a: true,
      gcp_reviewconclusioncode1b: false,
      gcp_reviewconclusioncode2: false,
      gcp_reviewconclusioncode3: false,
      gcp_reviewconclusioncode1bcomment: '',
      gcp_acceptancedate: '2026-08-24',
      gcp_requeststatus: 9,
    },
  );
});

test('preserves Code 2 and Code 3 payload behavior', () => {
  assert.equal(
    buildAcceptReviewPayload({ code: '2', targetStatus: 11 }, '2026-08-24')
      .gcp_reviewconclusioncode2,
    true,
  );
  assert.equal(
    buildAcceptReviewPayload({ code: '3' }, '2026-08-24')
      .gcp_requeststatus,
    8,
  );
});
