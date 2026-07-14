# Edit-mode roll-out — per-type completion record

**Status:** ✅ complete — every matter type has RS-edit support.
**Completed:** 2026-07-14. Companion to
[edit-request-mode-plan.md](./edit-request-mode-plan.md) (the design/recipe).

Editing opens the original multi-step form in `mode="edit"` at
`/requests/:id/edit`, pre-filled from the saved record, and PATCHes on save. It
is gated to **status RS (Resubmit, `gcp_requeststatus = 16`)** and to the
**requestor / Reviewer / Verifier / admin** — see
[EditRequest.tsx](../src/pages/EditRequest.tsx) and
[editRegistry.ts](../src/forms/editRegistry.ts). Saving does **not** change the
status (stays RS).

## Coverage — 13 matter codes (14 matter values)

| Code | Matter | Edit form | Phase |
|---|---|---|---|
| RTP | Registration of Tender & Proposal List | [RtpEditForm](../src/forms/rtp/RtpEditForm.tsx) | reference |
| PBL | Prospective Bidders List | [PblEditForm](../src/forms/pbl/PblEditForm.tsx) | reference (grandchild bidders) |
| JVP | JV / Partnership | [JvpEditForm](../src/forms/jvp/JvpEditForm.tsx) | 1 |
| CAA | Client - Acceptance of Award | [CaaEditForm](../src/forms/caa/CaaEditForm.tsx) | 1 |
| ST/SP | Submission of Tender / Proposal | [StspEditForm](../src/forms/stsp/StspEditForm.tsx) | 1 |
| PP | Procurement Plan | [PpEditForm](../src/forms/pp/PpEditForm.tsx) | 2 |
| VAP | Vendor Appointment & Procurement | [VapEditForm](../src/forms/vap/VapEditForm.tsx) | 2 |
| Others | Other Matters (9) / GCP-Others (13) | [OthersEditForm](../src/forms/others/OthersEditForm.tsx) | 2 |
| CI | Contractual Issue | [CiEditForm](../src/forms/ci/CiEditForm.tsx) | 2 |
| CPR | Contract & Procurement Report | [CprEditForm](../src/forms/cpr/CprEditForm.tsx) | 2 |
| PCCA | Project Cost Control Analysis | [PccaEditForm](../src/forms/pcca/PccaEditForm.tsx) | 2 |
| R-PCCA | Revised PCCA | [RpccaEditForm](../src/forms/rpcca/RpccaEditForm.tsx) | 2 |
| R-PP | Revised Procurement Plan | [RppEditForm](../src/forms/rpp/RppEditForm.tsx) | 2 |

## The recipe each Phase-2 type followed

For type `<T>` in `src/forms/<t>/`, five edits (no Dataverse schema changes):

1. **`src/types/<t>Request.ts`** — add `type UpdateGcp<T>RequestInput =
   Partial<CreateGcp<T>RequestInput>` and export it.
2. **`src/shared/services/<t>RequestService.ts`** — import `powerPagesFetch`,
   add `update<T>Request(id, input, { lookups })` (PATCH, `If-Match: '*'`),
   export it + its options type. Mirrors `updateCaaRequest`.
3. **`src/forms/<t>/types.ts`** — add `companyName: string` to `<T>FormState`
   (needed so the read-only Company field renders from `state`, not `user` — the
   identity fix).
4. **`src/forms/<t>/api.ts`** — add `load<T>FormState(request, child)` (reverse
   of the create mapping) and `update<T>RequestFromState(state, ids)` (PATCH
   parent `gcp_request` project fields + acknowledgement + documents, then PATCH
   the child). Rebinds only the **Project** lookup; never the Requestor/Company.
5. **`src/forms/<t>/<T>Form.tsx`** — add edit-mode props (`mode`, `initialState`,
   `requestId`, `initialDocuments`, `onEditSubmit`, `onEditSuccess`);
   `isEdit = mode === 'edit'`; `useFormDraft(…, { persist: !isEdit })`; gate both
   `user → state` sync effects with `if (isEdit) return;`; source the Company +
   Requestor selects from `state`; add the existing-documents strip; branch
   `handleSubmit` to call `onEditSubmit`; pass the edit success-screen props.
6. **New `<T>EditForm.tsx`** + **register** in `editRegistry.ts`.

The single behavioural rule (from the plan): **field rendering is identical
across modes.** Only the initial-state source, the gated user-sync effects, and
the submit target differ.

## Identity fix applied everywhere

Every Phase-2 form previously read the read-only **Company** (and, via
`requestorOptions`, the requestor) directly from the logged-in `user`. In edit
mode the editor may be a Reviewer/Verifier, not the owner, so those now render
from `state` (seeded from the loaded record), and the `user → state` sync effects
are gated to `new` mode. This also required adding `companyName` to each
`<T>FormState`.

## Per-type notes / quirks

- **PP, VAP, R-PP** — near-identical: child carries only `name`, `projectCode`,
  `acknowledged`; project/company/ack live on the parent. Two read-only Company
  fields (steps 1 & 2), both now state-sourced. R-PP's child primary name column
  is `gcp_name` (not `gcp_rpprequestname`).
- **Others** — one shared form/table for GCPC matter 9 and GCP matter 13;
  `matterValue` is preserved from the parent so the channel survives an edit.
  Adds a `descriptionOfMatters` textarea on the child. Parent link uses the
  `gcp_Requestlookup` nav property; child discriminator is `child.type ===
  'other'`.
- **CI** — many child text fields + a `companyRole` choice + a free-text
  `category`. `gcp_company` is **required** on the child, but a PATCH that omits
  the company bind leaves the existing value intact, so identity stays locked.
- **CPR** — the child's acknowledgement column is **`gcp_acknowledgementconfirmed`**
  (not `gcp_acknowledgement`). Two required status choices (`eotStatus` default 1,
  `voStatus` default 2) are non-nullable and seeded from the record.
- **PCCA** — the two "from Contract BQ" `DynamicRowFields` sections persist as
  **JSON strings** in `gcp_pricerevenuefromcontractbq` / `gcp_costfromcontractbq`;
  they seed `DynamicRowFields.initialRows` via `parseRowFieldData(state.…)`. The
  read-only totals auto-recompute from those rows on mount (effect left ungated —
  it correctly re-derives from the loaded rows).
- **R-PCCA** — the Work Item grid (`DynamicWorkItemFiled`) persists as a JSON
  string in `gcp_workitementry`. Its child (`gcp_rpccarequestgcp`) has **no
  project/company lookup** — only `gcp_Request` — so the child PATCH rebinds
  nothing; the parent PATCH still rebinds the Project. Because the child lacks a
  project lookup, the project GUID for prefill comes from the **parent** — which
  is why `projectId` was added to the shared `GcpRequest` type (reads the existing
  `_gcp_project_value`, already in `DEFAULT_REQUEST_SELECT`).

## Shared change

Added `projectId` (from `_gcp_project_value`) to the clean `GcpRequest` type in
[request.ts](../src/types/request.ts) so R-PCCA/R-PP can prefill the Project
select from the parent. Additive only; the column was already selected.

## Validation

`tsc --noEmit` clean and `npm run build` green after each type. Deploy per
CLAUDE.md §7 (dev first, then prod on the user's call); commit + push after.
