# Plan — Edit an RS request from the Request Detail page

**Status:** ✅ **complete — all 13 matter codes have edit support.**
**Author/date:** drafted 2026-06-18; roll-out completed 2026-07-14.

> **See [edit-mode-rollout.md](./edit-mode-rollout.md)** for the per-type
> completion record (what each form maps, the reverse field mapping, and any
> per-type quirks). The sections below are the original design; they remain
> accurate as the recipe every type followed.

## Goal

When a request's status is **RS** (Resubmit, `gcp_requeststatus = 16`), show an
**Edit** button on the Request Detail page — on the right side of the
`.rd-recordbar` strip, directly below the `.rd-hero` header. Clicking it opens the
**same multi-step form** the request was created with, pre-filled with the saved
data, so the user can correct it and save.

**Who can edit:** the **Requestor** (owner of the record), **Reviewer**, and
**Verifier**.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Approach | **A — navigate to the existing form in "edit mode"** (not inline editing on the detail page) |
| Status after save | **Stays RS (16).** Saving does not advance the workflow; a separate step moves it forward. |
| Removed grandchild rows (e.g. PBL bidders) | **Enable `delete: true`** on the affected table permission(s); removed rows are hard-deleted. |
| Scope | **All matter types**, delivered as: shared scaffolding + **PBL reference implementation first**, then fan out to the other 12 types using a fixed recipe. |

### Why Approach A (not inline editing)

[RequestDetail.tsx](../src/pages/RequestDetail.tsx) is a **generic, read-only
renderer for 14 matter types** (`flattenChildFields` / `buildFields`). Making it
inline-editable would mean breaking that abstraction per type (and rebuilding the
bidders grid as editable). Approach A reuses each form's existing validation,
multi-step UX, field components, and add/remove logic, and isolates all edit risk
to the form flow. It mirrors the existing
`/requests/:id/verify-data`, `/review`, `/engagement` sub-page pattern.

---

## Core design principle — edit mode must be identical to new mode

The single most important rule: **field rendering is identical across modes.**
A field that is `isReadOnly` when creating stays `isReadOnly` when editing,
because the JSX does not change between modes. Only **three** things differ:

1. **Initial state source** — `new`: empty defaults; `edit`: the loaded record.
2. **`user` → state sync** — the effects that copy the logged-in user's
   identity/company into form state run **only in `new` mode**.
3. **Submit target** — `new`: create APIs (POST); `edit`: update APIs (PATCH +
   diff).

If we follow this, read-only fields automatically remain read-only, and the form
looks/behaves exactly as it does today.

### The identity bug this fixes (must-fix, not optional)

Today the forms read several **read-only** values from `user` (the logged-in
user) rather than from form state. In [PblForm.tsx](../src/forms/pbl/PblForm.tsx):

- `requestorOptions` is built from `user.name` / `user.email` (lines ~187–189).
- The **Company** `SelectField` options/value use `user?.companyAccountId` and
  `user.company` directly in JSX (lines ~285–306).
- Three `useEffect`s sync `user.companyAccountId`, `user.email`, `user.name`
  **into** state (lines ~106–129).

In edit mode a **Reviewer/Verifier** is the logged-in `user` — not the original
requestor. As written, the form would show the *reviewer's* name/email/company and
the sync effects would **overwrite the requestor's saved data**. 

**Fix (apply to every form during its refactor):**

- Render all displayed values from **`state`** (seeded from `initialState` in edit
  mode), never directly from `user`.
- Gate every `user → state` sync effect with `if (mode !== 'new') return;`.

This change is safe for new mode (state is seeded from `user` there anyway) and
correct for edit mode (state is seeded from the loaded record).

---

## Shared scaffolding (build once)

### 1. Edit button on Request Detail — [RequestDetail.tsx](../src/pages/RequestDetail.tsx)

- Add `const isRS = meta?.statusLabel === "RS";` (status value 16).
- Reuse the existing `isOwner` logic (around line 271) and compute:
  ```ts
  const canEdit =
    isRS && (isOwner || hasRole("Reviewer") || hasRole("Verifier"));
  ```
- Render a right-aligned button inside `.rd-recordbar` (push with
  `margin-left:auto`), `Pencil` icon from `lucide-react`, only when `canEdit`
  **and** the matter type has a registered edit form. On click:
  `navigate(\`/requests/${request.id}/edit\`)`.
- CSS: add `.rd-recordbar-edit { margin-left: auto; }` (or a flex spacer) in
  [requestDetail.css](../src/styles/requestDetail.css) near `.rd-recordbar`
  (line ~127). The bar is already `display:flex; align-items:center`.

### 2. Form registry — replace the 13-way ternary

Extract the matter-code → form-component map currently inlined in
[SubmitForm.tsx](../src/pages/SubmitForm.tsx) into a shared registry, e.g.
`src/forms/registry.ts`:

