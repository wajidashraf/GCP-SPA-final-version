# Changes — Request edit visibility and RS outcome

**Date:** 2026-07-31  
**Implementation status:** Complete in the local working tree; not deployed.

## Approved behavior

| Request state | Edit button | Authorized editors | Save behavior |
|---|---|---|---|
| New (`1`) | Shown | Original requestor, Verifier, Reviewer, Administrator | Preserve status/outcome; ordinary save copy; no resubmission timestamp or notification |
| R (`3`) | Shown | Original requestor, Verifier, Reviewer, Administrator | Preserve status/outcome; ordinary save copy; no resubmission timestamp or notification |
| RS (`16`) | Shown | Original requestor, Verifier, Reviewer, Administrator | Keep status RS; enforce outcome RS (`4`); stamp `gcp_lastupdateddate` only after all edit writes succeed; notify Reviewers |
| Every other status | Hidden | None through the edit UI | Direct edit URL is rejected |

Both routes into the correction cycle now have the same invariant:

- Verifier selecting RS sets status RS and outcome RS, and clears the old
  resubmission timestamp.
- Reviewer submitting Code 2 maps to status RS and outcome RS, and clears the
  old resubmission timestamp.

The **Review Resubmission** action requires status RS, outcome RS, and a
non-empty `gcp_lastupdateddate`. Code 1 and the states produced by Codes 3, 4,
and W are not editable.

## Questions resolved during review

1. **Should Edit remain available after Reviewer Code 1?**  
   No. Edit is hidden for Code 1 and every non-New/R/RS state.

2. **Should Verifier RS and Reviewer Code 2 behave differently?**  
   No. Both establish status RS plus outcome RS and allow the correction cycle.

3. **Which pre-review statuses should remain editable?**  
   New and R were explicitly added. The final editable status set is New, R,
   and RS only.

4. **Should every edit update `gcp_lastupdateddate` and notify Reviewers?**  
   No. Those side effects are reserved for edits submitted while the request is
   RS. New/R edits are ordinary saves.

5. **Who may edit?**  
   The original request owner, Verifier, Reviewer, or Administrator, subject to
   the status gate.

## Implementation notes

- Added `src/shared/requestEditPolicy.ts` as the single source for:
  editable statuses, editor authorization, standard-versus-resubmission
  purpose, user-facing save copy, Verifier RS fields, and RS resubmission
  fields.
- `RequestDetail.tsx` uses the shared status/role policy to show Edit.
- `EditRequest.tsx` enforces the same policy for direct URL access and passes
  the resolved edit purpose to the matter form. It does not render edit content
  until authentication and request loading settle for the current route ID.
- `useRequestDetail.ts` clears stale parent/child state when loading another ID
  and uses a load-generation guard so late responses cannot overwrite the
  current request.
- `requestService.ts` now sets outcome RS when Verifier selects RS.
  `markRequestResubmitted()` repairs outcome RS and stamps the timestamp
  together.
- All 13 edit wrappers call the resubmission marker/notification hook only for
  RS edits.
- All 13 underlying matter forms use **Save Changes** for New/R and
  **Submit Changes for Re-review** for RS.
- Existing Reviewer Code 2 mapping was reviewed and already returns
  `{ status: 16, outcome: 4 }`; no Dataverse schema or choice values changed.

## Files and groups changed

- Shared policy and tests:
  `src/shared/requestEditPolicy.ts`,
  `tests/requestEditPolicy.test.ts`, and `package.json`.
- Workflow orchestration:
  `src/pages/RequestDetail.tsx`,
  `src/pages/EditRequest.tsx`,
  `src/shared/hooks/useRequestDetail.ts`,
  `src/shared/services/requestService.ts`, and
  `src/forms/editRegistry.ts`.
- Matter implementations:
  the `*EditForm.tsx` wrapper and `*Form.tsx` form for RTP, PBL, JVP, ST/SP,
  CAA, PCCA, PP, VAP, Others, CI, CPR, R-PCCA, and R-PP.
- Durable documentation:
  `PROJECT_CONTEXT_REPORT.md`,
  `docs/edit-request-mode-plan.md`,
  `docs/edit-mode-rollout.md`, and `userguide.md`.
- Design and execution records:
  `docs/superpowers/specs/2026-07-31-request-edit-visibility-and-rs-outcome-design.md`
  and
  `docs/superpowers/plans/2026-07-31-request-edit-visibility-and-rs-outcome.md`.

## Verification

- `npm run test:edit-policy`: passed, 8 tests.
- Consistency scan: 13/13 edit wrappers have an RS-only resubmission guard.
- Consistency scan: 13/13 matter forms use purpose-specific submission copy.
- Root `npm run build`: passed (`tsc -b` and Vite production build).
- `api/npm run build`: passed (`tsc`).
- Vite reported its existing large-chunk advisory; it did not fail the build.
- Independent code review found no Critical issues. Its two Important
  direct-route loading findings were addressed with settled-auth/current-ID
  render gating and stale-load cancellation.
- `git diff --check` still reports trailing whitespace in
  `src/pages/VerifyData.tsx:64`. That file was already modified in the incoming
  dirty worktree and was not changed for this implementation.

A signed-in GCP-Developer smoke test is still required for Power Pages role
permissions, Dataverse PATCH behavior, and notification delivery. No deployment
was performed.

## Git comments

- Branch: `master`.
- The implementation was made in place because the required edit/re-review
  foundation existed only as uncommitted work in the current working tree.
- Baseline before this implementation: 68 tracked changes and 14 untracked
  entries. Those pre-existing changes were preserved.
- Current status at documentation time: 70 tracked changes and 18 untracked
  entries. This count includes unrelated incoming work and generated/local
  project records, so it is not a feature-only diff count.
- No commit, push, reset, checkout, deployment, or site restart was performed.
- Suggested commit subject when the mixed working tree is separated:
  `fix(requests): enforce New R RS edit policy and RS outcome`
