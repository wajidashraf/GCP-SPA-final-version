# Incomplete Request Draft and Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect incomplete parent requests in batched child-table queries, display verified New orphans as Draft/Edit-only rows, and let authorized editors create the missing associated records under the existing parent.

**Architecture:** Pure integrity helpers define child sources and classifications; a Power Pages service performs chunked OData existence queries and the request hook attaches results without changing `GcpRequest`. Edit mode adds a repair purpose, hydrates each existing matter form from the parent plus empty child defaults, and reuses each form's established create mapping while skipping parent creation and patching only permitted parent fields afterward.

**Tech Stack:** React 18, strict TypeScript, Vite 5, Power Pages same-origin Web API, Node test runner.

## Global Constraints

- Do not create or modify Dataverse tables, columns, relationships, choice integers, navigation properties, or permissions.
- Use only entity-set and lookup names already verified in existing services/types.
- Draft is display-only; persisted `gcp_requeststatus` remains New (`1`).
- Repair never overwrites the original requestor, requestor email, or company.
- Repair must not read or write the new-request session draft.
- A failed child query is `unknown`, never `missing`.
- No deployment, restart, commit, or push without explicit user authorization.
- Preserve all unrelated pre-existing worktree changes.

---

### Task 1: Pure request-integrity model and classification

**Files:**
- Create: `src/shared/requestIntegrity.ts`
- Test: `tests/requestIntegrity.test.ts`

**Interfaces:**
- Produces: `RequestIntegrityState = 'complete' | 'missing' | 'unknown'`.
- Produces: `ChildKind` defined in `requestIntegrity.ts` and imported by `useRequestDetail`.
- Produces: `resolveChildKind(request: GcpRequest): ChildKind | null` as the single resolver used by detail and list paths.
- Produces: `chunkValues(values: readonly string[], size: number): string[][]`.
- Produces: `classifyIntegrity(request, visibleParentIds, failedKinds, pblBidderParentIds): RequestIntegrityState`.
- Produces: `hasRequiredAssociatedData(child: ChildData): boolean` for EditRequest and detail consumers.

- [ ] **Step 1: Write failing classification tests**

```ts
test('classifies only successfully queried New parents with no child as missing', () => {
  assert.equal(classifyIntegrity(newRequest, new Set(), new Set(), new Set()), 'missing');
  assert.equal(classifyIntegrity(reviewRequest, new Set(), new Set(), new Set()), 'unknown');
  assert.equal(classifyIntegrity(newRequest, new Set(), new Set(['caa']), new Set()), 'unknown');
});

test('requires a direct PBL child and at least one bidder', () => {
  assert.equal(classifyPblIntegrity(newRequest.id, pblChildMap, new Set()), 'missing');
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `node --test tests/requestIntegrity.test.ts`  
Expected: failure because `src/shared/requestIntegrity.ts` does not exist.

- [ ] **Step 3: Implement the pure registry/classification helpers**

```ts
type RequestIntegrityState = 'complete' | 'missing' | 'unknown';