```ts
export const FORM_REGISTRY: Record<string, FormEntry> = {
  RTP:   { Form: RtpForm,   loadState: loadRtpFormState,   update: updateRtpRequestFromState },
  PBL:   { Form: PblForm,   loadState: loadPblFormState,   update: updatePblRequestFromState },
  // …all 13
};
```

Both `SubmitForm` (new) and the new `EditRequest` page (edit) consume this map —
no duplicated dispatch. `loadState`/`update` may be `undefined` for a type until
its edit support lands; the Edit button + page treat "no entry" as "edit not
available for this type yet".

### 3. New route + EditRequest page — [App.tsx](../src/App.tsx)

Add: `<Route path="/requests/:id/edit" element={<EditRequest />} />`.

`EditRequest` responsibilities:

1. Load the record + children via
   [`useRequestDetail(id)`](../src/shared/hooks/useRequestDetail.ts) (same hook
   the detail page uses; keyed on `id`, so changing the URL `id` re-loads + re-guards).
2. Resolve the matter code → registry entry.
3. Build `initialState` via `entry.loadState(request, child)`.
4. Render `<entry.Form mode="edit" initialState={…} requestId={id}
   onSubmit={…edit submit…} />`.

### 4. `useFormDraft` — add a `persist` flag — [useFormDraft.ts](../src/forms/multistep/useFormDraft.ts)

Edit mode must **not** read/write the sessionStorage draft (it would clobber the
loaded record and leak edits across records). Add a backward-compatible option:

```ts
useFormDraft(key, initial, { persist: mode === 'new' });
```

When `persist` is false: seed from `initial` only, and skip the read + the write
effect (behaves like plain `useState(initial)`). Default stays `persist: true`.
Do **not** call `clearDraft()` in edit mode.

### 5. `MultiStepForm` — overridable success action — [MultiStepForm.tsx](../src/forms/multistep/MultiStepForm.tsx)

The success screen's primary button hardcodes navigation to the requests list
(lines ~136–148). For edit, we want to return to `/requests/:id`. Add optional
props (backward compatible):

- `submitLabel` (already exists) → set to `"Save Changes"`.
- `onSuccessAction?: () => void` (or `successHref?: string`) → when provided, the
  success button calls it instead of the default list navigation.
- Optionally `successTitle="Changes saved"` / tailored `successMessage`.

---

## Per-form edit support — the recipe (repeat for each of the 13 types)

For matter type `<Type>` in `src/forms/<type>/`:

1. **`<Type>Form.tsx`** — add props `mode: 'new' | 'edit'`,
   `initialState?: <Type>FormState`, `requestId?: string`,
   `onSubmit?: () => Promise<SubmitResult>`.
   - Seed: `useFormDraft(DRAFT_KEY, initialState ?? defaults, { persist: mode === 'new' })`.
   - Gate all `user → state` sync effects: `if (mode !== 'new') return;`.
   - Source read-only display values from `state`, not `user` (see identity fix).
   - Submit: `mode === 'edit' ? onSubmit() : <create flow>`. Set
     `submitLabel`/success copy for edit.
2. **`<type>/api.ts`** — add:
   - `load<Type>FormState(request, child): <Type>FormState` — map loaded
     parent + child (+ grandchildren) back into form state. Mirrors the field
     mapping in `mapping.md` and the create payload, in reverse.
   - `update<Type>RequestFromState(state, ids)` — orchestrate the PATCH/diff
     (see below).
3. **`<type>RequestService.ts`** — add `update<Type>Request(id, input, opts)`
   (PATCH; mirror [`updateRtpRequest`](../src/shared/services/rtpRequestService.ts)
   — `If-Match: '*'`). The parent `gcp_request` reuses the existing
   [`updateRequest`](../src/shared/services/requestService.ts).
4. **Register** the type in `FORM_REGISTRY` with its `loadState` + `update`.

### Grandchild diff (only types with child collections, e.g. PBL bidders)

On save, reconcile the collection against what was loaded:

- **Changed existing row** → PATCH (`update<Grandchild>`).
- **New row** (no id) → POST (existing create).
- **Removed row** (loaded id absent from current state) → **DELETE**.

Requires `delete: true` on that table's permission (see deployment).

### Save flow (all types)

1. PATCH parent `gcp_request` (changed fields) via `updateRequest`.
2. PATCH child `gcp_<type>request`.
3. Diff grandchildren if any.
4. **Do not change `gcp_requeststatus`** — it stays RS (16).
5. On success: navigate back to `/requests/${id}` and trigger a refetch (the
   detail page already exposes `refetch`). Show a "Changes saved" toast.

---

## URL / edge-case handling (EditRequest page guards)

