# Inline Reviewer Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move required reviewer-comment authoring to Request Detail while leaving decision-code selection and matter-specific Info and Criteria on Request Review.

**Architecture:** Extend the existing block JSON helpers with a meaningful-content predicate, add a narrowly scoped comment-save service operation, and make Request Detail own comment editing. Request Review treats the stored comment as a prerequisite and never includes it in the decision PATCH.

**Tech Stack:** React 18, strict TypeScript, React Bootstrap, lucide-react, Vite, Power Pages Web API/Dataverse.

## Global Constraints

- Preserve the existing `gcp_reviewercomments` version 1 JSON format and legacy plain-text compatibility.
- Do not change the Dataverse schema, choices, relationships, or permissions.
- Reviewer and Administrator are the only roles with inline comment controls.
- Comment editing is open only for status R or an RS correction that has been resubmitted.
- Any submitted decision code locks editing until a later RS correction resubmission.
- Saving a comment must not set `gcp_reviewdate` or change workflow status.
- Decision submission must not overwrite the stored reviewer comment.
- Do not deploy, restart, commit, or push without a separate explicit request.

---

### Task 1: Meaningful reviewer-comment validation

**Files:**
- Modify: `src/forms/reviewComments.ts`
- Modify: `src/forms/index.ts`
- Create: `tests/reviewComments.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `hasMeaningfulReviewComments(blocks: ReviewCommentBlock[]): boolean`
- Produces: `hasStoredReviewComments(raw: string | null | undefined): boolean`

- [ ] **Step 1: Write failing tests for whitespace-only blocks, valid text/list blocks, legacy text, empty JSON, and normalized version 1 serialization.**
- [ ] **Step 2: Run `npm run test:review-comments` and verify failure because the predicates are not exported.**
- [ ] **Step 3: Implement predicates by normalizing blocks and parsing stored data through the existing production helpers.**
- [ ] **Step 4: Run `npm run test:review-comments` and verify all cases pass.**

### Task 2: Dedicated reviewer-comment persistence

**Files:**
- Create: `src/shared/reviewerCommentPayload.ts`
- Modify: `src/shared/services/requestService.ts`

**Interfaces:**
- Consumes: a non-empty serialized version 1 reviewer comment.
- Produces: `saveReviewerComments(id: string, input: SaveReviewerCommentsInput): Promise<void>`.
- Changes: `reviewRequest` no longer accepts or writes `reviewerComments`.

- [ ] **Step 1: Add `SaveReviewerCommentsInput` with `reviewerComments` and optional `reviewedByContactId`.**
- [ ] **Step 2: Validate the current workflow snapshot and PATCH only `gcp_reviewercomments` plus a valid `gcp_Reviewedby@odata.bind` with its ETag; reject empty or stale saves.**
- [ ] **Step 3: Remove `gcp_reviewercomments` from the decision submission payload so saved comments survive all code submissions.**
- [ ] **Step 4: Export the function and type, then run the TypeScript build after page integrations are complete.**

### Task 3: Inline editor in General Review

**Files:**
- Modify: `src/pages/RequestDetail.tsx`

**Interfaces:**
- Consumes: `ReviewCommentEditor`, serialization/validation helpers, `saveReviewerComments`, and `getVerifierInfo`.
- Produces: add/edit/save/cancel controls and immediate General Review refresh.

- [ ] **Step 1: Derive `canManageReviewerComment` from Reviewer/Administrator roles and `isReviewerCommentCycleOpen` from R or resubmitted RS state.**
- [ ] **Step 2: Initialize controlled editor blocks from the stored comment without overwriting active edits during refreshes.**
- [ ] **Step 3: Render the editor above the Review Request action when no saved comment exists or editing is active; otherwise render the saved blocks with an accessible pencil button.**
- [ ] **Step 4: Validate meaningful content, serialize it, save through `saveReviewerComments`, reload General Review data, and retain unsaved content on failure.**
- [ ] **Step 5: Disable the Review Request button until a meaningful comment has been saved and explain the requirement inline.**

### Task 4: Code-only Review Request page with server-state guard

**Files:**
- Modify: `src/pages/RequestReview.tsx`

**Interfaces:**
- Consumes: `getReviewFields` and `hasStoredReviewComments`.
- Produces: decision-only submission while preserving Info and Criteria for matters 6, 7, 10, and 14.

- [ ] **Step 1: Remove reviewer-comment editor imports, block state, rendering, serialization, and submission fields.**
- [ ] **Step 2: Load the stored reviewer comment as prerequisite state for initial, draft, and resubmission modes; retain current decision prefill rules and Info and Criteria behavior.**
- [ ] **Step 3: Display a blocking message and return link when no meaningful saved comment exists.**
- [ ] **Step 4: Load one reviewer/workflow snapshot immediately before confirmation, reject missing comments or mode changes, and use its ETag for the decision PATCH.**
- [ ] **Step 5: Submit only decision, status, outcome, optional Info and Criteria, reviewer lookup, review date, and resubmission-marker reset.**

### Task 5: Unified modern editor styling and accessibility

**Files:**
- Modify: `src/forms/ReviewCommentEditor.tsx`
- Modify: `src/styles/requestReview.css`
- Modify: `src/styles/requestDetail.css`

**Interfaces:**
- Preserves: controlled `ReviewCommentEditorProps` and `ReviewCommentBlock[]` data model.
- Produces: a single visual editor surface with a top Text/UL/OL toolbar.

- [ ] **Step 1: Move add-block actions into a compact top toolbar and render blocks in one continuous canvas instead of separate cards.**
- [ ] **Step 2: Keep block reorder/remove and list-item add/remove behavior with accessible labels and decorative icons hidden from assistive technology.**
- [ ] **Step 3: Add focus-visible, error, empty-state, save-row, and locked-display styles consistent with the existing request-detail palette.**
- [ ] **Step 4: Check keyboard reachability, disabled states, and responsive wrapping by reviewing the rendered markup and CSS breakpoints.**

### Task 6: Verification and review

**Files:**
- Verify all modified files.

**Interfaces:**
- Produces: evidence that the feature compiles and the pure comment contract is protected.

- [ ] **Step 1: Run `npm run test:edit-policy` and `npm run test:review-comments`.**
- [ ] **Step 2: Run root `npm run build`.**
- [ ] **Step 3: Run `npm run build` in `api`.**
- [ ] **Step 4: Inspect `git diff --check`, `git status`, and the scoped diff for accidental or unrelated changes.**
- [ ] **Step 5: Request an independent code review and address all material findings.**
- [ ] **Step 6: Repeat tests and builds after review fixes, leaving the uncommitted feature branch ready for explicit integration instructions.**
