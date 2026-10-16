# Restore Request Detail Layout Implementation Plan

**Goal:** Hide the recently added booking and saved-history panels on Request Detail while preserving requester/admin booking edits through the engagement form.

**Architecture:** Remove the page's Engagement Booking panel and RequestHistory integration, including the history-only fetch. Retain the booking lookup and Edit Booking navigation, the existing Pending Review signing workflow, and the current server-authorized booking transaction. Print uses only the remaining displayed record sections.

**Tech stack:** React 18, TypeScript, Vite, existing Node tests.

**Constraints:** Preserve pre-existing work, saved data, Dataverse schema, permissions, original requestor identity, status rules, and transactional old-slot release. No commit, push, or deployment in this local implementation. The signature clarification concerns the original Pending Review signing controls; the newly added history is to be hidden regardless.

## Tasks

- [x] Remove Engagement Booking and RequestHistory panels/imports from `src/pages/RequestDetail.tsx`.
- [x] Remove `useRequestHistory` and its print/reload/completion dependencies. Print readiness must depend only on displayed request data and existing review state.
- [x] Preserve Edit Booking, booking creation/rebooking guards, engagement form, server authorization, and slot reservation/release. Retain a compact booking-load error/retry so hidden panels do not strand booking actions on failed reads.
- [x] Record this change as superseding only the detail-page history presentation in `docs/request-history-booking-rollout-2026-10-15.md` and `PROJECT_CONTEXT_REPORT.md`.
- [x] Build the SPA and run the existing focused booking policy, history, and print tests. Review the incremental diff for unrelated changes. Use local browser fixtures if available; do not claim deployed-site runtime verification.

No new tests are needed for this reversible removal of presentation blocks; existing behavioral tests verify the retained booking and print helpers.

## Verification

`npm.cmd run build` passed after retrying outside the sandbox's filesystem restriction. Existing mixed-import and large-bundle warnings remain. The focused `engagementBookingPolicy`, `requestPrint`, `requestHistory`, and `requestDetailRecordFields` suite passed 29/29. `git diff --check` passed. Source review confirms no added booking/history panels or history hook remain in Request Detail, while Edit Booking, Pending Review signing, and letter workflow navigation remain. No browser or signed-in runtime test, deployment, commit, or push ran for this follow-up.

## Subsequent authorized deployment

The user subsequently authorized deployment to the exact GCP-Developer environment/site. A fresh build and target/model/manifest checks passed. PAC upload succeeded at 100%, 74/74 events, in 164.55 seconds. The subsequent restart/live-verification command was declined by the execution approval prompt before it ran. Upload is complete; restart, live bundle comparison, and signed-in verification remain pending. See the rollout record for evidence. No commit or push ran.
