# Endorsement Review Number Auto-Population Design

**Date:** 2026-09-02
**Status:** Implemented; deployment pending

## Problem

The endorsement letter renders **Review No.** from the shared `reviewNo`
variable, but that variable is currently manual. For an endorsement, the value
must come from the most recent Completed engagement related to the request.

## Data selection

Add a focused Power Pages Web API query to the existing engagement service:

- filter by the current request lookup;
- filter `gcp_engagementstatus` to Completed (`2`);
- order by `gcp_engagementdate desc,createdon desc`;
- request only the first matching record; and
- return its existing `gcp_engagementnumber` value, such as `R01` or `R02`.

The current Power Pages metadata already enables the `gcp_engagements` Web API
and grants Authenticated Users read access, so no permission or schema change is
required.

## Page and letter behavior

`EndorsementLetterPage` loads the latest Completed engagement number for its
request before rendering the letter. It passes that value through
`LetterContext`. The existing `LetterVariable.auto` convention makes Review No.
read-only whenever the service returns a non-empty value.

When no Completed engagement exists, the context contains no automatic Review
No. and the existing manual input remains blank and editable. A lookup failure
is not treated as an empty result: the page displays a load error and withholds
the endorsement editor, preventing an incorrect manual fallback.

Acknowledgement letters retain their existing manual Review No. behavior
because only the endorsement page supplies the automatic context value.

## Verification

Pure tests cover the generated query, a returned engagement number, and the
no-match result. Template tests cover conditional auto/read-only resolution.
The complete Node test suite and production build must pass before deployment.
