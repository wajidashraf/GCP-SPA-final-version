# Request history, print, and booking implementation plan

> **For agentic workers:** Use the dispatching-parallel-agents skill for the independent file groups below; integrate and review the combined result before completion. The original implementation scope excluded deployment. The user subsequently authorized the development deployment and explicitly approved publishing the shared Function backend; both completed on 2026-10-15. Signed-in runtime verification remains pending. See the rollout record.

**Goal:** Implement the six approved changes with safe rescheduling that releases the previous slot.
**Architecture:** Retain React/Vite, same-origin typed read services, and existing Dataverse records. Use a portal-token authenticated Azure Function for transactional booking mutations; render persisted request history and print the same accessible content.
**Tech Stack:** React 18, strict TypeScript, Vite, Azure Functions, Dataverse Web API, existing Node test runner.

## Global constraints

- Dataverse is externally owned; no table, column, relationship, choice, or existing web-role GUID changes.
- Preserve request identity, review actions, existing approval flow, and status R (`3`) on reschedule.
- Only the original requester or site administrator may reschedule, including direct endpoint requests.
- Reserve the new slot, update the existing engagement, and release the old slot atomically. Failed changes preserve the old booking.
- No duplicate booking, silent release failure, blind non-idempotent retry, or new client token storage.
- Reuse existing UI/fields/design; no dependency upgrades or framework changes.
- Original implementation constraint: no commits, pushes, deployments, or site restarts. Later explicit authorization covered the shared Function publish and dev site upload/restart; no feature commit/push or production site deployment ran.
- Approved design: `docs/superpowers/specs/2026-10-15-request-history-print-booking-design.md`.

## Task 1 — Authorized transactional booking backend

**Files:** `api/src/functions/engagementBooking.ts`, `api/src/dataverse/engagementBooking.ts`, `api/src/dataverse/dataverseBatch.ts`, `api/src/dataverse/dataverseClient.ts`, `api/tests/engagementBooking.test.mjs`, `api/package.json`.

**Interface:** POST `/api/engagementBookings`, JSON `{ action: 'create' | 'reschedule' | 'cancel', requestId: string, engagementId?: string, slotId?: string, name?: string, type?: number, location?: string | null, operationId?: string }`. Successful response `{ ok: true, engagementId: string, slotId: string | null, previousSlotId: string | null }`; errors `{ ok: false, error: string }` with meaningful HTTP status. Derive all ownership, role, request, slot dates, attendee, and number values server-side. Require a validated portal contact and site mapping.

- [x] Write failing behavioral tests with injected Dataverse IO: owner/admin success; non-owner Reviewer/Verifier denial; missing site/identity; binding/status failures; taken/new-slot race; same-slot edit; old-slot release; failed operation response; uncertain response reconciliation; deterministic operation ID for create; duplicate scheduled rows; cancellation timing policy.
- [x] Run `npm.cmd run build` in `api`, then `node --test api/tests/engagementBooking.test.mjs` from root and confirm the initial expected failures.
- [x] Implement pure booking orchestration with explicit input validation and record ETags. Use one Dataverse changeset and check every nested HTTP status; fail closed on malformed response. No app-credential historical record endpoint.
- [x] Authenticate with existing `validateToken` and `runForPortal`; obtain site-scoped admin roles, derive contact from token. Reconcile uncertain writes by expected record and reservation state without creating another booking.
- [x] Rebuild API and run covering tests. Report test evidence and exact changed files.

Example behavioral assertion:
```js
assert.deepEqual(transaction.map(x => x.path), [
  `gcp_slots(${newSlotId})`, `gcp_engagementses(${engagementId})`,
  `gcp_slots(${oldSlotId})`, `gcp_requests(${requestId})`,
]);
assert.equal(transaction[2].body.gcp_slotstatus, SLOT_STATUS_AVAILABLE);
```
Use verified `slotChoices.ts` constants. All operation results must succeed as a group.

## Task 2 — Forms and status presentation

**Files:** `src/forms/rtp/RtpForm.tsx`, `src/forms/stsp/StspForm.tsx`, `src/shared/requestStatusPresentation.ts`, `src/pages/Requests.tsx`, `mapping.md`, `tests/requestStatusPresentation.test.ts`.
**Interface:** Export `getRequestStatusDisplayLabel(status: number | null | undefined): string` and `requestStatusFilterOptions` derived from canonical choices. Preserve values and use display labels without changing workflow comparisons.

- [x] Test descriptive label/value mappings, unknown values, and unchanged canonical choices with `node --test tests/requestStatusPresentation.test.ts`.
- [x] Set the exact approved RTP placeholders in the existing controls; preserve labels/validation/step position.
- [x] Move the entire STSP PIC step with its validator before Project Details. Update mapping step numbering only.
- [x] Apply shared status display to filter and list rows while leaving status classes and predicates canonical.
- [x] Run covering tests and TypeScript verification; report exact form order and unchanged payload mapping.

## Task 3 — Saved history, pagination, and print primitives

**Files:** New `src/components/detail/RequestHistory.tsx`, `src/shared/hooks/useRequestHistory.ts`, `src/shared/requestHistory.ts`, `src/shared/requestPrint.ts`, `src/styles/requestPrint.css`; modify `src/components/detail/DetailSection.tsx`, `src/shared/services/signatureService.ts`, `src/components/letters/letterPersistence.ts`, `src/shared/hooks/useRequestDetail.ts`; tests `tests/requestHistory.test.ts`, `tests/requestPrint.test.ts`.

