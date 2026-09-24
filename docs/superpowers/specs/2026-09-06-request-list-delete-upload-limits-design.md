# Request List Filters, Administrator Deletion, and Upload Quota Design

**Date:** 2026-09-06

## Objective

Improve the Requests page with an inclusive submission-date range and a clearer
two-row filter layout, allow administrators to permanently delete a request and
its matter-specific data through the Power Pages Web API, and raise the combined
new-upload allowance for one request to 100 MiB.

## Scope and constraints

- Do not create or change Dataverse tables, columns, relationships, navigation
  properties, entity-set names, choice values, or web-role GUIDs.
- Use the existing `Administrators` web role. UI role checks control visibility
  only; Power Pages table permissions remain the authorization boundary.
- Delete only the parent `gcp_request`, its matter-specific child, and PBL bidder
  rows when applicable.
- Do not delete SharePoint files, engagements, suggestions, signatures, or other
  workflow/audit records as part of this feature.
- Apply the 100 MiB quota only to newly selected files in the current new/edit
  form session. Existing persisted SharePoint documents do not count again.
- Do not deploy, change Azure settings, restart a site, commit, or push without
  separate explicit authorization.

## 1. Request-list filter design

### Layout

Replace the current five-column filter row plus clear-button column with a
responsive filter section containing a small toolbar and a two-row desktop grid.

- Toolbar: filter label/summary on the left and `Clear filters` on the right when
  at least one filter is active.
- Row 1: Project, Company, Matter title.
- Row 2: Status, Matter type, Submission date range.
- The Submission date range is one logical grid item containing side-by-side
  `From` and `To` date inputs.
- At narrower breakpoints, preserve the existing responsive wrapping behavior so
  controls become two columns and then one column as space decreases.

The clear action moves out of the grid so the sixth logical filter completes a
balanced three-by-two layout. It remains a labeled, keyboard-accessible button
using a `lucide-react` icon with the icon marked decorative.

### Date semantics

Add `submittedFrom` and `submittedTo` to `RequestListFilters` and
`RequestListState`.

- Both boundaries are optional.
- `From` is inclusive from the beginning of the selected calendar day.
- `To` is inclusive through the end of the selected calendar day.
- Calendar-day comparison uses `Asia/Kuala_Lumpur`, matching the existing
  submission-date display behavior.
- If both are present and `From` is later than `To`, show an inline range error
  and do not apply the invalid date constraint.
- An absent or invalid `submittedOn` value does not match an active date range.
- Date filtering composes with every existing filter using AND semantics.

The range remains client-side, consistent with the existing Project, Company,
Matter title, Status, and Matter type filters. It therefore applies to the
records currently fetched by the Requests page; the existing `Load more`
behavior is unchanged and a server-side filtering redesign is outside scope.

### URL and pagination

Use `submittedFrom` and `submittedTo` query parameters. Parsing tolerates absent
or malformed values by returning an empty boundary. Serialization emits only
valid active boundaries. Changing either boundary resets the visible page to 1,
and clearing filters removes both values. Return navigation from Request Detail
continues to preserve the complete Requests URL.

## 2. Administrator deletion design

### User experience

Only a portal user whose current Power Pages roles include `Administrators`
sees a destructive trash-button action on each Requests row. The normal
View/Edit action remains available. Both actions stop row-click propagation and
have accessible names.

Selecting Delete opens a centered React Bootstrap confirmation modal that shows:

- request number;
- matter type;
- a permanent-deletion warning;
- the exact repository-owned data in scope (parent, matter child, and PBL
  bidders when applicable); and
- an explicit statement that SharePoint files and workflow/audit records are
  not removed by this operation.

Cancel closes the modal without mutation. Confirm becomes a loading/disabled
action while deletion is in progress, and closing the modal is disabled during
that operation so the outcome cannot be obscured.

The row is removed only after deletion of the parent request succeeds. On
failure, keep or reload the row, show a non-empty error message, and allow a
retry. The list filters, page, and URL remain unchanged after success or error;
if deleting the last row makes the current client page empty, clamp to the
nearest valid page.

### Data routing and ordering

Add a focused deletion module that reuses the verified child sources already
declared by the request-integrity implementation. The supported routes are:

