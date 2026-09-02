# Email Reference GUID Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent lifecycle notification emails from displaying a Dataverse request GUID as their Reference and omit the Reference row when no business review number exists.

**Architecture:** Keep the request GUID for internal Dataverse reads and request deep links. Map the user-facing `requestNumber` token only from `gcp_reviewno`, then make both mirrored email renderers omit field rows whose resolved values are empty so default and administrator-managed templates behave consistently.

**Tech Stack:** Azure Functions TypeScript, React SPA TypeScript, shared HTML email template model, Node built-in test runner.

## Global Constraints

- Never expose `gcp_requestid` as a user-facing email Reference.
- Use trimmed `gcp_reviewno` when it exists; otherwise use an empty `requestNumber` token.
- Omit field rows whose resolved value is empty in both send-side and admin-preview renderers.
- Retain the GUID for Dataverse lookup and the authenticated `View Request` deep link.
- Do not change Dataverse schema, permissions, recipient resolution, or notification events.
- Preserve unrelated dirty-tree changes.
- Do not commit, push, deploy, or restart without explicit user authorization.

---

### Task 1: Remove the GUID fallback from notification data

**Files:**
- Create: `api/src/email/requestReference.ts`
- Modify: `api/src/dataverse/requests.ts`
- Create: `tests/emailNotificationReference.test.ts`

**Interfaces:**
- Produces: `resolveEmailRequestNumber(reviewNumber: unknown): string`.
- Consumes: Dataverse `gcp_reviewno` from the existing request projection.
- Preserves: `recordId` use in the Dataverse URL and `viewLink`.

- [ ] **Step 1: Write the failing reference-mapping test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveEmailRequestNumber } from '../api/src/email/requestReference.ts';

test('uses only the trimmed business review number for email Reference', () => {
  assert.equal(resolveEmailRequestNumber('  RV-2026-0042  '), 'RV-2026-0042');
  assert.equal(resolveEmailRequestNumber(null), '');
  assert.equal(resolveEmailRequestNumber(undefined), '');
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/emailNotificationReference.test.ts`

Expected: FAIL because `api/src/email/requestReference.ts` does not exist.

- [ ] **Step 3: Implement the pure mapping and integrate it**

```ts
export const resolveEmailRequestNumber = (reviewNumber: unknown): string =>
  reviewNumber == null ? '' : String(reviewNumber).trim();
```

In `api/src/dataverse/requests.ts`, import the helper and replace:

```ts
requestNumber: s('gcp_reviewno') || recordId,
```

with:

```ts
requestNumber: resolveEmailRequestNumber(r.gcp_reviewno),
```

- [ ] **Step 4: Run the focused test and API compiler**

Run: `node --test tests/emailNotificationReference.test.ts`

Expected: PASS.

Run from `api/`: `npm run build`

Expected: exit 0.

### Task 2: Omit unresolved email field rows

**Files:**
- Modify: `api/src/email/renderTemplate.ts`
- Modify: `src/shared/emailTemplate/renderTemplate.ts`
- Modify: `tests/emailNotificationReference.test.ts`

**Interfaces:**
- Consumes: existing `{ type: 'fields'; rows: { label: string; value: string }[] }` blocks.
- Produces: identical send-side and preview HTML that excludes rows with an empty resolved value.

- [ ] **Step 1: Add failing renderer tests**

Import `renderEmailHtml` from both mirrored renderers. For each renderer, render:

```ts
const blocks = [{
  type: 'fields' as const,
  rows: [
    { label: 'Reference', value: '{{requestNumber}}' },
    { label: 'Request', value: '{{requestName}}' },
  ],
}];
const html = render(blocks, {
  requestNumber: '',
  requestName: 'Acceptance of Award',
});
```

Assert that the HTML does not contain `Reference`, does contain `Acceptance of Award`, and does not contain a supplied GUID. Add a second case proving `RV-2026-0042` and the Reference label render when `requestNumber` is non-empty.

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/emailNotificationReference.test.ts`

Expected: FAIL because both renderers currently emit the empty Reference row.

- [ ] **Step 3: Implement identical filtering in both renderers**

Resolve each label/value first, filter on `value.trim().length > 0`, then apply alternating row styling after filtering:

```ts
const rows = block.rows
  .map((row) => ({
    label: renderText(row.label, data),
    value: renderText(row.value, data),
  }))
  .filter((row) => row.value.trim().length > 0)
  .map((row, index) => fieldRow(row.label, row.value, index % 2 === 0))
  .join('');
```

Keep `api/src/email/renderTemplate.ts` and `src/shared/emailTemplate/renderTemplate.ts` byte-for-byte equivalent in field-block behavior.

- [ ] **Step 4: Run focused tests and both TypeScript builds**

Run: `node --test tests/emailNotificationReference.test.ts`

Expected: all focused tests PASS.

Run from repository root: `npx tsc --noEmit --pretty false`

Run from `api/`: `npm run build`

Expected: both exit 0.

### Task 3: Final verification and documentation status

**Files:**
- Modify: `docs/superpowers/specs/2026-09-01-email-reference-guid-removal-design.md`

**Interfaces:**
- Consumes: verified behavior from Tasks 1 and 2.
- Produces: design status `Implemented; deployment verification pending`.

- [ ] **Step 1: Run the complete root test suite**

```powershell
$testFiles = Get-ChildItem tests -Filter *.test.ts | ForEach-Object { $_.FullName }
node --test $testFiles
```

Expected: zero failures.

- [ ] **Step 2: Run production builds**

Run from repository root: `npm run build`

Run from `api/`: `npm run build`

Expected: both exit 0; existing SPA bundle-size warnings are non-blocking.

- [ ] **Step 3: Update the design status**

Change:

```md
**Status:** Approved; implementation pending
```

to:

```md
**Status:** Implemented; deployment verification pending
```

- [ ] **Step 4: Inspect only the scoped changes**

Run `git diff --check` for the files in this plan and inspect `git status --short`. Confirm that no unrelated dirty-tree change was overwritten. Do not deploy or commit.
