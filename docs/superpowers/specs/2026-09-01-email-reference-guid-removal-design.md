# Email Reference GUID Removal Design

**Date:** 2026-09-01
**Status:** Implemented; deployment verification pending

## Goal

Lifecycle notification emails must never expose the Dataverse `gcp_requestid`
GUID as a user-facing Reference. When `gcp_reviewno` exists, it remains the
Reference. When it is absent, the Reference row is omitted.

## Design

- `getRequestForNotification` will map `requestNumber` only from the trimmed
  `gcp_reviewno` value. The existing `recordId` fallback will be removed.
- The email field-block renderer will omit rows whose rendered value is empty.
  This keeps default and administrator-managed templates consistent when they
  contain `{{requestNumber}}` and no review number has been assigned.
- The request GUID remains available internally for Dataverse lookup and for
  constructing the authenticated `View Request` deep link. It is not inserted
  into email display fields.
- No Dataverse schema, table permission, choice value, or email recipient logic
  changes are required.

## Data Flow

1. The notification Function receives the internal request GUID.
2. It reads the request from Dataverse using that GUID.
3. It maps `gcp_reviewno` to `requestNumber`, or an empty string when missing.
4. Template rendering removes any field row whose resolved value is empty.
5. The email still uses the internal GUID only inside the request deep link.

## Testing

- A request with `gcp_reviewno` renders that value as Reference.
- A request without `gcp_reviewno` does not render the GUID or an empty
  Reference row.
- The request deep link continues to contain the request GUID.
- Existing non-empty template fields continue to render normally.
- The Azure Functions TypeScript build and applicable automated tests pass.

## Deployment

This behavior requires deploying the Azure Functions project. The SPA/Power
Pages bundle alone does not update notification rendering. Deployment is not
part of this implementation unless explicitly requested.