| Kind | Child entity set | Parent lookup field |
|---|---|---|
| RTP | `gcp_rtprequests` | `_gcp_request_value` |
| PBL | `gcp_pblrequests` | `_gcp_request_value` |
| JVP | `gcp_jvmrequests` | `_gcp_request_value` |
| ST/SP | `gcp_stsprequests` | `_gcp_request_value` |
| CAA | `gcp_caarequests` | `_gcp_request_value` |
| PCCA | `gcp_pccarequests` | `_gcp_request_value` |
| PP | `gcp_pprequests` | `_gcp_request_value` |
| VAP | `gcp_vaprequests` | `_gcp_request_value` |
| Others | `gcp_otherrequestses` | `_gcp_requestlookup_value` |
| R-PCCA | `gcp_rpccarequestgcps` | `_gcp_request_value` |
| R-PP | `gcp_rpprequests` | `_gcp_request_value` |
| CI | `gcp_requestcigcps` | `_gcp_request_value` |
| CPR | `gcp_cprrequestgcps` | `_gcp_request_value` |

Deletion runs sequentially:

1. Resolve the request's child kind from the existing request matter/SOA data.
2. Query the expected direct child IDs by the verified parent lookup.
3. For PBL children, query and delete `gcp_pblbidderses` rows by
   `_gcp_pblrequest_value` before deleting the PBL child.
4. Delete all matching matter-specific child rows.
5. Delete the parent from `gcp_requests`.

All calls go through `src/shared/powerPagesApi.ts`, include the Power Pages
anti-forgery token, and use the current portal session. A DELETE response of 404
is treated as already complete, making retry after a partial result idempotent.
Other errors stop the sequence and identify whether bidder, child, or parent
deletion failed without exposing raw sensitive server detail.

Power Pages Web API does not make this multi-record client sequence a repository-
controlled transaction. A late failure can leave earlier scoped children
deleted while the parent remains. The page must state this accurately, refetch
the surviving parent, and permit the administrator to retry. The implementation
must not claim rollback or atomicity.

If deleting the parent is rejected because an out-of-scope dependent record has
a restrictive Dataverse relationship, preserve that dependent record and
surface the failure. Do not broaden this feature to delete it and do not change
Dataverse cascade behavior.

### Authorization and metadata

The frontend `isAdmin()`/role check is only a visibility convenience. Authorize
DELETE operations by Power Pages table permissions associated solely with the
existing Administrators web-role GUID.

- Enable Delete on the existing administrator Global permission for
  `gcp_request`.
- Add administrator-only Global Read/Delete permissions for each of the 13
  matter-child tables.
- Add an administrator-only Global Read/Delete permission for `gcp_pblbidders`.
- Do not add Delete to the existing Requestor child permissions and do not grant
  delete rights to Authenticated Users.
- Reuse the logical names, entity-set names, site settings, and existing
  Administrators web-role GUID already verified in repository metadata.
- Generate new table-permission record IDs only for the new permission records;
  never invent or replace a web-role GUID.

Read access is required because the browser must query child IDs before issuing
DELETE requests. Existing Web API site settings remain in force; add no wildcard
field exposure.

## 3. Combined upload quota design

### Quota rules

Define `MAX_REQUEST_UPLOAD_BYTES` as exactly `100 * 1024 * 1024` bytes (100 MiB).

- Sum every newly selected file across every `FileUpload` control in the active
  matter form.
- A single file may consume the entire quota, subject to the server accepting
  the multipart overhead described below.
- Existing documents loaded from `gcp_documentsurl` in edit mode contribute zero
  bytes to the new-upload quota.
- Replacing a newly selected file applies the size delta: total minus the old
  file plus the replacement.
- Removing a newly selected file releases its bytes from the client quota.
- The existing maximum file-count behavior remains unchanged.
- The quota covers uploaded controls even if a control is on an inactive
  multi-step page or the document is field-tagged/display-only.

If a multi-file selection would exceed the remaining allowance, reject that
entire new selection before starting any uploader. Preserve previously selected
files and show the current total, remaining allowance, attempted addition, and
100 MiB maximum. Exactly 100 MiB is valid; one byte more is invalid.

### Shared implementation boundary

Place byte summing, replacement-delta calculation, quota decisions, and display
formatting in a small pure upload-quota module. Extend the shared `FileUpload`
contract so it receives the form-wide current byte total and combined maximum.
Each matter form computes its total from all of its controlled `UploadedFile[]`
collections and passes the same total/limit to every upload control.

Do not rely on mounted-component registration: upload fields on earlier wizard
steps can be unmounted while their controlled file arrays remain in the parent
form. Parent-owned totals therefore remain accurate across every step.

The shared control displays both the per-file rule and form-wide usage, for
example `42.5 MiB of 100 MiB used`. Quota failure is a field-level error and no
network request starts for the rejected selection.

### Upload readiness and submission

Add a pure readiness check over all controlled upload collections. Submission is
blocked when any newly selected file:

- is still uploading (`progress < 100` and no error);
- has an upload error; or
- completed without the SharePoint URL required for persistence.

