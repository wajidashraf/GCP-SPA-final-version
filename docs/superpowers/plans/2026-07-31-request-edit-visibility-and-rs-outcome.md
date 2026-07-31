# Request Edit Visibility and RS Outcome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow authorized editing in New, R, and RS while preserving RS-only re-review side effects and ensuring every RS transition writes outcome RS.

**Architecture:** Add a pure shared request-edit policy that owns editable statuses, editor authorization, edit purpose, RS transition fields, and edit copy. Request Detail, Edit Request, Verify Data/request services, and all matter edit forms consume that policy so visibility, direct access, data state, and messaging remain consistent.

**Tech Stack:** React 18, strict TypeScript, React Router 6, Power Pages Web API, Node 24 built-in test runner, Vite 5.

## Global Constraints

- Editable statuses are New (`1`), R (`3`), and RS (`16`) only.
- Authorized editors are the original request owner, Verifier, Reviewer, and Administrator.
- New/R edits preserve status/outcome and do not stamp or notify resubmission.
- RS edits ensure outcome RS (`4`), stamp `gcp_lastupdateddate`, and notify reviewers only after all form writes succeed.
- Verify Data selecting RS writes status `16`, outcome `4`, and clears `gcp_lastupdateddate`.
- Reviewer Code 1, 3, 4, and W remain non-editable through their mapped statuses.
- Do not modify Dataverse schema, logical names, choice integers, or web-role GUIDs.
- Do not deploy, restart, commit, or push without separate explicit authorization.

---

### Task 1: Shared request-edit policy with focused tests

**Files:**
- Create: `src/shared/requestEditPolicy.ts`
- Create: `tests/requestEditPolicy.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `EditPurpose = 'standard' | 'resubmission'`
- Produces: `isEditableRequestStatus(status): boolean`
- Produces: `isAuthorizedRequestEditor(requestorContactId, actor): boolean`
- Produces: `canEditRequest(request, actor): boolean`
- Produces: `getEditPurpose(status): EditPurpose | null`
- Produces: `getEditSubmissionCopy(purpose): EditSubmissionCopy`
- Produces: `getRsVerificationFields(status): RsVerificationFields`
- Produces: `getResubmissionFields(timestamp): ResubmissionFields`

- [ ] **Step 1: Add failing policy tests**

Create Node tests covering:

```ts
assert.equal(isEditableRequestStatus(1), true);
assert.equal(isEditableRequestStatus(3), true);
assert.equal(isEditableRequestStatus(16), true);
assert.equal(isEditableRequestStatus(5), false);
assert.equal(isEditableRequestStatus(17), false);

assert.equal(canEditRequest(
  { status: 1, requestorContactId: 'ABC' },
  { contactId: 'abc', isAdmin: false, isReviewer: false, isVerifier: false },
), true);

assert.equal(getEditPurpose(1), 'standard');
assert.equal(getEditPurpose(3), 'standard');
assert.equal(getEditPurpose(16), 'resubmission');
assert.equal(getEditPurpose(5), null);

assert.deepEqual(getRsVerificationFields(16), {
  gcp_outcome: 4,
  gcp_lastupdateddate: null,
});
assert.deepEqual(getRsVerificationFields(3), {});

