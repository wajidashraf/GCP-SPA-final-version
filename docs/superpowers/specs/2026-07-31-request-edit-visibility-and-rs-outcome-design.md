# Request edit visibility and RS outcome design

**Date:** 2026-07-31  
**Status:** Approved for implementation  
**Scope:** All 13 request form codes / 14 Dataverse matter values

## Goal

Allow authorized users to edit requests only while the request is in one of
these active correction states:

- New (`gcp_requeststatus = 1`)
- R (`gcp_requeststatus = 3`)
- RS (`gcp_requeststatus = 16`)

Editing must be hidden and direct edit URLs must be rejected for every other
status. Reviewer decisions Code 1, Code 3, Code 4, and W move the request out of
the editable statuses. Reviewer Code 2 and Verifier RS both establish the RS
correction cycle.

## Authorized editors

The following users may edit while the request is in an editable status:

- the original Requestor/contact bound to the request;
- Verifier;
- Reviewer;
- Administrator.

The Requestor rule means the original owner of the request, not every user who
has the Requestor web role.

UI visibility is not the security boundary. Existing Dataverse table
permissions remain authoritative.

## Shared edit policy

Create one pure shared policy for:

1. determining whether a request status is editable; and
2. determining whether the current user is an authorized editor.

Both `RequestDetail` and `EditRequest` must consume the same policy. This keeps
the visible Edit button and direct `/requests/:id/edit` access consistent.

## Save behavior by status

### New and R

An edit made while the request is New or R:

- updates the existing parent, child, documents, and any true grandchildren;
- preserves the current request status and outcome;
- does not write `gcp_lastupdateddate`;
- does not send the `request_resubmitted` notification;
- uses normal edit copy such as **Save Changes** and **Changes saved**.

### RS

An edit made while the request is RS:

- completes all parent, child, document, and grandchild writes first;
- preserves request status RS (`16`);
- ensures outcome RS (`4`);
- stamps `gcp_lastupdateddate` only after all preceding writes succeed;
- sends `request_resubmitted` after the marker write succeeds;
- uses **Submit Changes for Re-review** and **Changes submitted** copy.

The marker distinguishes “Code 2 / RS needs changes” from “RS changes have been
submitted and are ready for reviewer attention.”

## Entering RS

### Verify Data

When a Verifier selects RS, the request update must write:

- `gcp_requeststatus = 16`;
- `gcp_outcome = 4`;
- `gcp_lastupdateddate = null`.

Clearing the marker prevents the re-review action from appearing before the
request has actually been edited and submitted.

Other verification statuses retain their existing behavior.

### Reviewer Code 2

Reviewer Code 2 must continue to write:

- `gcp_decisioncode = 2`;
- `gcp_requeststatus = 16`;
- `gcp_outcome = 4`;
- `gcp_lastupdateddate = null`.

Reviewer Code 1, Code 3, Code 4, and W retain their mapped non-editable statuses
and outcomes.

## Re-review action

The **Review Resubmission** action remains restricted to Reviewer and
Administrator users and appears only when:

- status is RS (`16`);
- outcome is RS (`4`);
- `gcp_lastupdateddate` is non-empty.

Requestors and Verifiers may edit an eligible request but do not receive the
review action unless they also hold Reviewer or Administrator authorization.

## Form integration

All 13 edit adapters already run their type-specific update before calling the
shared completion callback. Extend that shared contract with an edit purpose:

- `standard` for New/R;
- `resubmission` for RS.

The purpose controls post-save side effects and user-facing submit/success copy.
It must not alter field rendering, loaded identity, draft persistence, or the
existing type-specific Dataverse mappings.

## Error handling

- If a request changes to a non-editable status before the edit page loads, show
  the existing unavailable message and redirect to Request Detail.
- If an RS marker/outcome PATCH fails, do not show edit success.
- Notification failure remains non-blocking after the required Dataverse writes.
- New/R edits must not accidentally create a resubmission marker.

## Verification

Because the repository has no automated test framework, add a focused,
dependency-free policy check where practical, then run:

1. the edit-policy checks;
2. `npm run build`;
3. `api/npm run build` if Function source changes;
4. Git diff/status review.

Runtime validation requires signed-in GCP-Developer smoke tests:

- original Requestor, Verifier, Reviewer, and Administrator see Edit for New,
  R, and RS;
- unauthorized users do not;
- New/R saves retain their status and do not stamp the marker;
- Verifier RS writes status/outcome RS and clears the marker;
- RS edit writes outcome RS and stamps the marker;
- Reviewer/Admin sees Review Resubmission after the RS edit;
- Code 1, 3, 4, and W hide Edit.

## Change record

At completion, create a Changes document recording:

- questions asked;
- user-approved decisions;
- files changed and why;
- verification commands and results;
- runtime checks still required;
- Git branch, baseline status, and final diff/status summary.

No deployment, restart, commit, or push is included without separate explicit
authorization.
