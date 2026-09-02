import assert from 'node:assert/strict';
import test from 'node:test';
import {
  UNIFIED_CODE_ONE_STATEMENT,
  deriveHocAcceptanceCode,
  getHocAcceptanceOptions,
} from '../src/components/acceptance/hocAcceptanceConclusions.ts';

test('shows one unlabeled unified option for reviewer Decision Code 1', () => {
  assert.deepEqual(getHocAcceptanceOptions(1), [
    {
      value: '1a',
      label: null,
      description: UNIFIED_CODE_ONE_STATEMENT,
    },
  ]);
  assert.equal(
    UNIFIED_CODE_ONE_STATEMENT,
    'We accept the summary review conclusion code and we agree to incorporate',
  );
});

test('keeps Decision Code 2 and Code 3 options unchanged', () => {
  assert.deepEqual(getHocAcceptanceOptions(2), [
    {
      value: '2',
      label: 'Code 2',
      description:
        'We acknowledge the need to resubmit the document and incorporate your comments.',
    },
    {
      value: '3',
      label: 'Code 3',
      description: 'Acknowledged. We admit the non-compliance.',
    },
  ]);
});

test('normalizes historical Code 1b records to the unified Code 1a presentation', () => {
  assert.equal(
    deriveHocAcceptanceCode({
      reviewCode1a: false,
      reviewCode1b: true,
      reviewCode2: false,
      reviewCode3: false,
    }),
    '1a',
  );
});
