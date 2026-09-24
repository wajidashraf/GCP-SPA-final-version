# Request List Date Range Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an inclusive Malaysia-time submission-date range and reorganize the Requests filters into a responsive three-by-two layout.

**Architecture:** Keep filtering client-side over the records already loaded by `useRequests`. Put date normalization, range validation, Malaysia calendar-date extraction, filtering, and URL state in the existing pure `requestListState` module; keep React responsible only for controls, messages, and layout.

**Tech Stack:** React 18, strict TypeScript, React Router search parameters, React Bootstrap form primitives, Node test runner, Vite.

## Global Constraints

- Do not change Dataverse tables, columns, relationships, choices, permissions, or request queries.
- Use `gcp_submittedon` through the existing `GcpRequest.submittedOn` mapping.
- Date boundaries are inclusive calendar days in `Asia/Kuala_Lumpur`.
- Preserve the existing URL-as-list-state and client-side `Load more` behavior.
- Do not deploy or commit without explicit user authorization.

---

### Task 1: Add tested date-range state and filtering

**Files:**
- Modify: `tests/requestListState.test.ts`
- Modify: `src/shared/requestListState.ts`

**Interfaces:**
- Produces: `RequestListFilters.submittedFrom: string`
- Produces: `RequestListFilters.submittedTo: string`
- Produces: `getSubmissionDateRangeError(filters: Pick<RequestListFilters, 'submittedFrom' | 'submittedTo'>): string | null`
- Consumes: `FilterableRequest.submittedOn: string | null`

- [ ] **Step 1: Add failing state, validation, and filtering tests**

Add `submittedOn` values to the two request fixtures and extend the expected parsed state:

```ts
submittedFrom: '2026-08-20',
submittedTo: '2026-08-24',
```

Add these focused cases:

```ts
test('filters submission dates with inclusive Malaysia calendar-day boundaries', () => {
  const filters = {
    matterTitle: '', project: '', company: '', status: '', matterType: '',
    submittedFrom: '2026-08-24', submittedTo: '2026-08-24',
  };
  assert.deepEqual(
    filterRequestList(requests, filters, matterMetaByValue).map((r) => r.id),
    ['request-1'],
  );
});

test('supports either submission-date boundary independently', () => {
  const base = {
    matterTitle: '', project: '', company: '', status: '', matterType: '',
  };
  assert.deepEqual(
    filterRequestList(
      requests,
      { ...base, submittedFrom: '2026-08-25', submittedTo: '' },
      matterMetaByValue,
    ).map((r) => r.id),
    ['request-2'],
  );
  assert.deepEqual(
    filterRequestList(
      requests,
      { ...base, submittedFrom: '', submittedTo: '2026-08-24' },
      matterMetaByValue,
    ).map((r) => r.id),
    ['request-1'],
  );
});

test('reports reversed ranges and does not apply an invalid date constraint', () => {
  const filters = {
    matterTitle: '', project: '', company: '', status: '', matterType: '',
    submittedFrom: '2026-08-26', submittedTo: '2026-08-24',
  };
  assert.equal(
    getSubmissionDateRangeError(filters),
    'From date must be on or before To date.',
  );
  assert.deepEqual(
    filterRequestList(requests, filters, matterMetaByValue).map((r) => r.id),
    ['request-1', 'request-2'],
  );
});
```

Also assert malformed query dates parse to `''`, serialization emits
`submittedFrom=2026-08-20&submittedTo=2026-08-24`, and an active range excludes
requests whose `submittedOn` is null or invalid.

- [ ] **Step 2: Run the request-list tests and verify the new assertions fail**

Run: `node --test tests/requestListState.test.ts`

Expected: FAIL because date properties and `getSubmissionDateRangeError` are absent.

- [ ] **Step 3: Implement date normalization and comparison**

In `requestListState.ts`, add the properties to the interfaces and use strict
`YYYY-MM-DD` normalization:

