import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canRenderEditRequest,
  canEditRequest,
  getEditPurpose,
  getEditSubmissionCopy,
  getResubmissionFields,
  getRsVerificationFields,
  isAuthorizedRequestEditor,
  isEditableRequestStatus,
} from '../src/shared/requestEditPolicy.ts';

const noRoles = {
  contactId: null,
  isAdmin: false,
  isReviewer: false,
  isVerifier: false,
};

test('allows editing only for New, R, and RS statuses', () => {
  const expected = new Map<number | null, boolean>([
    [null, false],
    [0, false],
    [1, true],
    [2, false],
    [3, true],
    [4, false],
    [5, false],
    [16, true],
    [17, false],
    [18, false],
    [19, false],
  ]);

  for (const [status, allowed] of expected) {
    assert.equal(isEditableRequestStatus(status), allowed, `status ${status}`);
  }
});

test('authorizes the original requestor with case-insensitive contact IDs', () => {
  assert.equal(
    isAuthorizedRequestEditor('A0B1C2D3-E4F5-6789-ABCD-EF0123456789', {
      ...noRoles,
      contactId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
    }),
    true,
  );
});

test('authorizes verifier, reviewer, and administrator roles', () => {
  assert.equal(
    isAuthorizedRequestEditor(null, { ...noRoles, isVerifier: true }),
    true,
  );
  assert.equal(
    isAuthorizedRequestEditor(null, { ...noRoles, isReviewer: true }),
    true,
  );
  assert.equal(
    isAuthorizedRequestEditor(null, { ...noRoles, isAdmin: true }),
    true,
  );
  assert.equal(isAuthorizedRequestEditor(null, noRoles), false);
});

test('requires both an editable status and an authorized editor', () => {
  assert.equal(
    canEditRequest(
      { status: 1, requestorContactId: 'ABC' },
      { ...noRoles, contactId: 'abc' },
    ),
    true,
  );
  assert.equal(
    canEditRequest(
      { status: 5, requestorContactId: 'ABC' },
      { ...noRoles, contactId: 'abc' },
    ),
    false,
  );
  assert.equal(
    canEditRequest({ status: 16, requestorContactId: 'ABC' }, noRoles),
    false,
  );
});

test('renders an edit form only after auth/load settle for the current route ID', () => {
  const ready = {
    authLoading: false,
    requestLoading: false,
    routeId: 'request-b',
    requestId: 'request-b',
  };

  assert.equal(canRenderEditRequest(ready), true);
  assert.equal(canRenderEditRequest({ ...ready, authLoading: true }), false);
  assert.equal(canRenderEditRequest({ ...ready, requestLoading: true }), false);
  assert.equal(
    canRenderEditRequest({ ...ready, requestId: 'request-a' }),
    false,
  );
  assert.equal(canRenderEditRequest({ ...ready, routeId: undefined }), false);
});

test('uses standard edit behavior for New/R and resubmission behavior for RS', () => {
  assert.equal(getEditPurpose(1), 'standard');
  assert.equal(getEditPurpose(3), 'standard');
  assert.equal(getEditPurpose(16), 'resubmission');
  assert.equal(getEditPurpose(5), null);

  assert.deepEqual(getEditSubmissionCopy('standard'), {
    submitLabel: 'Save Changes',
    successTitle: 'Changes saved',
    successMessage:
      'Your changes have been saved. The request remains in its current workflow stage.',
    toastMessage: 'Changes saved.',
  });
  assert.deepEqual(getEditSubmissionCopy('resubmission'), {
    submitLabel: 'Submit Changes for Re-review',
    successTitle: 'Changes submitted',
    successMessage:
      'Your changes have been submitted for review. Status and outcome remain RS until the reviewer completes the review.',
    toastMessage: 'Changes submitted for re-review.',
  });
});

test('adds RS outcome and clears the marker only when verification selects RS', () => {
  assert.deepEqual(getRsVerificationFields(16), {
    gcp_outcome: 4,
    gcp_lastupdateddate: null,
  });
  assert.deepEqual(getRsVerificationFields(3), {});
  assert.deepEqual(getRsVerificationFields(1), {});
});

test('repairs RS outcome when stamping a completed resubmission', () => {
  assert.deepEqual(getResubmissionFields('2026-07-31T10:00:00.000Z'), {
    gcp_outcome: 4,
    gcp_lastupdateddate: '2026-07-31T10:00:00.000Z',
  });
});
