# Incomplete Request Draft and Repair Design

**Date:** 2026-09-01  
**Status:** Approved for implementation planning  
**Scope:** Request-list integrity classification and repair of incomplete initial submissions

## Problem

Every matter submission creates a parent `gcp_request` first and then creates
the associated matter-specific child record. If the child POST fails, the
parent remains in Dataverse with status New (`1`). The request list currently
treats that parent as a normal request, so users can open a detail page that has
no structured matter data. Existing edit forms cannot repair it because every
edit adapter requires an existing child record.

PBL has an additional partial-failure case: its direct `gcp_pblrequest` child
can exist while creation of the required `gcp_pblbidder` rows fails.

## Goals

- Detect incomplete requests without changing the externally owned Dataverse
  schema or inventing a new choice value.
- Display a verified incomplete New request as **Draft** on the request list.
- Make a Draft row non-navigable and expose only an **Edit** recovery action.
- Reuse the existing parent request and create only the missing associated data.
- Preserve the original requestor and company identity during repair.
- Prevent normal verification, review, engagement, or detail actions until the
  required associated data exists.
- Avoid classifying permission or network failures as missing records.

## Non-goals

- No Dataverse table, column, relationship, choice, navigation-property, or
  permission changes.
- No delete or automatic cleanup of incomplete parent records.
- No transactional rewrite of all form submissions.
- No repair of non-New workflow records whose associated data was later deleted.
- No deployment, site restart, or production change as part of local
  implementation.

## Integrity states

The frontend derives an integrity state for every listed parent. It does not
persist this state to Dataverse.

| State | Meaning | List behavior |
|---|---|---|
| `complete` | All required associated records are visible | Existing status and actions |
| `missing` | A successful integrity query proves required associated data is absent | Display Draft; Edit only; row not clickable |
| `unknown` | Integrity could not be verified, the matter is unsupported, or a query failed | Do not offer repair; disable navigation/action and show verification warning |

Only a parent with Dataverse status New (`1`) can enter the recoverable
`missing` state. A non-New record with missing associated data is `unknown` and
requires administrative investigation rather than bypassing existing edit
status rules.

## Completeness rules

- RTP, JVP, ST/SP, CAA, PCCA, PP, VAP, Others, R-PCCA, R-PP, CI, and CPR are
  complete when at least one visible direct child is associated with the
  parent request through the verified relationship already used by the
  corresponding table service.
- PBL is complete only when its direct `gcp_pblrequest` exists and at least one
  associated `gcp_pblbidder` exists.
- A query error never proves absence. It produces `unknown`.
- Duplicate direct child records are not created by repair. Existing duplicates
  are outside this feature's cleanup scope and should be reported separately.

## Batched integrity checks

The request-list data layer will run integrity checks after loading each parent
page and before enabling row actions.

1. Resolve each parent's child kind with the existing SOA-code and matter-code
   mapping used by `useRequestDetail`.
2. Group parents by matter-specific child table.
3. Query each relevant child table for only its primary key and parent lookup.
   Use the verified entity-set and lookup names from the existing services and
   types; do not introduce guessed metadata.
4. Chunk parent-ID filters to keep OData URLs bounded when one page contains
   many requests of the same type.
5. Build a set of parent IDs with visible children.
6. For PBL parents with a direct child, query bidder existence in batches and
   map bidders back through the PBL child ID.
7. Classify every parent as `complete`, `missing`, or `unknown`.

The integrity helper will be isolated from React so grouping, chunking, and
classification can be tested as pure logic. The request hook will expose the
classification and a separate integrity-loading/error state instead of
mutating `GcpRequest`, which remains the clean Dataverse domain type.

## Request-list behavior

- Wait for the integrity result before enabling row actions, preventing a New
  row from briefly exposing normal workflow actions before becoming Draft.
- `complete` rows retain their current status pills, click behavior, filters,
  pagination, and status-driven actions.
- `missing` rows show a display-only Draft pill regardless of the persisted New
  label. They are not clickable. Their sole action navigates directly to
  `/requests/:id/edit`.
- `unknown` rows remain visible so data is not silently hidden, but normal and
  repair actions are disabled. A concise message explains that associated data
  could not be verified.
