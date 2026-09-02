# HOC Acceptance Unified Conclusion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the HOC acceptance Code 1(a)/1(b) choices with one explicitly selected, unlabeled statement while preserving the existing Dataverse schema.

**Architecture:** Put selectable conclusion copy and legacy-value normalization in a pure module next to the acceptance form. Put the Dataverse acceptance PATCH mapping in a separate pure shared module, then make `ReviewDecisionForm` and `requestService` consume those tested interfaces.

**Tech Stack:** React 18, TypeScript, Vite, Node's built-in test runner, Power Pages Web API, Dataverse.

## Global Constraints

- The exact unified statement is `We accept the summary review conclusion code and we agree to incorporate`.
- The unified statement remains an explicit radio selection and persists as existing Code 1(a).
- Historical Code 1(b) records render the unified statement without rewriting Dataverse merely because they were viewed.
- Code 1(b) wording, exception inputs, validation, payload input, and read-only exception display are removed.
- Decision Code 2 and Code 3 behavior remains unchanged.
- Do not change Dataverse tables, columns, logical names, relationships, or choice integers.
- Preserve the user's pre-existing edit to `.powerpages-site/web-files/index-BnaqI9B1.js/index-BnaqI9B1.js`.
- Do not regenerate checked-in `.powerpages-site/web-files` or deploy, commit, restart, or push unless the user separately authorizes it.

---

## File Structure

- Create `src/components/acceptance/hocAcceptanceConclusions.ts`: canonical HOC conclusion options and legacy stored-value normalization.
- Create `src/shared/acceptReviewPayload.ts`: typed, pure Dataverse field mapping for HOC acceptance submission.
- Create `tests/hocAcceptanceConclusions.test.ts`: conclusion copy, filtering, and legacy normalization tests.
- Create `tests/acceptReviewPayload.test.ts`: Code 1(a), Code 2, and Code 3 Dataverse payload tests.
- Modify `src/components/acceptance/ReviewDecisionForm.tsx`: consume tested conclusion behavior and remove Code 1(b) UI/state.
- Modify `src/shared/services/requestService.ts`: consume the tested payload mapper.
- Modify `src/styles/requestDetail.css`: remove unused Code 1(b) exception styles.
- Modify `package.json`: add a focused HOC acceptance test command.
- Modify `userguide.md`: document the single Decision Code 1 conclusion.

### Task 1: Define conclusion presentation and legacy normalization

**Files:**
- Create: `tests/hocAcceptanceConclusions.test.ts`
- Create: `src/components/acceptance/hocAcceptanceConclusions.ts`

**Interfaces:**
- Produces: `HocAcceptanceCode = '1a' | '2' | '3'`.
- Produces: `HocAcceptanceOption = { value: HocAcceptanceCode; label: string | null; description: string }`.
- Produces: `UNIFIED_CODE_ONE_STATEMENT` with the exact approved text.
- Produces: `getHocAcceptanceOptions(reviewDecisionCode: number | null): readonly HocAcceptanceOption[]`.
- Produces: `deriveHocAcceptanceCode(flags: StoredConclusionFlags): HocAcceptanceCode | ''`.

- [ ] **Step 1: Write the failing conclusion tests**

```ts
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
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/hocAcceptanceConclusions.test.ts`

Expected: FAIL because `hocAcceptanceConclusions.ts` does not exist.

- [ ] **Step 3: Implement the minimal pure conclusion module**

```ts
type HocAcceptanceCode = '1a' | '2' | '3';

type HocAcceptanceOption = {
  value: HocAcceptanceCode;
  label: string | null;
  description: string;
};

type StoredConclusionFlags = {
  reviewCode1a?: boolean | null;
  reviewCode1b?: boolean | null;
  reviewCode2?: boolean | null;
  reviewCode3?: boolean | null;
};

const UNIFIED_CODE_ONE_STATEMENT =
  'We accept the summary review conclusion code and we agree to incorporate';

const unifiedCodeOneOption: HocAcceptanceOption = {
  value: '1a',
  label: null,
  description: UNIFIED_CODE_ONE_STATEMENT,
};

const remainingCodeOptions: readonly HocAcceptanceOption[] = [
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
];

const getHocAcceptanceOptions = (
  reviewDecisionCode: number | null,
): readonly HocAcceptanceOption[] =>
  reviewDecisionCode === 1 ? [unifiedCodeOneOption] : remainingCodeOptions;

const deriveHocAcceptanceCode = (
  flags: StoredConclusionFlags,
): HocAcceptanceCode | '' => {
  if (flags.reviewCode1a || flags.reviewCode1b) return '1a';
  if (flags.reviewCode2) return '2';
  if (flags.reviewCode3) return '3';
  return '';
};

export {
  UNIFIED_CODE_ONE_STATEMENT,
  deriveHocAcceptanceCode,
  getHocAcceptanceOptions,
};
export type {
  HocAcceptanceCode,
  HocAcceptanceOption,
  StoredConclusionFlags,
};
```

