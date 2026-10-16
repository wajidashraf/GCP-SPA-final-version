# Request history, printing, and safe engagement rescheduling

**Date:** 2026-10-15 (Asia/Riyadh)
**Status:** Approved, implemented, and deployed to development on 2026-10-15;
signed-in workflow verification skipped at the user's request. Shared Function
publish explicitly approved.
**Verification:** See [the rollout record](../../request-history-booking-rollout-2026-10-15.md).
**Scope:** All six requirements in the user's attachment. The user confirmed
that a successful reschedule must release the previous slot for other users.

## Existing implementation and constraints

- The worktree was clean at the start; HEAD is `03681c9` on `master`.
- The React SPA uses typed same-origin Power Pages services. Azure Functions
  already authenticate Power Pages portal tokens and route Dataverse calls to
  the issuing portal's environment. Signatory administration uses Server Logic.
- Dataverse is externally owned. Reuse existing tables, fields, relationships,
  choices, and verified web roles. No schema changes are proposed.
- Request status R is `3`. Slot and engagement choices remain sourced from the
  existing choice modules; do not redefine business choices in the frontend.
- `Engagement.tsx` creates an engagement, marks its slot Booked, then sets the
  request to R in separate writes. It blocks creation when a scheduled
  engagement exists, but offers no requester edit path.
- `EditEngagementModal.tsx` already supports administrator edits. It updates the
  engagement before reserving the new slot, then swallows old-slot release
  failures. A failed operation can therefore leave inconsistent reservations.
- Checked-in Authenticated Users permissions allow Global create/write on
  engagements and slots. A new guarded endpoint alone cannot prevent bypass
  through these existing direct writes.
- Request Detail currently hides signature and document action entry points
  after workflow progression. It does not load an engagement summary.
- Letters already persist rendered text and metadata in
  `gcp_acklettertextcontent` and `gcp_endorselettertextcontent`.
- Acceptance already persists conclusion flags and `gcp_acceptancedate` on
  `gcp_request`. Signatures persist as request-linked `gcp_signature` rows.
- `DetailSection` unmounts collapsed content, so print CSS alone cannot include
  that content.
- RTP Project Name and Remarks are currently in Step 2, Project Details, despite
  the attachment referring to Step 1. Update the existing controls in place;
  preserve the current step structure and labels.
- The attachment's HO6 acceptance refers to the existing HOC Review Acceptance
  workflow. No second acceptance process is proposed.

## Approaches considered

1. **Frontend sequencing with rollback:** smallest code change, but independent
   writes cannot guarantee that the old booking survives every failure. Direct
   API writes would also bypass actor checks. This does not meet the stated
   authorization and reservation requirements.
2. **Authenticated Azure Function with a Dataverse transactional change set
   (recommended):** reuse the existing portal-token validator, environment
   routing, role lookup, app credentials, and existing records. Add one narrow
   booking service and remove direct non-admin mutation permissions that would
   bypass it. This requires coordinated Function and site deployment later.
3. **New Dataverse custom API/plugin:** can centralize enforcement, but adds a
   platform component outside the repository-owned model and is unnecessary for
   this delivery unless an existing deployed plugin requires that integration.

