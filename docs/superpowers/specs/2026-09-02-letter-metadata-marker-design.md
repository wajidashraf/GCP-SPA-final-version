# Letter metadata marker compatibility design

**Date:** 2026-09-02
**Status:** Implemented; deployment pending

## Problem

`serializeLetter` appends re-editable JSON metadata to the Dataverse memo value
inside an HTML comment (`<!--GCP_LETTER:...-->`). Production diagnostics showed
that an otherwise equivalent Power Pages Web API PATCH reaches the portal when
the comment is absent, but is rejected at the edge with HTTP 403 when the HTML
comment is present. The affected Endorser contact already has the expected web
role and request-write table permission.

## Design

Newly serialized letters will append a versioned, plain-text suffix:

```text
GCP_LETTER_METADATA_V2:{"templateKey":"...","values":{}}
```

The JSON extends from the marker to the end of the memo value. The serializer
will no longer emit HTML comment delimiters. `parseStoredLetter` will first
recognize the V2 suffix and will retain read compatibility with the legacy
`<!--GCP_LETTER:...-->` representation. Saving a legacy letter naturally
migrates it to V2 because all new serialization uses the new format.

## Constraints

- Do not change Dataverse tables, columns, relationships, or choices.
- Do not broaden Power Pages table permissions or web-role assignments.
- Keep the human-readable letter text and manual-value semantics unchanged.
- Do not deploy as part of this change.

## Verification

Regression tests must prove that new serialization avoids HTML comment syntax,
V2 content round-trips, and legacy content remains readable. The complete Node
test suite and `npm run build` must pass before completion is reported.
