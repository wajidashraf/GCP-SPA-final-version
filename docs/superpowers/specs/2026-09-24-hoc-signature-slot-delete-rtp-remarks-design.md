# HOC Signature Reuse, Slot Deletion, and RTP Remarks Design

**Date:** 2026-09-24

## Scope

Extend saved-signature preview and per-request confirmation to the Review
Acceptance page, add administrator slot deletion while preserving engagements,
and rename the RTP form's Project Description label to Remarks.

## Signature behavior

Request Detail already previews the signed-in Working GCPC member's most recent
signature from another request. The Review Acceptance page will use the same
service behavior for the signed-in HOC or administrator:

- A signature already attached to the current request remains authoritative.
- Otherwise, the page looks up the latest signature from another request by the
  signed-in user's Dataverse contact ID.
- A previous HOC signature is never selected by the shared `HOC` marker alone.
  Reuse requires a valid contact ID so one HOC cannot receive another person's
  signature.
- The saved image is shown as an unconfirmed preview. `Confirm Signature`
  creates a new `gcp_signature` row for the current request, retaining the
  existing `gcp_name = HOC` convention and binding the current contact.
- `Draw/Upload Different` opens the existing signature modal and creates a new
  current-request signature in the existing way.
- If no contact ID is available, reuse is unavailable but drawing/uploading a
  new signature remains available.
- The HOC web role receives create/append permission on `gcp_signature`, and
  its existing company-scoped request permission receives `appendto` so the
  signature can be associated with an in-scope request. No Dataverse schema or
  Azure Function change is required.

The current data model has no verified unique key on request plus signatory.
Confirmation therefore retains the existing client-side read-before-create
idempotency. It prevents ordinary repeat clicks, but simultaneous confirmation
from separate tabs is not an atomic database guarantee; adding one would
require a confirmed alternate key or a server-side transaction endpoint.

The only signature-entry surfaces are Request Detail and Review Acceptance.
Audit Trail is intentionally read-only.

## Slot deletion behavior

Slot Management is already restricted to Administrators. Every available and
booked slot card will have a small destructive action in a bottom-right footer.
Selecting it opens a confirmation dialog and disables repeated actions while
the operation runs.

- Available slots are deleted directly.
- For booked slots, all `gcp_engagements` rows referencing the slot are loaded
  and their `gcp_Slot` lookup is cleared before the slot is deleted.
- Engagement rows, dates, times, statuses, and other history remain unchanged.
- If deletion fails after links were cleared, the client makes a best-effort
  attempt to restore the original slot links and reports the failure.
- A dedicated Global delete permission for `gcp_slot` is assigned only to the
  Administrators web role. The existing Authenticated Users permission remains
  delete-disabled.

## RTP label

The RTP form label `Project Description` becomes `Remarks`. The existing
`projectDescription` state property and confirmed Dataverse mappings
(`gcp_projectdescription` and parent `gcp_projectdiscription`) remain unchanged.
`mapping.md` will reflect the new visible label.

## Validation

Focused tests will cover contact-safe HOC signature reuse and idempotent
confirmation, engagement lookup clearing and slot deletion orchestration, and
the administrator-only slot delete permission metadata. The affected tests and
the full SPA build must pass. Runtime verification still requires a signed-in
Power Pages session after deployment.