Microsoft documents Dataverse change sets as atomic: a failed operation rolls
back the completed operations in that change set. Inspect individual operation
responses; an outer successful batch response is insufficient evidence.
See [Dataverse batch operations](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/execute-batch-operations-using-web-api).
The documented [Server Logic Dataverse connector](https://learn.microsoft.com/en-us/power-pages/configure/server-objects#dataverse)
provides CRUD/custom API invocation but does not document the conditional batch
interface needed here; do not invent a connector method.

## 1. RTP placeholders

Set Project Name to `Enter Project Name` and Remarks to:

> Please provide the full project name here and a brief description of the project, including its scope, objectives, and relevant background information

Preserve labels, required rules, current state keys, parent/child mappings, and
the shared `TextField`/`TextAreaField` controls. Retain sufficient textarea rows
for the longer hint. The same controls continue to serve new and edit modes.

## 2. Booking edits and old-slot release

### User experience

- At R, show **Edit Booking** to the original requester and administrators.
  Ownership uses the loaded requestor contact GUID, not the engagement creator,
  email alone, or the currently logged-in editor.
- Reuse the existing engagement page/form and relevant administrator editor
  controls. Load the one scheduled engagement and prefill its current name,
  type, location, slot, and meeting times. Keep the current slot selectable even
  though it is Booked, alongside newly available slots.
- Update the existing engagement GUID. Preserve its number, request binding,
  original creator, and completed workflow information. Do not cancel and create
  a replacement booking.
- After confirmed success, refresh request details and availability. The old
  slot appears Available to other users; the new slot appears Booked.
- A same-slot details edit does not release or re-reserve that slot.
- Multiple scheduled engagements or another active booking on the old slot are
  data anomalies. Stop with a clear error rather than guessing which to move or
  releasing another reservation.

### Server authorization and transaction

- Authenticate through the existing portal-token path and pin the issuing
  portal's environment/site before querying records or roles. Fail closed when
  identity or site-scoped administrator status cannot be established.
- Load the request, engagement, and slots from Dataverse. Authorize the actual
  original requester or a site administrator. Reviewer/Verifier roles alone do
  not authorize rescheduling. Require request R and a Scheduled engagement bound
  to that request, including when called directly without the UI.
- Ignore client-supplied ownership, status, dates, attendee identity, or arbitrary
  Dataverse field names. Resolve new meeting dates/times and attendees from the
  selected saved slot; validate the existing type/location conventions.
- Immediately before mutation, verify that the new slot is Available and has no
  conflicting scheduled reservation. Require observed ETags for affected rows.
- Submit one change set: conditionally reserve the new slot, conditionally update
  the existing engagement, conditionally release the previous slot, and protect
  the request's observed R state with its ETag. Do not reset review/comments,
  outcome, or identity. The request remains R throughout.
- Transaction failure preserves the previous booking and reservation. Do not
  swallow release failures. Surface availability or concurrent-change conflicts
  with refresh guidance.
- A lost response is uncertain, not an automatic retry. Reconcile saved
  engagement identity, selected slot, and both reservation statuses before
  reporting success. Never replay a non-idempotent booking create blindly.
- Route existing booking creation and requester cancellation through the same
  authorized service so removing broad direct writes does not break those
  operations. Preserve the existing cancellation timing policy; it is separate
  from successful rescheduling, which always releases the previous valid slot.
- Apply the same safe rescheduling service to administrator management so it
  cannot retain the current silent-release bug.

### Permission scope

Remove the Authenticated Users direct create/write/association grants that allow
engagement/slot mutation outside this service. Keep required reads and provide
explicit verified administrator access for existing slot-management operations.
Trace Read/Create/Write/Delete/Append/Append To for engagement, slot, request,
and contact bindings, including slot deletion's detach/restore path. Check the
union of permissions and keep GUIDs sourced from existing metadata. No Global
grant is broadened for ordinary users. This is a coordinated permission change,
not a general permissions cleanup.

## 3. Descriptive request status labels

Retain the recently added filter copy and move presentation labels to a shared
display helper where needed for consistent request list rows and selected
filters. Keep canonical Dataverse choices and numeric filter values unchanged.
Do not change business logic that compares canonical labels or statuses.
Retain URL state, combined filters, pagination, sorting, and refresh behavior.

## 4. Complete-request printing

- Add a visible Print action for the original requester or an administrator.
- Print the same authorized saved information displayed in Request Detail,
  including engagement details, review information, stored signature events,
  saved acceptance details, and saved letters.
- Ensure collapsed sections keep their content mounted with appropriate hidden
  behavior on screen and an explicit print override. Render sections in the
  required sequence and wait for related-data loading and signature images
  before calling `window.print()`.
- If required data fails to load or a signature image cannot be fetched, show
  the error and provide retry; do not silently label an incomplete printout as
  complete. Preserve navigation and workflow actions outside print mode.
- Scope print CSS to request detail: remove navigation/controls, flatten cards,
  wrap long values, let long sections paginate, repeat table headings, avoid
  splitting individual signature blocks and short rows, and remove clipping.
- Read authorization remains server-enforced through the portal's record
  permissions. Browser printing introduces no privileged data endpoint.
  Restricting the app's Print button cannot prevent a reader from using their
  browser's own print command for information they can already access.

## 5. STSP step order

Move the complete PIC step definition, including its validation, before Project
Details: Basic Information, PIC, Project Details, the existing ST/SP information
steps, then Document. Preserve all fields and payload mappings. Update mapping
documentation step numbers without changing logical names. Check new/edit mode,
Next/Previous navigation, draft restoration, and final validation.

## 6. Saved forms and signature history

Preserve existing request/review sections and actions, then add read-only
historical content in this order:

1. Completed signature events, with saved image, stored signer identity, and
   saved signing date. Iterate persisted request-linked rows, independently of
   today's signatory roster. Keep HOC events distinguishable. Unsigned reusable
   previews never count as historical signatures.
2. HOC Acceptance details when acceptance is saved: stored conclusion, legacy
   comment where present, acceptance date, and available related HOC signature
   events. Do not infer the final submitter from the signed-in viewer.
3. Acknowledgement and Endorsement sections when saved text exists: show the
   exact persisted body and saved dates. Strip only recognized valid V2/legacy
   metadata suffixes. Render as escaped text with preserved line breaks; never
   render stored content as HTML or regenerate history from current templates.

Load associated history only after successful parent access, request-scope every
query, follow collection pagination, and isolate section errors visibly. Do not
add app-credential history reads that bypass portal permissions. Check related
read grants against parent access and do not broaden them to clear errors.
Show a submitted section only when saved evidence supports it, rather than
assuming that current workflow status proves a document exists.

### Existing storage limits

- Older acceptance rows contain flags/date, not the exact original declaration,
  a submission actor, or a verified selected signature-ID snapshot. Display the
  stored facts and label reconstructed wording appropriately. Do not claim an
  exact historical acceptance document or pair a signature speculatively.
- Existing letter bodies can be displayed faithfully. Do not overwrite them or
  modify active letter submission behavior to support historical display.
- Signature images remain subject to SharePoint access. Report inaccessible
  images; no new public link or arbitrary URL proxy is proposed.
- Complete request display must include persisted RTP Remarks, currently omitted
  by the focused detail override, and all accessible child collection pages.
- This delivery exposes existing saved history. It does not manufacture missing
  historical audit events or introduce new snapshot storage.

## Implementation boundaries and verification

Primary areas: RTP/STSP forms; shared status presentation; Request Detail and
shared detail sections; booking page/admin editor; engagement/slot services;
request history loading; signature/letter display helpers; scoped print styles;
the existing Azure Functions Dataverse/auth integration; relevant permission
YAML; mapping and architecture documentation.

Use meaningful regression tests for owner/admin authorization; Reviewer/Verifier
denial and multi-role ownership; request/engagement binding and status; same-slot
edits; occupied/new-slot concurrency; old-slot release; transactional rollback;
uncertain responses; duplicate prevention; exact saved letter extraction;
acceptance evidence; status values; and preserved STSP form behavior.

Run the complete focused Node suite and both TypeScript builds. Use a local
browser with controlled fixtures for layout, collapsed-section printing, long
content, and navigation where available. Document fixture limits. Actual portal
permissions, portal tokens, transactions, and SharePoint images still require a
signed-in GCP-Developer role matrix before production.

Implementation authorization covers local changes and verification. Do not
deploy, restart, commit, or push this new feature work without an explicit user
request for that action. The earlier push request applied to the prior review
commit. No deployment is part of this design.
