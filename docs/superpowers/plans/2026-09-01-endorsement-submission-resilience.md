# Endorsement Submission Resilience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make GCPC endorsement submission work for Endorser/Admin users, reject other roles and invalid statuses, reconcile uncertain PATCH responses, and never display an empty error.

**Architecture:** Keep the existing same-origin Power Pages Web API PATCH and existing `gcp_request` fields. Add a small pure policy/orchestration module consumed by routing, Request Detail, and the letter page; add Endorser to the existing request workflow-write metadata; and harden the shared Web API error fallback without changing Dataverse schema.

**Tech Stack:** React 18, TypeScript, React Router, Power Pages Web API, Power Pages enhanced metadata, Node's built-in test runner.

## Global Constraints

- Work directly in the existing checkout as authorized; preserve all unrelated dirty-tree changes.
- Do not create, rename, or modify Dataverse tables, columns, relationships, choice integers, or web-role GUIDs.
- Endorsement submission is authorized for Endorser and Administrator only.
- Accept source status Pending Endorse (`11`) and legacy Complete Acceptance (`8`) only; target status is Endorsed (`12`).
- Persist only `gcp_endorselettertextcontent`, `gcp_endorsementdate`, and `gcp_requeststatus`.
- Do not log tokens, letter contents, or request payloads.
- Do not commit, push, deploy, or restart the site without an explicit request.

---

### Task 1: Endorsement authorization and status policy

**Files:**
- Create: `src/shared/endorsementSubmission.ts`
- Create: `tests/endorsementSubmission.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/pages/RequestDetail.tsx`
- Modify: `src/pages/EndorsementLetterPage.tsx`

**Interfaces:**
- Produces: `ENDORSEMENT_ROUTE_ROLES: readonly ['Administrators', 'Endorser']`
- Produces: `canSubmitEndorsement(status, actor): boolean`
- Produces: `isEndorsementSourceStatus(status): boolean`
- Consumes: existing `RequireRole`, `hasRole`, and `isAdmin` helpers.

- [ ] **Step 1: Write failing policy tests**

Add table-driven tests with literal expectations:

```ts
test('allows Endorser or Administrator only at endorsement source statuses', () => {
  const cases = [
    { status: 11, actor: { isAdmin: false, isEndorser: true }, want: true },
    { status: 8, actor: { isAdmin: true, isEndorser: false }, want: true },
    { status: 11, actor: { isAdmin: false, isEndorser: false }, want: false },
    { status: 12, actor: { isAdmin: true, isEndorser: false }, want: false },
  ] as const;
  for (const item of cases) {
    assert.equal(canSubmitEndorsement(item.status, item.actor), item.want);
  }
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/endorsementSubmission.test.ts`

Expected: FAIL because the endorsement policy module/exports do not exist.

- [ ] **Step 3: Implement the minimal pure policy**

```ts
const ENDORSEMENT_ROUTE_ROLES = ['Administrators', 'Endorser'] as const;

type EndorsementActor = { isAdmin: boolean; isEndorser: boolean };

const isEndorsementSourceStatus = (status: number | null | undefined): boolean =>
  Number(status) === 11 || Number(status) === 8;

const canSubmitEndorsement = (
  status: number | null | undefined,
  actor: EndorsementActor,
): boolean =>
  isEndorsementSourceStatus(status) && (actor.isAdmin || actor.isEndorser);
```

- [ ] **Step 4: Apply the policy to all UI entry points**

- Wrap `/requests/:id/endorsement-letter` in `RequireRole` using
  `ENDORSEMENT_ROUTE_ROLES`.
- In Request Detail, replace Reviewer with Endorser for the GCPC endorsement
  action while retaining the separate GCP acknowledgement behavior.
- In `EndorsementLetterPage`, use `useAuth` loading state plus
  `canSubmitEndorsement(request.status, { isAdmin: isAdmin(), isEndorser:
  hasRole('Endorser') })` to fail closed before rendering submission controls.
- Display an explanatory warning and Back action for an invalid role/status.

- [ ] **Step 5: Run the policy test and TypeScript compiler**

Run: `node --test tests/endorsementSubmission.test.ts`

Expected: PASS.

Run: `npx tsc --noEmit --pretty false`

Expected: exit 0.

### Task 2: Endorser request-write metadata

**Files:**
- Modify: `.powerpages-site/table-permissions/Request-Reviewer-Verifier-Write.tablepermission.yml`
- Modify: `tests/endorsementSubmission.test.ts`

**Interfaces:**
- Consumes: Endorser GUID `712bfc10-3359-4685-8f1f-69cd1db4f91a`.
- Produces: deployment metadata granting Endorser global write on
  `gcp_request`, without changing the permission record ID or scope.

- [ ] **Step 1: Add a failing deployment-artifact test**

Parse the permission YAML as a deployment artifact and assert the effective
contract, not exact formatting:

```ts
assert.equal(readYamlScalar(permission, 'entitylogicalname'), 'gcp_request');
assert.equal(readYamlScalar(permission, 'write'), 'true');
assert.match(permission, /^- 712bfc10-3359-4685-8f1f-69cd1db4f91a$/m);
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/endorsementSubmission.test.ts`

Expected: FAIL because the Endorser GUID is absent from the workflow-write
permission.

- [ ] **Step 3: Add Endorser to the existing permission**

Append the verified Endorser GUID under `adx_entitypermission_webrole`. Keep:

```yaml
entitylogicalname: gcp_request
id: 4f2a9c1e-8b3d-4e67-a5f2-9c8d1e2f3a4b
scope: 756150000
write: true
```

Do not broaden Authenticated Users and do not modify unrelated child-table
permissions.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `node --test tests/endorsementSubmission.test.ts`

