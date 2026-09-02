# HOC Acceptance Unified Conclusion Design

**Date:** 2026-08-24

## Objective

Replace the two HOC acceptance choices shown for reviewer Decision Code 1 with
one explicit radio choice. The visible statement must be:

> We accept the summary review conclusion code and we agree to incorporate

The change applies to editable and completed HOC acceptance documents,
including historical records that were stored as Code 1(b).

## User experience

- A request with reviewer Decision Code 1 shows one radio button.
- The radio button has no visible Code 1(a) or Code 1(b) badge.
- The Code 1(b) statement and exception/mitigation controls are absent.
- The user must select the radio before submitting the signed acceptance.
- The confirmation dialog displays the unified statement instead of a code
  label.
- Completed historical Code 1(a) and Code 1(b) acceptances display the same
  unified statement and do not display legacy Code 1(b) exceptions.
- Decision Code 2 and Code 3 behavior remains unchanged.

## Data compatibility

Dataverse remains unchanged. New unified acceptances persist through the
existing Code 1(a) value and fields. A loaded historical Code 1(b) value is
normalized to the unified Code 1(a) presentation in the UI without rewriting
the stored record merely because it was viewed.

Submission no longer sends a Code 1(b) exception comment for the unified
choice. Existing Code 1(b) data remains stored in Dataverse but is not rendered
on the HOC acceptance page.

## Implementation boundary

Extract the conclusion definitions and loaded-value normalization into a small
pure TypeScript module. `ReviewDecisionForm` will consume that module, remove
Code 1(b) exception state and validation, and update the confirmation and
signature wording. No route, table, column, choice integer, permission, server
logic, or Azure Function change is required.

The manually edited checked-in Power Pages bundle is pre-existing user work and
must be preserved. The source change will be validated with a fresh `dist`
build; deployment and checked-in bundle regeneration are outside this task
unless separately requested.

## Verification

Focused tests will verify:

1. Decision Code 1 exposes only the unified internal Code 1(a) option.
2. The option has no visible code label and uses the exact approved statement.
3. Historical Code 1(b) values normalize to the unified Code 1(a)
   presentation.
4. Decision Code 2 and Code 3 options remain unchanged.
5. No Code 1(b) exception payload is produced for the unified choice.

Run the focused tests and the SPA production build. A signed-in deployed-site
smoke test is still required to verify Power Pages runtime behavior.