- [ ] **Step 4: Run the conclusion tests and verify GREEN**

Run: `node --test tests/hocAcceptanceConclusions.test.ts`

Expected: 3 tests PASS.

- [ ] **Step 5: Review the task diff without committing**

Run: `git diff -- tests/hocAcceptanceConclusions.test.ts src/components/acceptance/hocAcceptanceConclusions.ts`

Expected: only the new test and conclusion module are present. Do not commit without explicit user authorization.

### Task 2: Restrict and test the Dataverse acceptance payload

**Files:**
- Create: `tests/acceptReviewPayload.test.ts`
- Create: `src/shared/acceptReviewPayload.ts`
- Modify: `src/shared/services/requestService.ts:550-578`

**Interfaces:**
- Produces: `AcceptReviewCode = '1a' | '2' | '3'`.
- Produces: `AcceptReviewInput = { code: AcceptReviewCode; targetStatus?: number }`.
- Produces: `buildAcceptReviewPayload(input: AcceptReviewInput, acceptanceDate: string): Record<string, unknown>`.
- `requestService.acceptReview(id, input)` continues to be the component-facing async service.

- [ ] **Step 1: Write the failing payload tests**

```ts
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
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/acceptReviewPayload.test.ts`

Expected: FAIL because `acceptReviewPayload.ts` does not exist.

- [ ] **Step 3: Implement the pure payload mapper**

```ts
type AcceptReviewCode = '1a' | '2' | '3';

type AcceptReviewInput = {
  code: AcceptReviewCode;
  targetStatus?: number;
};

const buildAcceptReviewPayload = (
  input: AcceptReviewInput,
  acceptanceDate: string,
): Record<string, unknown> => ({
  gcp_reviewconclusioncode1a: input.code === '1a',
  gcp_reviewconclusioncode1b: false,
  gcp_reviewconclusioncode2: input.code === '2',
  gcp_reviewconclusioncode3: input.code === '3',
  gcp_reviewconclusioncode1bcomment: '',
  gcp_acceptancedate: acceptanceDate,
  gcp_requeststatus: input.targetStatus ?? 8,
});

export { buildAcceptReviewPayload };
export type { AcceptReviewCode, AcceptReviewInput };
```

- [ ] **Step 4: Replace the inline service mapping**

At the top of `requestService.ts`, import:

```ts
import {
  buildAcceptReviewPayload,
} from '../acceptReviewPayload';
import type { AcceptReviewInput } from '../acceptReviewPayload';
```

Delete the local `AcceptReviewInput` definition and replace the `body` object in `acceptReview` with:

```ts
const body = buildAcceptReviewPayload(input, currentMalaysiaDate());
```

Keep the existing `AcceptReviewInput` type re-export so external imports remain stable.

- [ ] **Step 5: Run the payload tests and verify GREEN**

Run: `node --test tests/acceptReviewPayload.test.ts`

Expected: 2 tests PASS.

- [ ] **Step 6: Review the task diff without committing**

Run: `git diff -- tests/acceptReviewPayload.test.ts src/shared/acceptReviewPayload.ts src/shared/services/requestService.ts`

Expected: Code 1(b) is no longer accepted as a submission input, while its Dataverse boolean and comment fields are explicitly cleared on new submission. Do not commit without explicit user authorization.

### Task 3: Integrate the unified option into the HOC form and documentation

**Files:**
- Modify: `src/components/acceptance/ReviewDecisionForm.tsx`
- Modify: `src/styles/requestDetail.css:1958-2012`
- Modify: `package.json`
- Modify: `userguide.md:308-328`

