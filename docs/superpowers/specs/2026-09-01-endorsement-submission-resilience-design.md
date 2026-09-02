# Endorsement submission resilience design

**Date:** 2026-09-01
**Status:** Implemented; runtime verification pending deployment

## Problem

Endorsement submission succeeds for some users but fails for others. The
repository assigns global read access on `gcp_request` to the Endorser web role,
but the global workflow write permission includes only Reviewer and Verifier.
The UI also exposes the Endorsement action to Reviewer/Admin rather than the
business owner of the action, Endorser/Admin. A pure Endorser can therefore read
the request or open the route directly but cannot PATCH the endorsement fields.

When Power Pages returns an error without a JSON OData message or HTTP status
text, `powerPagesApi` creates an `Error` with an empty message. The page then
renders the unhelpful text `Failed to submit:`.

## Goals

- Authorize only Endorser and Administrator users in the UI workflow.
- Give the Endorser web role the existing request-write capability required by
  the Power Pages Web API.
- Accept endorsement submission only from Pending Endorse (`11`), while
  retaining legacy Complete Acceptance (`8`) compatibility.
- Keep the submission idempotent and treat a lost response as success when the
  saved status can be confirmed.
- Always show a useful, non-empty error message with available HTTP/code
  context.
- Make no Dataverse schema, column, relationship, or choice-value changes.

## Authorization and permissions

The existing Endorser web-role GUID
`712bfc10-3359-4685-8f1f-69cd1db4f91a` will be added to the existing global
`gcp_request` workflow-write table permission. The existing permission record
and GUID will be retained to avoid delete/recreate behavior during upload.

The route `/requests/:id/endorsement-letter` will be wrapped with the existing
`RequireRole` component for `Administrators` and `Endorser`. Request Detail will
show the Endorsement Letter action to those roles only. The page will also
fail closed unless the loaded request status is `11` or legacy `8`.

Power Pages table permissions grant table-level write access. This matches the
existing Reviewer/Verifier workflow model; it does not introduce a broader
Authenticated Users permission. Runtime validation and the narrow UI payload
remain defense in depth, but Dataverse/Power Pages remains the authoritative
security boundary.

## Submission flow

1. Load the request and verify the current role and status.
2. Serialize the endorsement letter.
3. PATCH only:
   - `gcp_endorselettertextcontent`
   - `gcp_endorsementdate`
   - `gcp_requeststatus = 12`
4. Confirm that status `12` is observable.
5. If the PATCH throws an uncertain transport/server error, poll once through
   the existing bounded status confirmation. If status `12` is found, treat the
   operation as successful; otherwise surface the original normalized error.
6. Do not retry authorization, validation, or other deterministic 4xx errors.

The PATCH is idempotent: repeating it stores the same letter/status, with the
same client-computed endorsement date for that attempt. No related row is
created, so reconciliation cannot create duplicates.

## Error handling

Add a pure error-message normalizer used by `powerPagesApi` and the endorsement
page. It will:

- preserve a non-empty OData error message;
- recognize common nested/string error bodies;
- map session and permission failures to actionable user text;
- otherwise include `HTTP <status>` and an available Dataverse error code;
- fall back to `The endorsement could not be submitted. Please try again.` when
  no diagnostic detail exists.

Detailed error objects may be logged to the browser console, but tokens,
payload contents, and letter text must not be logged.

## Testing

Tests will be written before implementation for:

- Endorser/Admin authorization and rejection of Reviewer-only access;
- allowed statuses `11` and legacy `8`, with other statuses rejected;
- lost-response reconciliation when status `12` is already saved;
- no retry/reconciliation success when the status did not advance;
- non-empty formatting for blank HTTP/OData errors;
- preservation of useful server messages and permission-specific guidance.

The complete Node test suite and `npm run build` must pass. Deployment is out of
scope unless separately requested. A deployed, signed-in smoke test must cover
Endorser success, Reviewer denial, Administrator success, and a hard refresh
after the Power Pages site restart.

## Documentation

Update `PROJECT_CONTEXT_REPORT.md` and `userguide.md` to state that
Endorser/Admin submits GCPC endorsements and to record the permission/runtime
validation behavior. No `mapping.md` update is needed because persisted fields
and choice values do not change.
