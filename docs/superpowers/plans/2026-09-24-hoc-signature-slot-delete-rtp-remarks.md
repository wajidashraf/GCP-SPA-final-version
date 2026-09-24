# HOC Signature Reuse, Slot Deletion, and RTP Remarks Implementation Plan

> **For Codex:** Follow test-driven development and verify each task before
> moving to the next one. Preserve all pre-existing worktree changes.

**Goal:** Reuse saved signatures safely on Review Acceptance, allow admins to
delete available or booked slots without deleting engagements, and rename the
RTP Project Description label to Remarks.

**Architecture:** Generalize the existing signature reuse service around a
contact-safe identity while retaining existing signature row conventions. Add
small Dataverse Web API service functions for engagement lookup clearing and
slot deletion, then orchestrate them from Slot Management with an explicit
confirmation modal. Add the narrow Power Pages delete permission required by
the admin-only UI.

**Tech stack:** React 18, strict TypeScript, Vite, Power Pages Web API,
Dataverse, React Bootstrap, lucide-react, Node test runner.

---

### Task 1: Generalize reusable signature identity

**Files:**
- Modify: `tests/signatureReuse.test.ts`
- Modify: `src/shared/services/signatureService.ts`

1. Add failing tests proving HOC lookup requires and uses contact identity,
   email signers retain the legacy email fallback, and repeated HOC confirmation
   is matched by contact plus marker.
2. Run `npm run test:signature-reuse` and confirm the new tests fail.
3. Replace the Working-GCPC-only validator with identity-aware normalization.
4. Make reusable queries contact-only for the `HOC` marker and preserve the
   existing contact-plus-legacy-email behavior for real email identities.
5. Make confirmation idempotency contact-aware for HOC while retaining email
   behavior for Working GCPC members.
6. Re-run the focused test.

### Task 2: Add saved-signature preview to Review Acceptance

**Files:**
- Modify: `src/components/acceptance/ReviewDecisionForm.tsx`
- Modify: `src/styles/requestDetail.css`
- Modify: `.powerpages-site/table-permissions/Signature-Signatory-Write.tablepermission.yml`
- Modify: `.powerpages-site/table-permissions/Request-HOC-Company-Read.tablepermission.yml`

1. Load the latest reusable signature when there is no current-request HOC
   signature and a valid current-user contact is available.
2. Render the preview with `Confirm Signature` and `Draw/Upload Different`
   actions, while keeping a current-request signature authoritative.
3. Confirm by creating a current-request HOC signature row through the shared
   idempotent service.
4. Surface reusable lookup and confirmation errors without blocking replacement
   signing.
5. Add the HOC role to the existing signature create permission and enable
   `appendto` on its company-scoped request permission so the lookup bind is
   authorized.

### Task 3: Add tested slot deletion services

**Files:**
- Create: `tests/slotDeletion.test.ts`
- Modify: `src/shared/services/engagementService.ts`
- Modify: `src/shared/services/slotService.ts`
- Modify: `package.json`

1. Add failing service tests for building the slot engagement query and for
   detach-delete orchestration, including abort and rollback behavior.
2. Run the focused test and confirm failure.
3. Add `listEngagementsBySlot`, `clearEngagementSlot`, and `deleteSlot` service
   operations using verified existing logical/navigation names.
4. Add a small injectable orchestration helper that detaches linked
   engagements, deletes the slot, and rebinds detached records if deletion
   fails.
5. Re-run the focused test.

### Task 4: Add administrator slot delete UI and permission

**Files:**
- Modify: `src/pages/SlotManagement.tsx`
- Modify: `src/styles/theme.css`
- Create: `.powerpages-site/table-permissions/Slot-Admin-Delete.tablepermission.yml`
- Modify/Create focused permission metadata test as appropriate.

1. Add a bottom-right card footer with a small accessible trash button.
2. Add a confirmation modal that distinguishes available from booked slots and
   explains that booked engagements are preserved.
3. Call the deletion orchestration, refresh the list, and show success/error
   feedback while preventing duplicate submissions.
4. Add an administrator-only delete permission without changing the existing
   Authenticated Users permission.
5. Verify the focused test.

### Task 5: Rename the RTP label

**Files:**
- Modify: `src/forms/rtp/RtpForm.tsx`
- Modify: `mapping.md`

1. Change only the visible label from `Project Description` to `Remarks`.
2. Update the mapping document label while preserving state and Dataverse
   logical names.

### Task 6: Verify

1. Run `npm run test:signature-reuse`.
2. Run the focused slot deletion test.
3. Run relevant existing tests for permissions and RTP behavior.
4. Run `npm run build`.
5. Review `git diff --check` and the scoped diff.
6. Report completed source and metadata changes, tests, and the requirement for
   signed-in deployed-site smoke testing. Do not deploy unless explicitly asked.