**Interfaces:**
```ts
useRequestHistory(requestId: string | null | undefined): {
  signatures: GcpSignature[]; isLoading: boolean; error: string | null;
  refetch: () => Promise<void>;
};
// exported named component, no RequestDetail integration in this task:
RequestHistory({ request, signatures, isLoading, error, onRetry });
// read saved body faithfully, strip only validated known metadata suffix:
extractStoredLetterText(raw: string | null | undefined): string;
// identify all historical signature <img> with data-request-signature:
printRequestRecord(root: HTMLElement, print?: () => void): Promise<void>;
```

- [x] Test V2/legacy/plain-text extraction, malformed metadata preservation, acceptance evidence/legacy flags, signature event identity, and image load/error handling before implementation.
- [x] Keep signature reads same-origin and request-scoped, with full pagination; retain all saved signer events independently of current roster. Resolve HOC as stored evidence without inferring submit actor or selected signature.
- [x] Render signatures, saved acceptance facts with the historical snapshot limitation, and exact saved letter bodies/dates in required order as read-only sections. Handle per-section load errors and omit empty forms.
- [x] Follow all child/bidder pages in the detail hook, with same-origin nextLink handling. Never edit the parent/history as part of loading.
- [x] Keep collapsed DetailSection bodies mounted with accessible hidden semantics; print CSS expands them, hides site chrome/actions, wraps content, avoids table/image clipping, and supports multiple pages.
- [x] Print helper waits for marked images; reject inaccessible images and expose retry rather than silently omitting signatures. Use existing image direct-download conventions.
- [x] Run focused tests and SPA TypeScript check. Root agent integrates component/print imports and request header actions later.

## Task 4 — Booking frontend, security metadata, and detail integration

**Files:** New `src/shared/engagementBookingApi.ts`, `src/shared/engagementBookingPolicy.ts`; modify `src/pages/Engagement.tsx`, `src/components/engagements/EditEngagementModal.tsx`, `src/pages/EngagementManagement.tsx`, `src/shared/services/engagementService.ts`, `src/shared/services/slotService.ts`, `src/pages/RequestDetail.tsx`; relevant existing permission YAML plus verified administrator metadata; tests `tests/engagementBookingPolicy.test.ts`, `tests/engagementBookingPermissions.test.ts`.

- [x] Write failing policy tests: loaded owner/admin at R can edit; other users/statuses cannot; case-insensitive contact GUID; original requester retained under multi-role membership.
- [x] Add non-retrying token-authenticated booking client matching Task 1. Use existing Function base URL/token helpers and actionable error messages.
- [x] Reuse booking form for creation/edit; prefill saved scheduled engagement and current slot, allow available choices, preserve number/creator and request data, call transactional service for create/reschedule/cancel, refresh after success.
- [x] Migrate admin edit/cancel to same safe booking service. Do not silently ignore release failures.
- [x] Remove Authenticated Users direct engagement/slot mutation grants; keep reads. Grant verified existing administrator role the CRUD/Append/Append To needed for slot management and deletion detach/restore, with no ordinary-user write bypass.
- [x] In Request Detail, add booking summary and owner/admin Edit Booking at R, preserving comments/review actions; add saved history below existing review, add owner/admin Print with data/image readiness and retry error handling. Include saved RTP Remarks.
- [x] Apply shared status display helper to detail without changing predicates. Mark controls/chrome no-print; import print CSS.
- [x] Run policy/permission tests, inspect frontend/backend contract alignment, and check all remaining direct booking mutation call sites.

## Task 5 — Review, verification, and documentation

- [x] Run all root `tests/*.test.ts`, API build/tests, SPA build, and `git diff --check` on the integrated tree.
- [x] Use browser fixtures where needed to verify desktop/mobile layouts, same-slot/current-slot prefill, complete history, collapse/print expansion, multiple pages, signature image failure, and controls hidden during print. Keep fixtures out of product flow.
- [x] Obtain independent read-only review of transaction/authorization and integrated UI/data behavior; resolve material findings and rerun covering checks.
- [x] Update context/rollout documentation with backend/site deployment dependency and signed-in GCP-Developer smoke-test matrix. Preserve existing security caveats and acceptance storage limitations.
- [x] Report all six requirements, files, testing, no schema changes, deployment dependency, and unverified live behavior. Leave work local on the feature branch.

## Execution record

- Baseline: 142 existing root tests passed on `03681c9`.
- Local feature branch: `feature/request-history-print-rescheduling`.
- Current status: all tasks implemented and locally verified. Root suite 178/178 and API suite 77/77 pass; browser fixtures and independent reviews completed, including the final detached-slot cancellation compatibility fix. See docs/request-history-booking-rollout-2026-10-15.md for evidence and remaining deployed smoke tests.
- Subsequent authorized deployment: shared Function publish, dev SPA/permissions upload, and dev restart completed on 2026-10-15. Deployed bundle bytes and permission union match the approved build/design. The isolated test browser remained at sign-in; the user chose to finish with deployment checks only, so authenticated workflow verification was skipped.
