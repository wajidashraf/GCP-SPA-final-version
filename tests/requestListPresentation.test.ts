import assert from 'node:assert/strict';
import test from 'node:test';
import { getRequestRowPresentation } from '../src/shared/requestListPresentation.ts';

test('renders a verified missing request as Draft with Edit only', () => {
  assert.deepEqual(getRequestRowPresentation('New', 'missing'), {
    displayStatus: 'Draft',
    actionMode: 'edit',
    isClickable: false,
    isDisabled: false,
  });
});

test('disables an unverifiable request instead of offering repair', () => {
  assert.deepEqual(getRequestRowPresentation('New', 'unknown'), {
    displayStatus: 'Unable to verify',
    actionMode: 'disabled',
    isClickable: false,
    isDisabled: true,
  });
});

test('keeps complete request behavior unchanged', () => {
  assert.deepEqual(getRequestRowPresentation('New', 'complete'), {
    displayStatus: 'New',
    actionMode: 'normal',
    isClickable: true,
    isDisabled: false,
  });
});

test('withholds actions while integrity is loading', () => {
  assert.deepEqual(getRequestRowPresentation('New', undefined), {
    displayStatus: 'Checking details',
    actionMode: 'loading',
    isClickable: false,
    isDisabled: true,
  });
});
