import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasMeaningfulReviewComments,
  hasStoredReviewComments,
  reviewCommentsToText,
  serializeReviewComments,
} from '../src/forms/reviewComments.ts';
import { buildReviewerCommentPayload } from '../src/shared/reviewerCommentPayload.ts';

test('rejects comments containing only whitespace in text and list blocks', () => {
  assert.equal(
    hasMeaningfulReviewComments([
      { type: 'text', text: '   ' },
      { type: 'bulleted-list', items: ['', '  '] },
      { type: 'numbered-list', items: ['\t'] },
    ]),
    false,
  );
});

test('accepts meaningful content in any supported block type', () => {
  assert.equal(
    hasMeaningfulReviewComments([{ type: 'text', text: 'Review note' }]),
    true,
  );
  assert.equal(
    hasMeaningfulReviewComments([
      { type: 'bulleted-list', items: ['', 'Provide evidence'] },
    ]),
    true,
  );
  assert.equal(
    hasMeaningfulReviewComments([
      { type: 'numbered-list', items: ['Confirm scope'] },
    ]),
    true,
  );
});

test('accepts legacy plain text and meaningful stored JSON comments', () => {
  assert.equal(hasStoredReviewComments('Legacy reviewer note'), true);
  assert.equal(
    hasStoredReviewComments(
      '{"version":1,"blocks":[{"type":"numbered-list","items":["First action"]}]}',
    ),
    true,
  );
});

test('rejects absent and normalized-empty stored comments', () => {
  assert.equal(hasStoredReviewComments(null), false);
  assert.equal(hasStoredReviewComments('   '), false);
  assert.equal(hasStoredReviewComments('{"version":1,"blocks":[]}'), false);
  assert.equal(
    hasStoredReviewComments(
      '{"version":1,"blocks":[{"type":"text","text":"   "}]}',
    ),
    false,
  );
});

test('rejects malformed or structurally invalid JSON comments', () => {
  assert.equal(hasStoredReviewComments('{"version":1,"blocks":'), false);
  assert.equal(hasStoredReviewComments('"JSON scalar"'), false);
  assert.equal(
    hasStoredReviewComments(
      '{"version":1,"blocks":[{"type":"unsupported","text":"Note"}]}',
    ),
    false,
  );
});

test('normalizes mixed blocks into the existing version 1 JSON contract', () => {
  assert.equal(
    serializeReviewComments([
      { type: 'text', text: '  Summary  ' },
      { type: 'bulleted-list', items: [' Evidence ', ''] },
      { type: 'numbered-list', items: ['  ', 'Approval'] },
    ]),
    '{"version":1,"blocks":[{"type":"text","text":"Summary"},{"type":"bulleted-list","items":["Evidence"]},{"type":"numbered-list","items":["Approval"]}]}',
  );
});

test('converts saved structured comments into readable textarea text', () => {
  assert.equal(
    reviewCommentsToText(
      '{"version":1,"blocks":[{"type":"text","text":"Summary"},{"type":"bulleted-list","items":["Evidence","Approval"]},{"type":"numbered-list","items":["Confirm scope","Notify team"]}]}',
    ),
    'Summary\n\n• Evidence\n• Approval\n\n1. Confirm scope\n2. Notify team',
  );
});

test('builds a comment-only Dataverse payload', () => {
  const serialized =
    '{"version":1,"blocks":[{"type":"text","text":"Saved note"}]}';

  assert.deepEqual(buildReviewerCommentPayload(serialized), {
    gcp_reviewercomments: serialized,
  });
});

test('rejects an empty reviewer comment before persistence', () => {
  assert.throws(
    () => buildReviewerCommentPayload('  '),
    /Reviewer comment is required/,
  );
});