```ts
const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const normalizeDateInput = (value: string | null | undefined): string => {
  const candidate = (value ?? '').trim();
  if (!DATE_INPUT_PATTERN.test(candidate)) return '';
  const date = new Date(`${candidate}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === candidate
    ? candidate
    : '';
};

const malaysiaDateKey = (value: string | null | undefined): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    timeZone: 'Asia/Kuala_Lumpur',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};
```

Implement and export:

```ts
export const getSubmissionDateRangeError = (
  filters: Pick<RequestListFilters, 'submittedFrom' | 'submittedTo'>,
): string | null => {
  const from = normalizeDateInput(filters.submittedFrom);
  const to = normalizeDateInput(filters.submittedTo);
  return from && to && from > to
    ? 'From date must be on or before To date.'
    : null;
};
```

Parse/serialize both query parameters. In `filterRequestList`, normalize both
boundaries, skip date filtering when the range error is non-null, otherwise
compare `malaysiaDateKey(request.submittedOn)` lexicographically with the active
inclusive boundaries.

- [ ] **Step 4: Run the focused tests**

Run: `node --test tests/requestListState.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit only if the user has explicitly authorized commits**

```powershell
git add tests/requestListState.test.ts src/shared/requestListState.ts
git commit -m "feat: add request submission date range filtering"
```

### Task 2: Render the two-row filter UI

**Files:**
- Modify: `src/pages/Requests.tsx`
- Modify: `src/styles/theme.css`

**Interfaces:**
- Consumes: `submittedFrom`, `submittedTo`, and `getSubmissionDateRangeError`
- Preserves: `updateListState(updates, true)` pagination reset behavior

- [ ] **Step 1: Wire date state and validation into Requests**

Import `DateField`, `CalendarRange`, and `getSubmissionDateRangeError`. Destructure
both dates from `listState`, include them in `hasActiveFilters`, and clear both in
`clearFilters`.

Compute:

```ts
const submissionDateRangeError = getSubmissionDateRangeError(listState);
```

Render the logical sixth filter as:

```tsx
<div className="rq-field rq-date-filter">
  <div className="rq-date-filter-label">
    <CalendarRange size={14} aria-hidden="true" />
    Submission date
  </div>
  <div className="rq-date-range">
    <DateField
      name="submittedFrom"
      label="From"
      value={submittedFrom}
      onChange={(e) => updateListState({ submittedFrom: e.target.value }, true)}
    />
    <DateField
      name="submittedTo"
      label="To"
      value={submittedTo}
      onChange={(e) => updateListState({ submittedTo: e.target.value }, true)}
    />
  </div>
  {submissionDateRangeError ? (
    <div className="rq-date-error" role="alert">
      {submissionDateRangeError}
    </div>
  ) : null}
</div>
```

Move the clear control into a new `.rq-filter-toolbar` immediately above
`.rq-filters`, use visible text `Clear filters`, and remove `mb-3` and the old
`.rq-clear-wrap` grid cell.

- [ ] **Step 2: Implement the balanced responsive layout**

Change desktop `.rq-filters` to:

```css
.rq-filters {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem 1rem;
}
.rq-date-range {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}
```

Add a two-column breakpoint below 860px and one-column breakpoint below 560px.
Style `.rq-filter-toolbar`, `.rq-date-filter-label`, and `.rq-date-error` using
the existing white/gold header palette. Keep all form controls 38px high and
remove obsolete `.rq-clear-wrap` rules.

- [ ] **Step 3: Run tests and the SPA build**

Run:

```powershell
node --test tests/requestListState.test.ts
npm run build
```

Expected: all tests pass and Vite completes without TypeScript errors.

- [ ] **Step 4: Inspect the production build locally**

Run the already-approved development command `npm run dev`, open `/requests`,
and verify three columns on desktop plus two/one-column wrapping. Localhost
cannot validate Power Pages data, but it can validate layout and accessibility.

- [ ] **Step 5: Commit only if explicitly authorized**

```powershell
git add src/pages/Requests.tsx src/styles/theme.css
git commit -m "feat: improve request list filter layout"
```