assert.deepEqual(getResubmissionFields('2026-07-31T10:00:00.000Z'), {
  gcp_outcome: 4,
  gcp_lastupdateddate: '2026-07-31T10:00:00.000Z',
});
```

- [ ] **Step 2: Add the test command and verify RED**

Add:

```json
"test:edit-policy": "node --test tests/requestEditPolicy.test.ts"
```

Run: `npm run test:edit-policy`  
Expected: FAIL because `src/shared/requestEditPolicy.ts` does not exist.

- [ ] **Step 3: Implement the minimal pure policy**

Use constants for status New `1`, R `3`, RS `16`, and outcome RS `4`. Compare
contact GUIDs case-insensitively. Return standard copy for New/R and
resubmission copy for RS.

- [ ] **Step 4: Verify GREEN**

Run: `npm run test:edit-policy`  
Expected: all policy tests pass.

### Task 2: Apply the shared visibility and direct-access rule

**Files:**
- Modify: `src/pages/RequestDetail.tsx`
- Modify: `src/pages/EditRequest.tsx`

**Interfaces:**
- Consumes: `canEditRequest`, `isAuthorizedRequestEditor`,
  `isEditableRequestStatus`, and `getEditPurpose`
- Produces: identical eligibility behavior for the button and direct route

- [ ] **Step 1: Replace Request Detail’s inline RS-only gate**

Build an actor from the current contact and authorization helpers, then call
`canEditRequest`. Preserve the existing `hasEditForm` requirement.

- [ ] **Step 2: Replace Edit Request’s RS-only guard**

Use `isAuthorizedRequestEditor` for access denial and
`isEditableRequestStatus` for workflow-state denial. Update the unavailable
copy to list New, R, and RS.

- [ ] **Step 3: Pass the edit purpose into every registered edit adapter**

Extend `EditFormProps` with `editPurpose: EditPurpose` and pass the non-null
purpose from `EditRequest`.

- [ ] **Step 4: Run policy tests**

Run: `npm run test:edit-policy`  
Expected: all tests pass.

### Task 3: Enforce RS state invariants

**Files:**
- Modify: `src/shared/services/requestService.ts`
- Modify: `src/pages/EditRequest.tsx`

**Interfaces:**
- Consumes: `getRsVerificationFields` and `getResubmissionFields`
- Produces: correct RS outcome/marker state from both Verifier RS and Reviewer Code 2

- [ ] **Step 1: Make Verify Data’s service transition status-aware**

Merge `getRsVerificationFields(input.status)` into the `verifyRequest` PATCH
body. Status RS gains outcome `4` and a null marker; all other statuses receive
no additional fields.

- [ ] **Step 2: Make resubmission marking repair outcome**

Change `markRequestResubmitted` to PATCH the fields returned by
`getResubmissionFields(new Date().toISOString())`.

- [ ] **Step 3: Reserve marker and notification side effects for RS**

In `EditRequest`, invoke `markRequestResubmitted` and
`notifyEvent('request_resubmitted')` only when `editPurpose ===
'resubmission'`. Standard edits complete without either side effect.

- [ ] **Step 4: Run policy tests**

Run: `npm run test:edit-policy`  
Expected: all tests pass.

### Task 4: Make all matter forms use purpose-correct behavior and copy

**Files:**
- Modify: `src/forms/editRegistry.ts`
- Modify:
  - `src/forms/rtp/RtpEditForm.tsx`
  - `src/forms/pbl/PblEditForm.tsx`
  - `src/forms/jvp/JvpEditForm.tsx`
  - `src/forms/stsp/StspEditForm.tsx`
  - `src/forms/caa/CaaEditForm.tsx`
  - `src/forms/pcca/PccaEditForm.tsx`
  - `src/forms/pp/PpEditForm.tsx`
  - `src/forms/vap/VapEditForm.tsx`
  - `src/forms/others/OthersEditForm.tsx`
  - `src/forms/ci/CiEditForm.tsx`
  - `src/forms/cpr/CprEditForm.tsx`
  - `src/forms/rpcca/RpccaEditForm.tsx`
  - `src/forms/rpp/RppEditForm.tsx`
- Modify:
  - `src/forms/rtp/RtpForm.tsx`
  - `src/forms/pbl/PblForm.tsx`
  - `src/forms/jvp/JvpForm.tsx`
  - `src/forms/stsp/StspForm.tsx`
  - `src/forms/caa/CaaForm.tsx`
  - `src/forms/pcca/PccaForm.tsx`
  - `src/forms/pp/PpForm.tsx`
  - `src/forms/vap/VapForm.tsx`
  - `src/forms/others/OthersForm.tsx`
  - `src/forms/ci/CiForm.tsx`
  - `src/forms/cpr/CprForm.tsx`
  - `src/forms/rpcca/RpccaForm.tsx`
  - `src/forms/rpp/RppForm.tsx`

**Interfaces:**
- Consumes: `EditPurpose` and `getEditSubmissionCopy`
- Produces: standard save copy for New/R and re-review copy/side effects for RS

- [ ] **Step 1: Extend all form props with edit purpose**

Add optional `editPurpose?: EditPurpose` to each matter form and pass the
required `editPurpose` from each edit adapter.

- [ ] **Step 2: Make adapter completion conditional**

Each adapter must:

```ts
if (editPurpose === 'resubmission') {
  await onResubmitted();
}
```

Return the toast message from `getEditSubmissionCopy(editPurpose)`.

- [ ] **Step 3: Replace hard-coded edit copy**

Each matter form must use the shared copy for `submitLabel`, `successTitle`, and
`successMessage`. New form mode remains unchanged.

- [ ] **Step 4: Audit all adapters mechanically**

Run:

```powershell
rg -l "editPurpose" src/forms -g "*EditForm.tsx"
rg -l "getEditSubmissionCopy" src/forms -g "*Form.tsx"
```

Expected: 13 edit adapters and 13 matter forms.

- [ ] **Step 5: Run policy tests**

Run: `npm run test:edit-policy`  
Expected: all tests pass.

### Task 5: Documentation and verification

**Files:**
- Modify: `docs/edit-request-mode-plan.md`
- Modify: `docs/edit-mode-rollout.md`
- Modify: `userguide.md`
- Create: `docs/changes/2026-07-31-request-edit-visibility-and-rs-outcome.md`

**Interfaces:**
- Produces: durable workflow documentation and the requested question/change/Git record

- [ ] **Step 1: Update workflow documentation**

Record New/R/RS edit eligibility, RS-only marker/notification behavior, and the
Verifier RS outcome invariant.

- [ ] **Step 2: Write the Changes document**

Include the questions asked, approved answers, implementation summary, file
groups, test/build results, runtime validation requirements, branch, baseline
dirty-worktree warning, and final Git diff/status summary.

- [ ] **Step 3: Run focused tests**

Run: `npm run test:edit-policy`  
Expected: all tests pass.

- [ ] **Step 4: Build the SPA**

Run: `npm run build`  
Expected: TypeScript and Vite build succeed; record any bundle-size warning.

- [ ] **Step 5: Build Azure Functions**

Run from `api/`: `npm run build`  
Expected: TypeScript build succeeds.

- [ ] **Step 6: Review Git state**

Run:

```powershell
git diff --check
git status --short --branch
git diff --stat
```

Expected: no whitespace errors; pre-existing changes remain preserved and are
distinguished from this implementation in the Changes document.