- Existing server-side and route-level authorization remains authoritative.
  The list must not imply that its Edit button grants access.

## Repair mode

`EditRequest` will distinguish three child-load outcomes:

1. Existing child: use standard edit behavior.
2. Successful load with the required records absent and parent status New:
   enter repair mode.
3. Child-load error or non-New missing child: stop with an integrity error and
   do not offer record creation.

Repair mode uses the same matter form as new and edit mode. It initializes
read-only/common fields from the saved parent and initializes missing
child-owned fields from that form's canonical empty/default state. It does not
read or write the new-request session draft.

Each matter API will reuse its existing create mapping through focused builder
functions rather than duplicate logical names or payload construction. Normal
submission, normal edit, and repair will share the same parent/child payload
builders where practical.

For a missing direct child, repair submission will:

1. Re-query the expected child relationship immediately before creation.
2. Abort and request a reload if another child now exists.
3. Create the missing child bound to the existing parent request, using the
   existing verified lookup binds.
4. Patch only the parent fields/documents that normal edit mode is permitted to
   change.
5. Keep `gcp_requeststatus` at New (`1`) and do not stamp RS resubmission fields
   or send resubmission notifications.

Creating the child before optional parent patches removes the orphan condition
as early as possible. If the child succeeds but a later parent patch fails, the
UI reports the partial result and instructs the user to reload into normal edit
mode rather than retrying child creation.

For PBL with an existing direct child but missing bidders, repair mode uses the
existing PBL child update and bidder diff/create path. It must create required
bidder rows without creating a second `gcp_pblrequest`.

## Identity and authorization

- Repair uses the original parent requestor, company, and requestor email.
- A reviewer, verifier, or administrator performing repair must not become the
  requestor or replace the parent company.
- Project rebinding follows the same per-form behavior as existing edit mode.
- Existing `isAuthorizedRequestEditor` and table permissions continue to guard
  repair access and Dataverse writes.
- Integrity queries are read-only and use the current Power Pages session.
- A record is never classified as repairable from a failed or unauthorized
  child query, preventing accidental duplicate creation when a child merely is
  not visible to the current user.

## Error handling

- A failed integrity batch identifies the affected group as `unknown` without
  misclassifying unrelated matter groups.
- A missing direct child produces repair mode only after a successful empty
  child query.
- Duplicate-preflight detection stops repair before any create call.
- Child-create failures leave the parent Draft and present a retryable error.
- Parent-patch failure after successful child creation reports that the detail
  was created and requires a reload; it does not retry the child POST.
- PBL bidder failures leave the request Draft until bidder completeness is
  confirmed.

## Testing

Automated coverage will include:

- SOA/matter-to-child-kind resolution for all supported matter values.
- Parent grouping and bounded filter chunking.
- `complete`, `missing`, and `unknown` classification.
- Isolation of a failed matter-table batch from successful batches.
- PBL direct-child and bidder completeness combinations.
- Draft display label, disabled row navigation, and Edit-only action selection
  through extracted testable list helpers.
- Repair eligibility for New versus non-New records.
- Missing-child initialization from parent plus canonical form defaults.
- Create-versus-update selection for each matter adapter.
- Duplicate-child preflight behavior.
- Partial success when child creation succeeds and parent patching fails.
- Existing request-list state/filter tests to guard unrelated list behavior.
- Full `npm run build` verification.

Because localhost cannot validate Power Pages sessions, Dataverse table
permissions, or row-level visibility, runtime verification requires an
explicitly authorized GCP-Developer deployment followed by signed-in smoke
tests for at least a requestor and an administrator. Production remains out of
scope without separate explicit confirmation.

## Acceptance criteria

1. A verified parent-only New request appears as Draft on the request list.
2. The Draft row cannot open Request Detail and exposes only Edit.
3. Edit loads the appropriate form with parent values and empty missing-child
   fields.
4. Submitting repair creates the required child under the original parent and
   does not create another parent.
5. A repaired request returns to normal New behavior after integrity refresh.
6. PBL remains Draft until both its direct child and required bidder data exist.
7. Permission or network failures never trigger missing-child creation.
8. Repair preserves requestor/company identity and status New.
9. All focused tests and the SPA production build pass locally.
