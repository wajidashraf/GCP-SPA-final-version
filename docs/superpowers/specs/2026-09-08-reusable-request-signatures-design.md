# Reusable Signatures With Per-Request Confirmation

**Decision date:** 2026-09-08
**Status:** Implemented locally; deployment pending
**Scope:** Working GCPC request signatures displayed in the Request Detail
signature section

## Objective

Allow a configured signatory to reuse the image from their most recently saved
signature instead of drawing or uploading it again. Reuse must not sign a new
request automatically. The user must explicitly confirm the saved image for
each request, and that confirmation must create a separate signature record
linked to the current request with its own creation timestamp.

## Existing behavior and data model

The existing `gcp_signature` table already stores the fields needed for this
feature:

- `gcp_Request`: the request to which the signing event belongs;
- `gcp_Signatory`: the signing contact when a valid contact ID is available;
- `gcp_name`: the configured signatory email used by the Working GCPC
  signature section;
- `gcp_signurl`: the SharePoint URL of the signature image; and
- `createdon`: the signing-event timestamp.

`listSignaturesForRequest` currently retrieves only rows linked to the active
request. `SignatureSection` matches those rows to configured signatories by
email and counts one signed member toward the Prepared or Confirmed threshold.
`SignatureModal` uploads a new image and creates the request-linked signature
row.

No Dataverse table, column, relationship, or choice change is required.

## Behavioral rules

For each configured signatory shown on a Pending Review request:

1. A signature row linked to the current request is authoritative. When one
   exists, show its image and signing date as the completed signature for that
   request. Do not offer confirmation again.
2. When the current request has no signature from that signatory, look for the
   signatory's most recently created reusable signature from another request.
3. When a reusable signature exists, show the image as a preview with an
   explicit **Saved signature — not yet confirmed for this request** state.
   A preview does not count toward either signature threshold.
4. The preview provides two actions:
   - **Confirm Signature** creates a new `gcp_signature` row for the current
     request using the preview's existing `gcp_signurl` and the current
     signatory identity.
   - **Draw/Upload Different Signature** opens the existing signature modal.
     Saving uploads the replacement image and creates the current request's
     signature row. Because it is the newest row for that signatory, it becomes
     the image offered on later requests.
5. When no reusable signature exists, preserve the current Awaiting Signature
   state and **Sign** action.
6. A user may confirm or replace only their own configured signatory entry.
7. Only current-request signature rows count toward Prepared and Confirmed
   thresholds or enable Complete Review.

## Identity and lookup

The latest reusable signature lookup should prefer the authenticated contact
ID through the existing `gcp_Signatory` lookup. For legacy Working GCPC
signature rows where that lookup is absent, it should fall back to an exact,
case-insensitive match of the normalized configured email stored in
`gcp_name`.

The lookup must not interpret the special `gcp_name = "HOC"` acceptance marker
as a Working GCPC member email. The reusable result is ordered by `createdon`
descending and limited to the newest usable row whose `gcp_signurl` is not
empty.

## Component and service changes

### Signature service

Add a typed read operation for the latest reusable signature belonging to the
current signatory. Keep request-scoped reads unchanged because they remain the
source of truth for completion.

Add a reuse operation that creates a new row through the same request-signature
persistence path while supplying the existing image URL. The caller must never
update or rebind the old row.

Immediately before creating the current-request row, re-read that request's
signatures and stop if the signatory has already signed. This makes retries and
ordinary double clicks idempotent from the UI's perspective. The existing data
model has no confirmed unique constraint, so this client check cannot guarantee
against two truly concurrent direct API requests.

### Signature section

Maintain separate state for:

- current-request signatures, which are completed signing events; and
- reusable signature previews, which are unsigned suggestions.

Load the reusable preview only for the signed-in user's matching configured
member entry and only when that member has not signed the current request. Do
not fetch or display reusable signatures for other members as if they were
already signed.

After either confirmation or replacement succeeds, reload current-request
signatures. The new request-linked row then replaces the preview state and is
counted normally.

### Signature modal

Keep the existing Draw and Upload paths. The section-level
**Draw/Upload Different Signature** action opens this same modal; no duplicate
upload component is introduced.

## User-interface states

Each signatory box has one of three mutually exclusive states:

| State | Image | Status | Available action |
|---|---|---|---|
| Signed for this request | Current-request image | `Signed: <date>` | None |
| Saved image available | Latest reusable image | `Not yet confirmed for this request` | Confirm Signature; Draw/Upload Different Signature |
| No saved image | Empty placeholder | `Not yet signed` | Sign |

The saved-image state must be visually distinguishable from the completed
state. It must not use the completed checkmark or signed styling before
confirmation.

## Error handling

- If current-request signatures cannot be loaded, preserve the existing
  warning and do not offer reuse confirmation because completion state is
  unknown.
- If the reusable-signature lookup fails, keep the ordinary unsigned state and
  show a non-blocking warning; drawing or uploading remains available.
- If confirmation fails, leave the preview in place, show the error, and allow
  retry.
- If a pre-save recheck finds an existing current-request signature, treat the
  operation as already completed and reload the section.
- Reusing a URL performs no SharePoint upload, so it cannot create an orphaned
  file. The existing replacement-upload path retains its current upload error
  behavior.

## Authorization and security boundary

The current UI restricts the signing action by matching the portal user's email
to the configured signatory email. Existing Power Pages table permissions grant
Create only to the approved signing roles. Those checks are retained.

The current direct browser POST still trusts browser-supplied signatory and
request values; therefore the UI check and duplicate recheck are not a complete
security boundary. A future hardened server endpoint should validate the
authenticated contact, configured member identity, request status, and
duplicate state before creating a signature. That hardening does not require a
Dataverse schema change, but it is outside this narrowly scoped UI reuse change
unless separately authorized.

## Validation

At minimum:

1. Add focused tests for selecting the newest reusable signature, excluding the
   current request, contact-ID preference, legacy email fallback, missing image
   URLs, and the HOC marker.
2. Add component-level coverage for all three box states and confirm that only
   current-request signatures count toward thresholds.
3. Verify a repeated confirmation does not intentionally create another row.
4. Run the root SPA build.
5. After an explicitly authorized deployment to GCP-Developer, smoke-test with
   a configured signatory:
   - sign Request X with a new image;
   - open unsigned Request Y and see the saved-but-unconfirmed preview;
   - confirm it and verify a new Request Y signature row and timestamp;
   - open Request Z, choose a replacement image, and verify that replacement is
     offered on the next request;
   - verify previews do not affect thresholds before confirmation; and
   - verify another user cannot confirm the configured member's signature.

## Out of scope

- Dataverse schema changes or a dedicated profile-signature table.
- Automatically signing a request when its detail page opens.
- Counting a saved-image preview toward thresholds.
- Rebinding or modifying a signature row belonging to an earlier request.
- Deployment, site restart, or production changes.
