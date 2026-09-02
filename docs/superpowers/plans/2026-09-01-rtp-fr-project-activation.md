# RTP FR Project Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activate an RTP request's related project when FR verification succeeds, while preserving all non-Inactive project statuses and providing a safe project-only retry after partial success.

**Architecture:** Add a pure orchestration boundary for Verify-page behavior and an ETag-aware conditional update in the existing project service. The request remains the first persisted operation; a local retry state prevents duplicate request/audit writes if project activation fails.

**Tech Stack:** React 18, strict TypeScript, Power Pages Web API, Dataverse OData ETags, Node's built-in test runner, Vite.

**Execution status:** Completed locally on 2026-09-01. Automated tests and the
production build pass; deployment and signed-in runtime verification remain
outstanding.

## Global Constraints

- RTP matter is `1`; FR request status is `0`.
- Project status values are Inactive `0`, Active `1`, Completed `2`, Dead `3`.
- Only Inactive may change to Active; every other value is preserved.
- Keep Dataverse CRUD in `src/shared/powerPagesApi.ts` and table services.
- Do not change Dataverse schema, logical names, entity-set names, relationships, or choice integers.
- Preserve unrelated dirty-tree changes.
- Do not commit, push, deploy, or restart a site without a separate explicit request.

---

### Task 1: Verification orchestration contract

**Files:**
- Create: `src/shared/rtpProjectActivation.ts`
- Create: `tests/rtpProjectActivation.test.ts`

**Interfaces:**
- Produces: `isRtpFrVerification(matter, targetStatus): boolean`
- Produces: `submitVerificationWithRtpProjectActivation(input, dependencies): Promise<void>`
- The orchestration validates and loads the project before the first request mutation, then verifies, confirms, and conditionally activates it.
- `verificationAlreadySaved = true` skips request verification and polling while retrying the project step.

- [ ] **Step 1: Write failing tests for trigger conditions, ordering, missing lookup, and retry mode**

Use call-order assertions to require `loadProject -> verifyRequest -> confirmRequest -> activateProject` for RTP/FR, and require only `verifyRequest -> confirmRequest` for other requests. Assert that retry mode runs `loadProject -> activateProject` and missing project data rejects before `verifyRequest`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/rtpProjectActivation.test.ts`

Expected: FAIL because `src/shared/rtpProjectActivation.ts` does not exist.

- [ ] **Step 3: Implement the minimal pure orchestration**

Implement exact RTP/FR checks, project-link validation, preflight loading, ordered request verification/confirmation, and retry-mode behavior using injected dependencies.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/rtpProjectActivation.test.ts`

Expected: PASS.

### Task 2: Conditional project activation service

**Files:**
- Modify: `src/types/project.ts`
- Modify: `src/shared/services/projectService.ts`
- Modify: `tests/rtpProjectActivation.test.ts`

**Interfaces:**
- Adds `PROJECT_STATUS.Dead = 3`.
- Adds `etag: string | null` to `GcpProject`.
- Produces: `activateProjectIfInactive(projectId, initialProject?): Promise<ProjectActivationResult>`.
- Uses exact observed ETags for updates and reevaluates once after HTTP `412`.

- [ ] **Step 1: Add failing tests for choice values and conditional activation outcomes**

Assert all four project status values. Assert Inactive issues one Active update, while Active, Completed, Dead, null, and unknown values perform no update. Assert a `412` reload that observes Completed preserves Completed without a second update.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/rtpProjectActivation.test.ts`

Expected: FAIL because Dead, ETag mapping, and conditional activation are absent.

- [ ] **Step 3: Implement minimal ETag-aware activation**

Read `gcp_projectstatus` and `@odata.etag`, PATCH only
`{ gcp_projectstatus: PROJECT_STATUS.Active }` with the observed ETag, and on
`412` reload/recheck once. Throw for a missing row, missing ETag on an Inactive
row, or a repeated update failure.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/rtpProjectActivation.test.ts`

Expected: PASS.

### Task 3: Verify-page integration and partial-success retry

**Files:**
- Modify: `src/pages/VerifyData.tsx`
- Modify: `tests/rtpProjectActivation.test.ts`

**Interfaces:**
- Consumes the orchestration function and `activateProjectIfInactive`.
- Adds local `verificationSaved` state.
- Uses partial-success error copy and changes the submit label to `Retry Project Activation` after project failure.

- [ ] **Step 1: Add a failing presentation-policy test**

Export and test a small pure function that returns the normal submit label/error prefix before request persistence and project-retry label/error prefix after request persistence.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/rtpProjectActivation.test.ts`

Expected: FAIL because retry presentation does not exist.

- [ ] **Step 3: Wire the orchestration into `VerifyData`**

Pass the loaded matter, project ID, target status, current retry state, existing
request verification/poll functions, project preflight, and conditional
activation. Set `verificationSaved` immediately after confirmed request save.
On activation failure, keep the page open and expose project-only retry. Notify
and navigate only after the full orchestration succeeds.

- [ ] **Step 4: Run focused tests and TypeScript compilation**

Run: `node --test tests/rtpProjectActivation.test.ts`

Expected: PASS.

Run: `npx tsc --noEmit --pretty false`

Expected: exit 0.

### Task 4: Documentation and final verification

**Files:**
- Modify: `mapping.md`
- Modify: `PROJECT_CONTEXT_REPORT.md`
- Modify: `docs/superpowers/specs/2026-09-01-rtp-fr-project-activation-design.md`

**Interfaces:**
- Documents the confirmed project status lifecycle and Verify-page behavior.

- [ ] **Step 1: Update durable documentation**

Document that RTP projects start Inactive and change to Active only after FR
verification, preserving Completed and Dead. Mark the design implemented only
after local verification succeeds.

- [ ] **Step 2: Run the complete Node test suite**

Run the repository's complete `tests/*.test.ts` set with Node's test runner.

Expected: zero failures.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: exit 0; existing Vite bundle-size warnings are non-blocking.

- [ ] **Step 4: Inspect the scoped diff and working tree**

Run `git diff --check` for the files in this plan and inspect
`git status --short`. Confirm unrelated changes remain intact and report that
deployment/runtime smoke testing remains outstanding.
