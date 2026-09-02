import assert from 'node:assert/strict';
import test from 'node:test';
import * as engagementModel from '../src/types/engagement.ts';
import {
  selectLetterTemplate,
  type LetterContext,
} from '../src/components/letters/letterTemplates.ts';

const REQUEST_ID = '126fd7f8-eea6-f111-aaad-70a8a57062a5';
const LETTER_CONTEXT: LetterContext = {
  request: {} as LetterContext['request'],
  matterLabel: 'Prospective Bidders List (PBL)',
  soaLabel: 'PBL',
};

test('queries only the latest Completed engagement for the request', () => {
  const buildQuery = Reflect.get(
    engagementModel,
    'buildLatestCompletedEngagementQuery',
  ) as ((requestId: string) => unknown) | undefined;

  assert.equal(typeof buildQuery, 'function');
  assert.deepEqual(buildQuery?.(REQUEST_ID), {
    select: ['gcp_engagementnumber'],
    filter: `_gcp_request_value eq ${REQUEST_ID} and gcp_engagementstatus eq 2`,
    orderby: 'gcp_engagementdate desc,createdon desc',
    top: 1,
  });
});

test('reads a trimmed latest engagement number and returns null for no match', () => {
  const readNumber = Reflect.get(
    engagementModel,
    'readLatestEngagementNumber',
  ) as
    | ((response: {
        value: Array<{ gcp_engagementnumber?: string | null }>;
      }) => string | null)
    | undefined;

  assert.equal(typeof readNumber, 'function');
  assert.equal(
    readNumber?.({ value: [{ gcp_engagementnumber: ' R02 ' }] }),
    'R02',
  );
  assert.equal(readNumber?.({ value: [] }), null);
  assert.equal(
    readNumber?.({ value: [{ gcp_engagementnumber: '   ' }] }),
    null,
  );
});

test('auto-fills Review No. only when endorsement context supplies one', () => {
  const reviewVariable = selectLetterTemplate('E', 'PBL').variables.find(
    (variable) => variable.key === 'reviewNo',
  );

  assert.equal(
    reviewVariable?.auto?.({ ...LETTER_CONTEXT, reviewNumber: 'R02' }),
    'R02',
  );
  assert.equal(
    reviewVariable?.auto?.({ ...LETTER_CONTEXT, reviewNumber: null }),
    null,
  );
});