Expected: PASS.

### Task 3: Uncertain-response reconciliation and useful errors

**Files:**
- Modify: `src/shared/endorsementSubmission.ts`
- Modify: `src/shared/powerPagesApi.ts`
- Modify: `src/pages/EndorsementLetterPage.tsx`
- Modify: `tests/endorsementSubmission.test.ts`
- Create: `tests/powerPagesApiErrors.test.ts`

**Interfaces:**
- Produces: `submitEndorsementWithReconciliation(dependencies): Promise<'submitted' | 'reconciled'>`.
- Produces: `formatEndorsementSubmissionError(error): string`.
- Changes: `WebApiError.message` is always non-empty and contains available
  status/code context when the response provides no useful message.

- [ ] **Step 1: Write failing reconciliation tests**

Cover these literal outcomes:

```ts
assert.equal(
  await submitEndorsementWithReconciliation({
    submit: async () => { throw new TypeError('Failed to fetch'); },
    confirm: async () => true,
  }),
  'reconciled',
);

const permissionError = Object.assign(new Error('Forbidden'), { status: 403 });
await assert.rejects(
  submitEndorsementWithReconciliation({
    submit: async () => { throw permissionError; },
    confirm: async () => true,
  }),
  (error) => error === permissionError,
);
```

Also assert that an uncertain error is rethrown when `confirm()` returns false,
and that blank errors format as:
`The endorsement could not be submitted. Please try again.`

- [ ] **Step 2: Run reconciliation tests and verify RED**

Run: `node --test tests/endorsementSubmission.test.ts`

Expected: FAIL because reconciliation/error formatting exports do not exist.

- [ ] **Step 3: Implement minimal reconciliation**

```ts
const isUncertainSubmissionError = (error: unknown): boolean => {
  const status = typeof error === 'object' && error !== null &&
    'status' in error ? Number(error.status) : null;
  return status == null || status === 429 || status >= 500;
};

const submitEndorsementWithReconciliation = async ({ submit, confirm }) => {
  try {
    await submit();
    return 'submitted' as const;
  } catch (error) {
    if (!isUncertainSubmissionError(error) || !(await confirm())) throw error;
    return 'reconciled' as const;
  }
};
```

Implement the formatter by trimming `Error.message` and using the approved
fallback when it is empty.

- [ ] **Step 4: Write failing real Web API boundary tests**

Temporarily replace `globalThis.fetch`, return a valid anti-forgery-token
response followed by controlled failed `Response` objects, and call the real
`powerPagesFetch`. Assert:

- blank `403` response rejects with a non-empty permission message containing
  `HTTP 403`;
- JSON `{ "error": { "code": "X", "message": "Useful detail" } }`
  preserves `Useful detail`;
- blank `400` response contains `HTTP 400`.

Restore `globalThis.fetch` and invalidate the cached anti-forgery token in test
cleanup.

- [ ] **Step 5: Run Web API tests and verify RED**

Run: `node --test tests/powerPagesApiErrors.test.ts`

Expected: FAIL because blank responses currently create an empty message.

- [ ] **Step 6: Harden shared Web API error construction**

In both `powerPagesFetch` variants, derive the message in this order:

1. non-empty OData string message (including nested `{ value }` form);
2. safe non-HTML plain response text;
3. permission guidance plus `HTTP 403` for permission failures;
4. `Request failed (HTTP <status>[, code <code>]).`

Reuse one private helper so both fetch variants behave identically. Keep the
existing 401 message and 403 anti-forgery retry behavior.

- [ ] **Step 7: Integrate reconciliation into the page**

Replace the direct submit call with:

```ts
await submitEndorsementWithReconciliation({
  submit: () => submitEndorsementLetter(id, payload),
  confirm: () => pollRequestStatus(id, TARGET_STATUS),
});
```

Use `formatEndorsementSubmissionError(err)` in the catch branch. Continue to
navigate to Request Detail after either `submitted` or `reconciled` success.

- [ ] **Step 8: Run focused tests and TypeScript compilation**

Run: `node --test tests/endorsementSubmission.test.ts tests/powerPagesApiErrors.test.ts`

Expected: PASS.

Run: `npx tsc --noEmit --pretty false`

Expected: exit 0.

### Task 4: Durable documentation and final verification

**Files:**
- Modify: `PROJECT_CONTEXT_REPORT.md`
- Modify: `userguide.md`
- Modify: `docs/superpowers/specs/2026-09-01-endorsement-submission-resilience-design.md`

**Interfaces:**
- Consumes: final verified authorization, statuses, and error/reconciliation
  behavior from Tasks 1-3.
- Produces: repository and user documentation matching runtime behavior.

- [ ] **Step 1: Update documentation**

- Add a dated durable decision explaining Endorser/Admin ownership, the global
  Endorser request-write permission, status guard, and lost-response
  reconciliation.
- Update the user guide's Pending Endorse/action description and troubleshooting
  text.
- Change the design document status to `Implemented; runtime verification
  pending deployment` only after local verification succeeds.

- [ ] **Step 2: Run the complete Node test suite**

Run:

```powershell
$testFiles = Get-ChildItem tests -Filter *.test.ts | ForEach-Object { $_.FullName }
node --test $testFiles
```

Expected: all tests pass with zero failures.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: TypeScript and Vite exit 0. Existing bundle-size warnings are
non-blocking. If filesystem sandboxing blocks Vite/esbuild, rerun the identical
command with the required workspace permission.

- [ ] **Step 4: Inspect the scoped diff**

Run `git diff --check` against only the files listed in this plan, then inspect
`git status --short`. Confirm no unrelated change was overwritten and report
that deployment/runtime verification remains outstanding.
