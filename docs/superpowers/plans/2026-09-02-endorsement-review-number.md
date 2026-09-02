# Endorsement Review Number Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-populate endorsement Review No. from the most recent Completed engagement while retaining a manual field when no Completed engagement exists.

**Architecture:** Add a focused, read-only query to the existing engagement service and pass its result into the existing letter context. The shared Review No. variable uses the current auto-value convention, so it becomes read-only only when the endorsement page supplies a non-empty engagement number.

**Tech Stack:** React 18, strict TypeScript, Power Pages Web API, Node test runner, Vite.

## Global Constraints

- Do not change Dataverse tables, columns, relationships, or choice values.
- Do not broaden Power Pages permissions or web-role assignments.
- A Completed engagement is `gcp_engagementstatus = 2`.
- Most recent means `gcp_engagementdate desc,createdon desc`.
- No Completed engagement leaves Review No. blank and editable.
- A failed engagement lookup withholds the endorsement editor and displays an error.
- Preserve unrelated and pre-existing working-tree changes.
- Do not commit or push without separate user authorization.

---

### Task 1: Query the latest Completed engagement number

**Files:**
- Modify: `src/types/engagement.ts`
- Modify: `src/shared/services/engagementService.ts`
- Create: `tests/endorsementReviewNumber.test.ts`

**Interfaces:**
- Consumes: `buildODataQuery`, `powerPagesFetch`, `ENGAGEMENT_STATUS_COMPLETED`, and the existing `gcp_engagements` schema mirror.
- Produces: Node-testable `buildLatestCompletedEngagementQuery(requestId: string)` and `readLatestEngagementNumber(response): string | null` helpers in `src/types/engagement.ts`, plus `getLatestCompletedEngagementNumberByRequest(requestId: string): Promise<string | null>` in the browser service.

- [x] **Step 1: Write failing query and result tests**

```ts
test('queries only the latest Completed engagement for the request', () => {
  assert.deepEqual(buildLatestCompletedEngagementQuery(REQUEST_ID), {
    select: ['gcp_engagementnumber'],
    filter: `_gcp_request_value eq ${REQUEST_ID} and gcp_engagementstatus eq 2`,
    orderby: 'gcp_engagementdate desc,createdon desc',
    top: 1,
  });
});

test('reads a trimmed latest number and returns null for no match', () => {
  assert.equal(
    readLatestEngagementNumber({ value: [{ gcp_engagementnumber: ' R02 ' }] }),
    'R02',
  );
  assert.equal(readLatestEngagementNumber({ value: [] }), null);
});
```

- [x] **Step 2: Run the focused test and verify it fails**

Run: `node --test tests/endorsementReviewNumber.test.ts`

Expected: FAIL because the new engagement query helpers do not exist.

- [x] **Step 3: Implement the focused service query**

```ts
const buildLatestCompletedEngagementQuery = (requestId: string) => ({
  select: ['gcp_engagementnumber'],
  filter: `_gcp_request_value eq ${escapeODataString(requestId)} and gcp_engagementstatus eq ${ENGAGEMENT_STATUS_COMPLETED}`,
  orderby: 'gcp_engagementdate desc,createdon desc',
  top: 1,
});
```

Keep the pure query/result helpers beside the existing engagement schema mapper
so Node can exercise them without importing the browser Web API client. Have
`getLatestCompletedEngagementNumberByRequest` execute the tested query through
the existing Power Pages Web API client.

- [x] **Step 4: Run the focused test and verify it passes**

Run: `node --test tests/endorsementReviewNumber.test.ts`

Expected: all tests pass.

### Task 2: Apply conditional auto/read-only behavior on the endorsement page

**Files:**
- Modify: `src/components/letters/letterTemplates.ts`
- Modify: `src/pages/EndorsementLetterPage.tsx`
- Modify: `tests/endorsementReviewNumber.test.ts`

**Interfaces:**
- Consumes: `getLatestCompletedEngagementNumberByRequest(requestId)` and the existing `LetterVariable.auto` rendering behavior.
- Produces: `LetterContext.reviewNumber?: string | null`; Review No. resolves automatically only when this property is non-empty.

- [x] **Step 1: Add failing conditional template tests**

```ts
test('auto-fills Review No. only when endorsement context supplies one', () => {
  const reviewVariable = selectLetterTemplate('E', 'PBL').variables.find(
    (variable) => variable.key === 'reviewNo',
  );
  assert.equal(reviewVariable?.auto?.({ ...context, reviewNumber: 'R02' }), 'R02');
  assert.equal(reviewVariable?.auto?.({ ...context, reviewNumber: null }), null);
});
```

- [x] **Step 2: Run the focused test and verify it fails**

Run: `node --test tests/endorsementReviewNumber.test.ts`

Expected: FAIL because `LetterContext` and the Review No. variable do not yet support the automatic value.

- [x] **Step 3: Extend the letter context and Review No. variable**

```ts
export interface LetterContext {
  request: GcpRequest;
  matterLabel: string;
  soaLabel: string | null;
  reviewNumber?: string | null;
}

const vReviewNo: LetterVariable = {
  key: 'reviewNo',
  label: 'Review No.',
  placeholder: 'e.g. R01',
  auto: (context) => context.reviewNumber ?? null,
};
```

- [x] **Step 4: Load the value on `EndorsementLetterPage`**

Load the latest Completed engagement number for the current route ID, include
it in `LetterContext`, and gate letter rendering on lookup completion. Preserve
`null` as the successful no-match result. Store failures separately and render
an engagement-specific `InlineMessage` instead of the editor.

- [x] **Step 5: Run the focused test and verify it passes**

Run: `node --test tests/endorsementReviewNumber.test.ts`

Expected: all tests pass.

### Task 3: Document and verify the completed change

**Files:**
- Modify: `PROJECT_CONTEXT_REPORT.md`
- Modify: `docs/superpowers/specs/2026-09-02-endorsement-review-number-design.md`

**Interfaces:**
- Consumes: The verified service, context, and page behavior from Tasks 1 and 2.
- Produces: Durable documentation and a deployment-ready SPA build.

- [x] **Step 1: Record the Review No. rule under D-010**

Document the Completed-only selection, latest-date ordering, conditional
read-only behavior, and editable no-match fallback.

- [x] **Step 2: Mark the design implemented**

Set the design status to `Implemented; deployment pending`.

- [x] **Step 3: Run all Node tests**

Run: `node --test tests/*.test.ts`

Expected: all tests pass with zero failures.

- [x] **Step 4: Run the production build**

Run: `npm run build`

Expected: TypeScript and Vite complete successfully.

- [x] **Step 5: Review the scoped diff and working-tree status**

Run: `git diff --check -- src/shared/services/engagementService.ts src/components/letters/letterTemplates.ts src/pages/EndorsementLetterPage.tsx PROJECT_CONTEXT_REPORT.md`

Expected: exit code 0. Inspect the new untracked test/spec/plan files directly because ordinary `git diff` does not display them.

Commits are intentionally omitted because repository instructions require
explicit user authorization before committing.
