# RTP FR Project Activation Design

**Date:** 2026-09-01
**Status:** Implemented; runtime verification pending deployment

## Problem

RTP submission creates a related `gcp_projects` record with
`gcp_projectstatus = 0` (Inactive). The Verify page currently updates only the
parent `gcp_request`. When a verifier selects FR (`gcp_requeststatus = 0`), the
related project therefore remains inactive.

## Confirmed Dataverse values

- RTP matter: `gcp_mattertype = 1`
- FR request status: `gcp_requeststatus = 0`
- Project statuses: Inactive `0`, Active `1`, Completed `2`, Dead `3`
- Request project lookup read value: `_gcp_project_value`
- Project entity set: `gcp_projectses`
- Project status column: `gcp_projectstatus`

No Dataverse schema, relationship, or choice-value change is required.

## Required behavior

When verification is submitted for an RTP request with target status FR:

1. Require a valid related project lookup before changing the request.
2. Read the related project and retain its ETag.
3. Save and confirm the request verification.
4. Change the project from Inactive to Active using the ETag.
5. Preserve Active, Completed, Dead, null, and unknown project statuses.
6. If an ETag conflict occurs, reload the project once and reevaluate the
   status. Never overwrite a newer terminal status.
7. Send the verification notification and navigate away only after the
   project step completes or is safely skipped.

All non-RTP or non-FR verification behavior remains unchanged.

## Partial-success recovery

Power Pages exposes separate JSON CRUD calls and does not provide a supported
transactional batch surface for this SPA. The request is therefore saved first
because a project must not become active before FR verification succeeds.

If request verification succeeds but project activation fails, the page will:

- clearly state that verification was saved but project activation failed;
- remain on the Verify page;
- change the primary action to retry project activation only;
- avoid rewriting the request or verifier audit timestamp on retry;
- defer notification and navigation until retry succeeds.

## Architecture

- Add a pure verification orchestration module that decides whether RTP/FR
  project handling is required and coordinates preflight, request save,
  confirmation, activation, and retry mode.
- Extend `projectService` with an ETag-aware `activateProjectIfInactive`
  operation.
- Extend the project type with the confirmed Dead choice and the returned ETag.
- Keep all Dataverse calls behind the existing `powerPagesApi` and service
  layers.
- Reuse the already configured `gcp_projects` Web API settings and global
  authenticated-user read/write table permission; do not broaden permissions.

## Error handling

- Missing project lookup or missing project row blocks the initial FR
  verification with an actionable error.
- A post-verification project failure uses partial-success copy and exposes a
  retry that performs only the project step.
- Concurrent updates use `If-Match` with the last observed ETag. A `412`
  triggers one reload and reevaluation; a non-Inactive latest status is
  preserved.
- Other service failures retain the existing normalized Power Pages error
  detail.

## Testing and verification

Tests are written before implementation for:

- RTP/FR detection and non-RTP/non-FR bypass;
- missing project validation before request mutation;
- request-save, poll, and activation ordering;
- retry mode skipping request mutation;
- Inactive activation and preservation of Active/Completed/Dead/unknown;
- ETag conflict reload without overwriting a terminal status;
- project status choice completeness.

Run the focused tests, the complete Node test suite, and `npm run build`.
Deployment and signed-in runtime verification are out of scope unless the user
separately requests them.