**Interfaces:**
- Consumes: `HocAcceptanceCode`, `deriveHocAcceptanceCode`, and `getHocAcceptanceOptions` from Task 1.
- Consumes: narrowed `acceptReview(id, { code, targetStatus })` from Task 2.

- [ ] **Step 1: Replace inline conclusion definitions and derivation**

Import the Task 1 interfaces:

```ts
import {
  deriveHocAcceptanceCode,
  getHocAcceptanceOptions,
} from './hocAcceptanceConclusions';
import type { HocAcceptanceCode } from './hocAcceptanceConclusions';
```

Delete the local `ConclusionCode`, `CODE_OPTIONS`, and filter logic. Define:

```ts
const visibleCodeOptions = getHocAcceptanceOptions(request?.decisionCode ?? null);
```

Initialize `selectedCode` as `HocAcceptanceCode | ''`, and derive loaded values with:

```ts
const code = deriveHocAcceptanceCode(request);
```

This deliberately maps both historical Code 1(a) and Code 1(b) flags to the unified Code 1(a) presentation.

- [ ] **Step 2: Remove Code 1(b) state and behavior**

Delete:

- the `exceptions` state;
- the effect that parses `reviewCode1bComment`;
- Code 1(b) exception validation;
- construction and transmission of `code1bComment`;
- editable exception inputs;
- read-only historical exception display.

Guard confirmation against an empty selection, then submit only:

```ts
if (!id || targetStatus == null || !selectedCode) return;
await acceptReview(id, { code: selectedCode, targetStatus });
```

- [ ] **Step 3: Render no badge for the unified option**

Render a badge only when a label exists:

```tsx
{opt.label ? <span className="hoc-code-badge">{opt.label}</span> : null}
<span className="hoc-code-desc">{opt.description}</span>
```

Set the confirmation summary to the statement:

```tsx
<dd>{selectedOption?.description ?? 'â€”'}</dd>
```

Update the signature declaration to:

```tsx
By submitting this document, the signatory confirms that the selected conclusion
accurately represents the company's acceptance of the Summary Review.
```

- [ ] **Step 4: Remove dead exception styling**

Delete the `.hoc-exceptions`, `.hoc-exceptions--locked`, `.hoc-exceptions-label`, `.hoc-exception-row`, `.hoc-exception-num`, `.hoc-exception-input`, `.hoc-exception-input:focus`, and `.hoc-exceptions-list` rules from `src/styles/requestDetail.css`.

- [ ] **Step 5: Add the focused test command and update the user guide**

Add this `package.json` script:

```json
"test:hoc-acceptance": "node --test tests/hocAcceptanceConclusions.test.ts tests/acceptReviewPayload.test.ts"
```

Replace the first two HOC acceptance instructions in `userguide.md` with:

```md
1. Select the displayed conclusion. For a Code 1 review, the form presents one
   unified acceptance statement; otherwise it presents Code 2 or Code 3.
2. Draw a signature or upload a valid PNG/JPEG image of 5 MB or less.
3. Review the image preview, then save the signature.
4. Click **Submit Signed Acceptance** and confirm the irreversible action.
```

- [ ] **Step 6: Run all focused tests**

Run: `npm run test:hoc-acceptance`

Expected: 5 tests PASS.

Run: `node --test tests/requestEditPolicy.test.ts tests/reviewComments.test.ts tests/dashboardPipeline.test.ts`

Expected: all existing focused tests PASS.

- [ ] **Step 7: Run the SPA production build**

Run: `npm run build`

Expected: TypeScript and Vite complete successfully. The existing chunk-size warning is non-blocking.

- [ ] **Step 8: Verify copy removal and preserved work**

Run:

```powershell
rg -n "Code 1 \(a\)|Code 1 \(b\)|EXCEPT the following|Exceptions / Mitigations" src userguide.md
git status --short
```

Expected: none of the removed Code 1(a)/1(b) UI wording or exception UI remains in authored source/documentation. Git status still lists the user's pre-existing modified Power Pages bundle, the approved spec/plan, and the intended source/test/documentation changes.

- [ ] **Step 9: Stop before external actions**

Do not update checked-in Power Pages bundles, deploy, restart, commit, or push. Report that a signed-in development-site smoke test is still required after any separately authorized deployment.