All guards run **after** auth + record load resolve — never redirect while
loading (mirror the `if (authLoading) return false` pattern in RequestDetail's
`accessDenied`). The page is reached only by URL, so it must self-guard and not
trust the referring page.

| Situation | Handling |
|---|---|
| Auth/record still loading | Show `LoadingState`; render nothing else; do not redirect yet. |
| Request not found / load error | Show not-found/error `InlineMessage` with a link back to `/requests`. |
| Viewer not owner/Reviewer/Verifier | Access-denied message, then redirect to `/requests` (reuse RequestDetail `accessDenied` logic). |
| **Status is not RS (16)** | Re-check from the freshly loaded record. If not RS → "This request can no longer be edited" message, redirect to `/requests/:id`. (Covers someone deep-linking, or status changing after the detail page loaded.) |
| Matter type has no edit form registered | "Editing isn't available for this request type yet" message, link back to detail. |
| User edits the `:id` in the URL | `useRequestDetail(id)` is keyed on `id`, so the loader + all guards re-run for the new id automatically. |
| Direct/deep-link to `/requests/:id/edit` | Same guards apply; nothing depends on having come from the detail page. |
| Navigating away mid-edit (optional) | Optional unsaved-changes prompt via a router blocker / `beforeunload`. Nice-to-have, not required for v1. |

Concurrency: PATCH uses `If-Match: '*'` (last-write-wins), consistent with the
existing update services. No optimistic-concurrency handling needed for v1.

---

## Deployment (per CLAUDE.md §7 + memory)

1. **Table permission change** — set `delete: true` on the grandchild table
   permission(s) whose rows can be removed, starting with
   [PBL-Bidders-Global-Access.tablepermission.yml](../.powerpages-site/table-permissions/PBL-Bidders-Global-Access.tablepermission.yml).
   Confirm which other types have removable child collections during fan-out.
2. Build + `pac pages upload-code-site` with `--compiledPath`/`--siteName`
   (CLAUDE.md §7). **Deploy to GCP-Developer first**, verify, then to
   PowerPagesProduction on the user's call.
3. Restart the site in Power Pages Studio; hard-refresh in incognito.
4. Commit + push to git (master) after each deploy.

---

## Rollout order — ✅ done

1. **Phase 0 — shared scaffolding:** ✅ Edit button + gating on RequestDetail,
   `editRegistry.ts`, `/requests/:id/edit` route + `EditRequest` page + guards,
   `useFormDraft` `persist` flag, `MultiStepForm` success-action override.
2. **Phase 1 — RTP reference implementation** ✅ (then PBL, JVP, CAA, ST/SP).
3. **Phase 2 — fan out** ✅ to the remaining types (PP, VAP, Others, CI, CPR,
   PCCA, R-PCCA, R-PP), completed 2026-07-14 — see
   [edit-mode-rollout.md](./edit-mode-rollout.md).

**Note — no grandchild DELETE path was needed after all.** During fan-out we
confirmed that every "collection" input across the remaining types
(`DynamicRowFields` / `DynamicWorkItemFiled` on PCCA, R-PCCA, CAA) persists as a
**JSON string in a single multiline-text column on the child record**, not as
separate grandchild rows. PBL bidders are the only true grandchild collection.
So Phase 2 needed no `delete: true` table-permission changes.

---

## File-by-file change list

**Shared (Phase 0):**
- `src/pages/RequestDetail.tsx` — RS gate, `canEdit`, Edit button in `.rd-recordbar`.
- `src/styles/requestDetail.css` — right-align the Edit button.
- `src/forms/registry.ts` *(new)* — `FORM_REGISTRY`.
- `src/pages/SubmitForm.tsx` — consume `FORM_REGISTRY` instead of the ternary.
- `src/pages/EditRequest.tsx` *(new)* — load, guard, dispatch.
- `src/App.tsx` — add `/requests/:id/edit` route.
- `src/forms/multistep/useFormDraft.ts` — `persist` option.
- `src/forms/multistep/MultiStepForm.tsx` — optional success-action override.

**Per type (Phase 1 = PBL, then Phase 2 = others):**
- `src/forms/<type>/<Type>Form.tsx` — edit-mode props, gated user-sync, state-sourced read-only fields.
- `src/forms/<type>/api.ts` — `load<Type>FormState` + `update<Type>RequestFromState`.
- `src/shared/services/<type>RequestService.ts` — `update<Type>Request` (PATCH).
- `src/shared/services/<grandchild>Service.ts` — `update`/`delete` where collections exist (e.g. `pblBidderService`).
- `.powerpages-site/table-permissions/*` — `delete: true` for removable child tables.

## Open items to confirm during implementation
- Exact reverse field mapping per type (use `mapping.md`; ask the user if a logical name isn't there).
- Which matter types besides PBL have removable child collections (drives which permissions need `delete: true`).
- Whether to ship the optional unsaved-changes prompt in v1.
```
