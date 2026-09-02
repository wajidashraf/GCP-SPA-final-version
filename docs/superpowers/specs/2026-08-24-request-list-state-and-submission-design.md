# Request List State and Submission Column Design

**Date:** 2026-08-24

## Objective

Enhance the Requests page with a typed matter-title search, a Submission date
column, and reliable return navigation from Request Detail to the exact list
page and filter state the user left.

## Request-list filtering

Keep the existing Project, Company, Status, and Matter type filters. Add a
separate `Matter title` text filter. It matches case-insensitively against both
the full matter label and its short code, so text such as `Prospective`,
`Bidders`, or `PBL` can match Prospective Bidders List.

All active filters combine with AND semantics. Any filter change resets the
visible pagination page to 1. Clearing filters clears the new text filter as
well as the existing filters.

## Submission column

Add `Submission` as the second column, immediately after `Request no.`. It
displays `gcp_submittedon` as a date in `DD MMM YYYY` form and displays an em
dash when the value is absent or invalid. The existing Matter type and later
columns shift one position to the right. Loading and empty rows span all eight
columns.

## Persistent list state and return navigation

Represent the Requests page number and all filters in URL query parameters.
The URL is the canonical list-state representation so refreshes, browser
history, and shared list links retain the same state.

When a request row or action opens Request Detail, pass the exact Requests URL
as router location state. The `Back to requests` control navigates to that
validated Requests path. If Request Detail was opened directly or the return
state is absent/invalid, it falls back to `/requests`.

## Architecture

Place filtering, query parsing/serialization, date formatting, and return-path
validation in a small pure TypeScript request-list module. `Requests.tsx`
consumes those helpers for rendering and navigation. `RequestDetail.tsx`
consumes only the validated return-path helper.

No Dataverse schema, table permission, API select, or mapping change is needed:
the list already loads matter, `gcp_requesttitle`, and `gcp_submittedon`.

## Verification

Tests cover:

1. Case-insensitive matter-title and short-code matching.
2. AND composition with the existing filters.
3. Query parsing defaults and serialization of non-default state.
4. Submission date formatting and invalid/absent fallback.
5. Safe Requests return-path validation and `/requests` fallback.

Run the complete Node test set and the SPA production build. A signed-in
deployed-site smoke test remains required for Power Pages runtime navigation.
