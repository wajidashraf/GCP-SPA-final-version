# Inline Reviewer Comments Design

## Goal

Let Reviewers and Administrators add and edit the required reviewer comment directly in the General Review section of the request detail page, then use the Review Request page only for the decision code and the existing matter-specific Info and Criteria field.

## Approved behavior

- The inline comment editor is available only to Reviewers and Administrators while the review cycle is open.
- An open review cycle is either status R (`3`) or an RS request (`status 16`, `outcome 4`) with a resubmission timestamp.
- Any submitted review code closes comment editing. An RS request unlocks it again only after the requestor submits a corrected edit and the existing resubmission timestamp is set.
- A saved comment is required before the Review Request button can be used and before a review decision can be submitted through a direct URL.
- Existing Code 2 comments remain available in the reopened correction cycle and may be kept unchanged.
- Saving a comment writes `gcp_reviewercomments` and reviewer attribution only. It does not write `gcp_reviewdate`, status, outcome, decision code, or the resubmission timestamp.
- Submitting a decision writes the existing decision/status/outcome/audit fields without overwriting `gcp_reviewercomments`.
- PCCA, PP, R-PCCA, and R-PP continue to show Info and Criteria for Review on the Review Request page.
- No Dataverse table, column, relationship, choice, or permission change is introduced.

## Editor design

Reuse the current `ReviewCommentBlock[]` model and version 1 JSON payload. Present it as one modern editor surface with a compact top toolbar for Text, bulleted list, and numbered list blocks. Blocks remain reorderable and removable, list rows remain editable, and all icon-only controls retain accessible labels.

Legacy plain-text comments continue to parse as a text block. Empty or whitespace-only text and list items do not satisfy the required-comment rule.

## Data flow

1. Request Detail loads General Review data, including `gcp_reviewercomments`.
2. An authorized user opens the inline editor, edits blocks, and saves.
3. The client normalizes and serializes the blocks to the existing versioned JSON format.
4. A dedicated request-service PATCH saves only the comment and optional `gcp_Reviewedby` lookup.
5. Request Detail reloads General Review data and renders the saved blocks immediately.
6. The Review Request page loads the saved comment only to validate its existence. It does not render or submit comment fields.
7. Immediately before decision submission, the page reloads the reviewer fields and rejects submission if the saved comment is absent or empty.

## Error and concurrency behavior

- Inline save errors remain on Request Detail and preserve the unsaved editor content.
- The Review Request button stays disabled until a meaningful saved comment exists.
- A direct Review Request URL displays a blocking message when the saved comment is missing.
- Comment and decision submissions validate a single latest Dataverse snapshot and use its ETag for `If-Match`, preventing stale pages from overwriting a concurrent save or decision.
- Existing request status/resubmission conflict checks remain in place.

## Verification

- Unit tests cover meaningful-comment validation, legacy text, malformed/empty JSON, list content, and normalized serialization.
- Root SPA and Azure Functions TypeScript builds must pass.
- Deployed Power Pages role, permission, and runtime behavior still requires a signed-in smoke test after an explicitly authorized deployment.