const chunkValues = <T>(values: readonly T[], size: number): T[][] => {
  if (size < 1) throw new Error('Chunk size must be at least 1.');
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
};
```

Keep resolution exhaustive for SOA values `1` through `14`, including Others values `9` and `13`, and preserve the existing matter-code fallback.

- [ ] **Step 4: Run the focused tests**

Run: `node --test tests/requestIntegrity.test.ts`  
Expected: all integrity tests pass.

---

### Task 2: Batched Power Pages child-existence service

**Files:**
- Create: `src/shared/services/requestIntegrityService.ts`
- Modify: `src/shared/services/childRequestList.ts`
- Modify: each `src/shared/services/*RequestService.ts` only where an already verified entity-set constant must be exported.
- Test: `tests/requestIntegrity.test.ts`

**Interfaces:**
- Consumes: `resolveChildKind`, `chunkValues`, and `RequestIntegrityState` from Task 1.
- Produces: `checkRequestIntegrity(requests: readonly GcpRequest[]): Promise<Map<string, RequestIntegrityState>>`.
- Produces: `buildParentLookupFilter(field: string, ids: readonly string[]): string` for testable OData construction.
- Uses direct-parent field `_gcp_request_value` for every direct child except Others (`_gcp_requestlookup_value`).
- Uses PBL bidder field `_gcp_pblrequest_value`.

- [ ] **Step 1: Add failing query-construction tests**

```ts
test('builds a bounded OR filter from normalized parent GUIDs', () => {
  assert.equal(
    buildParentLookupFilter('_gcp_request_value', [ID_A, ID_B]),
    `_gcp_request_value eq '${ID_A}' or _gcp_request_value eq '${ID_B}'`,
  );
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --test tests/requestIntegrity.test.ts`  
Expected: failure because the batch service/helper is missing.

- [ ] **Step 3: Implement chunked lookup-only queries**

Use `buildODataQuery`, `escapeODataString`, `pageSizeHeader`, and `powerPagesFetch`. Query only the verified parent lookup field, with chunks of at most 20 parent IDs. Run matter groups independently with `Promise.allSettled`; mark only the rejected kind's requests `unknown`.

```ts
type IntegritySource = {
  kind: Exclude<ChildKind, 'unsupported'>;
  entitySet: string;
  parentField: '_gcp_request_value' | '_gcp_requestlookup_value';
};
```

For PBL, retain a child-ID-to-parent-ID map and query `gcp_pblbidderses` by `_gcp_pblrequest_value` before classifying PBL parents.

- [ ] **Step 4: Run integrity tests**

Run: `node --test tests/requestIntegrity.test.ts`  
Expected: query/filter/classification tests pass.

---

### Task 3: Request hook and Draft/Edit-only list presentation

**Files:**
- Create: `src/shared/requestListPresentation.ts`
- Modify: `src/shared/hooks/useRequests.ts`
- Modify: `src/pages/Requests.tsx`
- Modify: `src/styles/theme.css`
- Test: `tests/requestListPresentation.test.ts`
- Test: `tests/requestListState.test.ts`

**Interfaces:**
- Consumes: `checkRequestIntegrity` from Task 2.
- Produces from `useRequests`: `integrityById`, `isIntegrityLoading`, and `integrityWarning`.
- Produces: `getRequestRowPresentation(statusLabel, integrity)` returning `{ displayStatus, action, isClickable, isDisabled }`.

- [ ] **Step 1: Write failing presentation tests**

```ts
test('missing rows render Draft with Edit only and no row navigation', () => {
  assert.deepEqual(getRequestRowPresentation('New', 'missing'), {
    displayStatus: 'Draft',
    action: 'edit',
    isClickable: false,
    isDisabled: false,
  });
});

test('unknown rows disable actions rather than offering repair', () => {
  assert.equal(getRequestRowPresentation('New', 'unknown').isDisabled, true);
});
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `node --test tests/requestListPresentation.test.ts tests/requestListState.test.ts`  
Expected: the new presentation test fails because its module is missing; existing state tests remain passing.

- [ ] **Step 3: Implement hook integrity state**

After each `listRequests` page resolves, call `checkRequestIntegrity(result.items)`. Guard results with the hook's current load generation so stale list loads cannot overwrite newer filters/pages. When appending, merge both parent items and integrity maps.

- [ ] **Step 4: Implement list UI behavior**

Render a loading action placeholder until integrity is known. For `missing`, use a Draft pill and navigate the button directly to `/requests/${id}/edit`; do not attach the row click handler or clickable class. For `unknown`, show an `Unable to verify` pill/message and disable the action. Complete rows keep existing behavior.

- [ ] **Step 5: Run list tests**

Run: `node --test tests/requestListPresentation.test.ts tests/requestListState.test.ts`  
Expected: all list helper/state tests pass.

---

### Task 4: Repair policy, EditRequest routing, and shared parent repair write

**Files:**
- Create: `src/forms/repairRequest.ts`
- Modify: `src/shared/requestEditPolicy.ts`
- Modify: `src/forms/editRegistry.ts`
- Modify: `src/pages/EditRequest.tsx`
- Modify: `src/shared/hooks/useRequestDetail.ts`
- Test: `tests/requestEditPolicy.test.ts`
- Test: `tests/requestRepair.test.ts`

**Interfaces:**
- Extends: `EditPurpose = 'standard' | 'resubmission' | 'repair'`.
- Produces: `getEditSubmissionCopy('repair')` with `Complete Draft` copy.
- Produces: `updateRepairParent(requestId, state, { documents, projectId, projectDescription }): Promise<void>`.
- Produces: `assertStillMissing(request): Promise<void>` using the same integrity service as the list.
- EditRequest passes empty-record `ChildData` to the adapter with `editPurpose='repair'` only after a successful child load and status New.

- [ ] **Step 1: Add failing repair-purpose and parent-payload tests**

```ts
test('uses repair copy without resubmission semantics', () => {
  assert.equal(getEditSubmissionCopy('repair').submitLabel, 'Complete Draft');
});

test('repair parent payload excludes identity and workflow fields', () => {
  const payload = buildRepairParentPayload(state, documents);
  assert.equal('gcp_requestoremail' in payload, false);
  assert.equal('gcp_requeststatus' in payload, false);
});
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `node --test tests/requestEditPolicy.test.ts tests/requestRepair.test.ts`  
Expected: repair-purpose assertions fail before implementation.

- [ ] **Step 3: Implement repair purpose and route gating**

Derive repair only when `childError == null`, child data is supported, required associated data is missing, and parent status is `1`. Child errors and non-New missing data remain hard stops. Do not call `onResubmitted` for repair.

- [ ] **Step 4: Implement identity-safe parent repair payload**

```ts
type RepairParentState = {
  categoryValue: number;
  matterValue: number;
  projectName: string;
  projectCode?: string;
  acknowledged: boolean;
};
```

Patch category, matter, project name/code, acknowledgement, serialized documents, and the existing per-form project lookup only. RTP may additionally patch its existing project description field. Exclude requestor/company binds, status, outcome, submitted time, and RS timestamps.

- [ ] **Step 5: Run repair-policy tests**

Run: `node --test tests/requestEditPolicy.test.ts tests/requestRepair.test.ts`  
Expected: all repair policy/payload tests pass.

---

### Task 5: Direct-child repair support across all matter APIs and edit adapters

**Files:**
- Modify APIs: `src/forms/{rtp,pbl,jvp,stsp,caa,pcca,pp,vap,others,rpcca,rpp,ci,cpr}/api.ts`
- Modify adapters: `src/forms/{rtp,pbl,jvp,stsp,caa,pcca,pp,vap,others,rpcca,rpp,ci,cpr}/*EditForm.tsx`
- Test: `tests/requestRepair.test.ts`

**Interfaces:**
- Each submit option type gains `existingRequestId?: string | null`.
- RTP additionally gains `existingProjectId?: string | null` and skips stub-project creation when repairing.
- Each submit function sets `parentId` to `existingRequestId` in repair mode; otherwise it preserves the current parent-create path.
- After all required child/grandchild writes, repair calls `updateRepairParent`.
- Each `loadXFormState` accepts a nullable child and returns parent identity plus canonical empty child fields when absent.

- [ ] **Step 1: Add failing pure repair-decision tests**

```ts
test('direct-child repair reuses the existing parent', () => {
  assert.equal(resolveParentWrite({ existingRequestId: REQUEST_ID }).mode, 'reuse');
});

test('normal submission still creates a parent', () => {
  assert.equal(resolveParentWrite({ existingRequestId: null }).mode, 'create');
});
```

- [ ] **Step 2: Run focused repair tests and confirm failure**

Run: `node --test tests/requestRepair.test.ts`  
Expected: failure until reuse/create selection is implemented.

- [ ] **Step 3: Implement API parent reuse**

When `existingRequestId` is present, skip `createRequest`, create the child with `requestId: existingRequestId`, then call `updateRepairParent`. Preserve every current new-submission branch byte-for-byte where possible.

- [ ] **Step 4: Implement nullable child hydration**

Update each `loadXFormState` to use `child?.field ?? canonicalDefault`. Common fields always come from the parent. Preserve non-empty canonical defaults such as CPR EOT status `1` and VO status `2`.

- [ ] **Step 5: Implement adapter repair branches**

Each adapter computes `hasChild`, hydrates even when false, and selects:

```ts
if (editPurpose === 'repair') {
  await assertStillMissing(request);
  await submitXRequest(state, {
    existingRequestId: request.id,
    documents,
  });
} else {
  await updateXRequestFromState(state, existingUpdateOptions);
}
```

Pass the original request's project ID where required. Do not invoke `onResubmitted` for repair.

- [ ] **Step 6: Run repair tests and TypeScript build**

Run: `node --test tests/requestRepair.test.ts tests/requestEditPolicy.test.ts`  
Run: `npm run build`  
Expected: tests pass and strict TypeScript compiles all matter adapters.

---

### Task 6: PBL missing-bidder repair without duplicate direct child

**Files:**
- Modify: `src/forms/pbl/api.ts`
- Modify: `src/forms/pbl/PblEditForm.tsx`
- Modify: `src/shared/requestIntegrity.ts`
- Test: `tests/requestIntegrity.test.ts`
- Test: `tests/requestRepair.test.ts`

**Interfaces:**
- PBL adapter distinguishes `direct child missing` from `direct child exists but bidders missing`.
- Missing direct child uses `submitPblRequest(..., { existingRequestId })`.
- Existing direct child/missing bidders uses `updatePblRequestFromState` with the empty loaded bidder baseline, creating bidders but not another PBL child.

- [ ] **Step 1: Add failing PBL path-selection tests**

```ts
test('repairs missing bidders through update instead of direct-child create', () => {
  assert.equal(selectPblRepairPath({ childCount: 1, bidderCount: 0 }), 'add-bidders');
  assert.equal(selectPblRepairPath({ childCount: 0, bidderCount: 0 }), 'create-child');
});
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `node --test tests/requestIntegrity.test.ts tests/requestRepair.test.ts`  
Expected: missing path-selection helper/test fails.

- [ ] **Step 3: Implement PBL branch and bidder preflight**

Before adding bidders, re-query the PBL child and bidder rows. Abort if bidders now exist. Use the existing bidder create payload and lookup mapping; do not duplicate logical names.

- [ ] **Step 4: Run focused tests**

Run: `node --test tests/requestIntegrity.test.ts tests/requestRepair.test.ts`  
Expected: all PBL integrity/repair cases pass.

---

### Task 7: Documentation and final verification

**Files:**
- Modify: `PROJECT_CONTEXT_REPORT.md`
- Modify: `docs/edit-mode-rollout.md`
- Modify: `userguide.md`
- Verify: all touched files and worktree status

**Interfaces:**
- Documents Draft as a derived client-side integrity state, not a Dataverse choice.
- Documents repair authorization, New-only scope, child batching, and PBL bidder rule.

- [ ] **Step 1: Update durable architecture and rollout documentation**

Record the integrity service, Draft/Edit-only behavior, repair parent reuse, identity guarantees, and runtime smoke-test requirement. Do not change `mapping.md` because no confirmed Dataverse-to-form mapping changes.

- [ ] **Step 2: Run every focused test**

Run:

```powershell
node --test tests/requestIntegrity.test.ts tests/requestListPresentation.test.ts tests/requestListState.test.ts tests/requestEditPolicy.test.ts tests/requestRepair.test.ts
```

Expected: zero failed tests.

- [ ] **Step 3: Run production build**

Run: `npm run build`  
Expected: exit code `0`; the existing bundle-size warning is non-blocking.

- [ ] **Step 4: Validate the final diff**

Run:

```powershell
git diff --check
git status --short
```

Confirm no unrelated pre-existing changes were overwritten and no generated deployment assets are claimed as deployed.

- [ ] **Step 5: Report runtime limitation**

State that local verification cannot prove Power Pages table permissions or live Dataverse behavior. Do not deploy until explicitly authorized; if authorized later, follow the mandatory PAC upload checklist and test requestor/admin roles in GCP-Developer.