The final step displays a concise message telling the user to wait for uploads
or resolve failed files. Successful forms continue to persist document metadata
through `src/shared/documents.ts`; no Dataverse document column or JSON format
changes.

Removing an already uploaded selection detaches it from the request data and
releases the client quota, consistent with current behavior. This feature does
not delete that remote SharePoint item.

### Azure Function and SharePoint limits

Keep the current one-file-per-request multipart endpoint and the current Graph
upload-session implementation. Files larger than the simple-upload threshold
continue through sequential 5 MiB Graph chunks, a valid multiple of 320 KiB.

Align both runtime layers:

- Frontend combined maximum: `104857600` bytes.
- Azure Function `MAX_FILE_BYTES`: `104857600` bytes.
- Azure Function `FUNCTIONS_REQUEST_BODY_SIZE_LIMIT`: at least `125829120`
  bytes (120 MiB), leaving room for multipart headers around a 100 MiB file.

Validate these settings rather than relying on defaults. The Function currently
materializes `FormData`, then an `ArrayBuffer`, then a Node `Buffer`, so a 100 MiB
upload requires materially more memory than its wire size. The GCP-Developer
Function plan must be smoke-tested for memory and duration before production.
The implementation does not switch to HTTP streaming or direct-to-SharePoint
browser uploads.

Changing repository defaults or documentation does not change deployed Function
App settings. Updating the GCP-Developer setting and later production setting is
a separately authorized deployment operation.

References:

- [Azure Functions Node HTTP streams and request-body limits](https://learn.microsoft.com/en-us/azure/azure-functions/node-http-stream)
- [Microsoft Graph drive item upload sessions](https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession?view=graph-rest-1.0)

## 4. Error handling and accessibility

- Date inputs have explicit visible labels and associate the range error with
  both controls.
- Icon-only delete controls include an accessible name; decorative icons use
  `aria-hidden="true"`.
- The confirmation modal traps focus through React Bootstrap, identifies its
  title, and returns focus to the triggering row action after cancel.
- Delete and upload errors are rendered in accessible inline messages and never
  rely on console output alone.
- A failed delete or upload never produces a success message.
- While deleting, prevent duplicate confirms. While uploading, prevent form
  submission but allow the user to remove or retry failed selections.

## 5. Verification

### Automated tests

Extend the existing Node tests and add focused pure-module tests for:

1. Inclusive From/To filtering in `Asia/Kuala_Lumpur`.
2. Either boundary independently, malformed dates, missing submission dates,
   and `From > To` validation.
3. Date query parsing/serialization, clearing, and page reset behavior.
4. Matter-to-child routing for all 13 supported child kinds.
5. PBL ordering: bidders before PBL child before parent.
6. 404-as-success and stop-on-non-404 delete behavior.
7. Admin/non-admin delete-action visibility policy.
8. Permission metadata: parent and all child permissions grant Delete only to
   the existing Administrators role.
9. Quota totals across multiple fields, exactly 100 MiB, one byte over, complete
   selection rejection, replacement deltas, removal, and existing-document
   exclusion.
10. Readiness for pending, failed, completed-without-URL, and fully completed
    uploads.

Run the complete Node test set, `npm run build` at the repository root, and
`npm run build` under `api/`.

### GCP-Developer smoke tests

After a separately authorized deployment and Function configuration update:

1. Confirm the two-row desktop layout and responsive tablet/mobile wrapping.
2. Test a range spanning multiple days, From-only, To-only, exact-day, clear,
   refresh, and Request Detail return navigation.
3. Confirm a non-administrator neither sees the action nor can DELETE by calling
   the endpoint directly.
4. Confirm an administrator can delete representative simple-child and PBL
   requests and the list state remains intact.
5. Exercise a parent delete blocked by an out-of-scope dependency and verify the
   error is truthful and retry-safe.
6. Upload files through multiple controls totaling exactly 100 MiB and verify
   all persisted links.
7. Attempt 100 MiB plus one byte and verify no rejected file starts uploading.
8. Upload one large file near 100 MiB and verify Function memory, request-body
   acceptance, Graph completion, and SharePoint metadata.
9. Verify submission is blocked during an upload and after an upload error.

Production deployment requires explicit confirmation after GCP-Developer passes.

## Out of scope

- Server-side OData filtering or replacement of the existing `Load more` model.
- Bulk request deletion.
- Deleting SharePoint files or request folders.
- Deleting engagements, suggestions, signatures, or workflow/audit data.
- Changing Dataverse relationship cascade behavior.
- Making the multi-record Power Pages delete sequence transactional.
- Replacing the upload endpoint with streaming, direct browser-to-SharePoint, or
  upload-session handoff architecture.
