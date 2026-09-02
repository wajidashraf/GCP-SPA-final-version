# Request List State and Submission Column Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add typed matter-title filtering, a Submission date second column, and reliable return-to-list state from Request Detail.

**Architecture:** A pure `requestListState` module owns filtering, URL state, date formatting, and safe return-path validation. The Requests and Request Detail pages consume those helpers without changing Dataverse access or schema.

**Tech Stack:** React 18, React Router 6, TypeScript, Vite, Node's built-in test runner.

## Global Constraints

- Keep the existing Matter type dropdown and add a separate `Matter title` text filter.
- Match the typed filter case-insensitively against both full matter labels and short codes.
- Add `Submission` as the second table column and display `gcp_submittedon` as `DD MMM YYYY` or `—`.
- Store page and all filters in the Requests URL query string.
- `Back to requests` returns to the validated originating Requests URL and otherwise falls back to `/requests`.
- Do not change Dataverse tables, columns, choices, permissions, or service selects.
- Preserve every pre-existing uncommitted change.
- Do not commit, push, deploy, restart, or regenerate checked-in Power Pages web files.

---

### Task 1: Build and test the pure request-list model

**Files:**
- Create: `src/shared/requestListState.ts`
- Create: `tests/requestListState.test.ts`

**Interfaces:**
- Produces: `RequestListFilters`, `RequestListState`, and `RequestMatterMeta`.
- Produces: `parseRequestListState(params: URLSearchParams): RequestListState`.
- Produces: `serializeRequestListState(state: RequestListState, submittedId?: string | null): URLSearchParams`.
- Produces: `filterRequestList(items, filters, matterMetaByValue)`.
- Produces: `formatSubmissionDate(value): string`.
- Produces: `getRequestsReturnPath(locationState: unknown): string`.

- [ ] **Step 1: Write failing behavioral tests**

Create tests that assert literal outcomes for:

```ts
filterRequestList(items, { matterTitle: 'pbl', project: '', company: '', status: '', matterType: '' }, meta)
// returns only the PBL request

parseRequestListState(new URLSearchParams('matterTitle=bidder&page=3'))
// returns page 3, matterTitle "bidder", and empty defaults for other filters

serializeRequestListState(state, 'REQ-1').toString()
// contains non-default state and preserves submitted=REQ-1

formatSubmissionDate('2026-08-24T02:00:00Z')
// "24 Aug 2026"

getRequestsReturnPath({ requestsReturnTo: '/requests?page=4&matterTitle=pbl' })
// exact path; invalid or absent state returns "/requests"
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/requestListState.test.ts`

Expected: FAIL because `src/shared/requestListState.ts` does not exist.

- [ ] **Step 3: Implement the minimal pure module**

Use query keys `matterTitle`, `project`, `company`, `status`, `type`, and `page`.
Only serialize non-empty filters and page values greater than 1. Preserve the
existing `submitted` identifier when provided. Validate page as a positive
integer.

Filter matter-title text against `${meta.label} ${meta.code}` in lowercase,
then apply the existing project, company, status, and exact matter-type checks.
Format valid dates with `Intl.DateTimeFormat('en-GB', { day: '2-digit', month:
'short', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' })`.

Accept a return path only when it is exactly `/requests` or begins
`/requests?`; reject all other strings.

- [ ] **Step 4: Run GREEN**

Run: `node --test tests/requestListState.test.ts`

Expected: all new request-list model tests PASS.

### Task 2: Integrate Requests and Request Detail

**Files:**
- Modify: `src/pages/Requests.tsx`
- Modify: `src/pages/RequestDetail.tsx`
- Modify: `src/styles/theme.css`
- Modify: `package.json`
- Modify: `userguide.md`

**Interfaces:**
- Consumes all Task 1 helpers.
- Router state shape: `{ requestsReturnTo: string }`.

- [ ] **Step 1: Make URL parameters the list-state source**

Replace local page/filter state with `parseRequestListState(searchParams)`.
Use `setSearchParams(..., { replace: true })` for filter and pagination updates.
Reset `page` to 1 on every filter update and preserve `submittedId`.

- [ ] **Step 2: Add the Matter title text filter**

Render a `TextField` labeled `Matter title` with placeholder
`Search matter title...`. Keep the existing Matter type dropdown. Include the
new filter in active-filter detection and clearing.

- [ ] **Step 3: Add the Submission second column**

Insert `<th className="col-submission">Submission</th>` after Request no. and
render `formatSubmissionDate(r.submittedOn)` in the corresponding cell. Change
loading and empty-state `colSpan` values from 7 to 8.

Update column widths in `theme.css` to total 100% across eight columns:

```css
.col-req        { width: 11%; }
.col-submission { width: 10%; }
.col-matter     { width: 19%; }
.col-requester  { width: 17%; }
.col-project    { width: 12%; }
.col-company    { width: 13%; }
.col-status     { width: 10%; }
.col-action     { width: 8%; }
```

- [ ] **Step 4: Preserve and consume the return path**

In `Requests.tsx`, obtain `useLocation()` and navigate to detail with:

```ts
navigate(`/requests/${id}`, {
  state: { requestsReturnTo: `${location.pathname}${location.search}` },
});
```

In `RequestDetail.tsx`, obtain `useLocation()`, derive the path with
`getRequestsReturnPath(location.state)`, and make `Back to requests` navigate to
that path instead of `navigate(-1)`.

- [ ] **Step 5: Add test command and user documentation**

Add:

```json
"test:request-list": "node --test tests/requestListState.test.ts"
```

Update the Requests section of `userguide.md` with the Matter title filter,
Submission column, URL-backed state, and return-to-last-page behavior.

- [ ] **Step 6: Run focused and complete verification**

Run: `npm run test:request-list`

Run all files under `tests/` explicitly with `node --test`.

Run: `npm run build`

Expected: all tests and the TypeScript/Vite build PASS. The existing large
chunk warning remains non-blocking.

- [ ] **Step 7: Review without external actions**

Run `git diff --check`, inspect the intended source diff, and confirm all prior
uncommitted files remain. Stop without commit, push, deployment, restart, or
checked-in bundle regeneration.
