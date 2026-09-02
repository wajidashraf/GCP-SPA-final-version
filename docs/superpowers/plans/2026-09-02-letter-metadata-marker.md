# Letter Metadata Marker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent production WAF rejection of endorsement-letter PATCH requests while preserving re-editability of existing stored letters.

**Architecture:** Keep metadata embedded in the existing Dataverse memo field, replace the HTML-comment wrapper with a versioned plain-text suffix, and parse both the new and legacy representations. No API payload shape, schema, role, or permission changes are required.

**Tech Stack:** React 18, strict TypeScript, Node test runner, Vite, Power Pages Web API.

## Global Constraints

- Do not change Dataverse tables, columns, relationships, or choice values.
- Do not broaden Power Pages table permissions or web-role assignments.
- Preserve all unrelated and pre-existing working-tree changes.
- Do not deploy, commit, or push without separate user authorization.

---

### Task 1: Add persistence-format regression coverage

**Files:**
- Create: `src/components/letters/letterPersistence.ts`
- Modify: `tests/letterTemplates.test.ts`

**Interfaces:**
- Consumes: `serializeStoredLetter(letterText, payload)` and `parseStoredLetter(raw)` from `src/components/letters/letterPersistence.ts`.
- Produces: Regression coverage for `GCP_LETTER_METADATA_V2:` serialization and legacy `<!--GCP_LETTER:...-->` parsing through a Node-testable persistence boundary.

- [x] **Step 1: Add the failing tests**

```ts
test('serializes letter metadata without HTML comment syntax and round-trips V2', () => {
  const serialized = serializeStoredLetter('Endorsement body', {
    templateKey: 'e-test',
    values: { manual: 'Approved wording' },
  });

  assert.equal(serialized.includes('<!--GCP_LETTER:'), false);
  assert.match(serialized, /\n\nGCP_LETTER_METADATA_V2:/);
  assert.deepEqual(parseStoredLetter(serialized), {
    templateKey: 'e-test',
    values: { manual: 'Approved wording' },
  });
});

test('continues to parse legacy HTML-comment letter metadata', () => {
  const legacy =
    'Legacy body\n\n<!--GCP_LETTER:{"templateKey":"e-test","values":{"manual":"Legacy wording"}}-->';

  assert.deepEqual(parseStoredLetter(legacy), {
    templateKey: 'e-test',
    values: { manual: 'Legacy wording' },
  });
});
```

- [x] **Step 2: Run the focused test and verify the V2 assertion fails**

Run: `node --test tests/letterTemplates.test.ts`

Expected: FAIL because the new pure persistence module does not exist yet.

### Task 2: Implement backward-compatible V2 persistence

**Files:**
- Create: `src/components/letters/letterPersistence.ts`
- Modify: `src/components/letters/LetterDocument.tsx`
- Test: `tests/letterTemplates.test.ts`

**Interfaces:**
- Consumes: The existing `StoredLetter` shape `{ templateKey: string; values: Record<string, string> }`.
- Produces: `parseStoredLetter` support for V2 and legacy strings; `serializeStoredLetter` output ending in `GCP_LETTER_METADATA_V2:<json>`; unchanged `LetterDocument.tsx` exports for page consumers.

- [x] **Step 1: Introduce distinct V2 and legacy marker constants**

```ts
const MARKER_V2 = '\n\nGCP_LETTER_METADATA_V2:';
const LEGACY_MARKER = '\n\n<!--GCP_LETTER:';
const LEGACY_MARKER_END = '-->';
```

- [x] **Step 2: Parse V2 metadata first and fall back to the legacy format**

Extract JSON after `MARKER_V2` through the end of the string. Preserve the
existing legacy substring boundaries and malformed-input `null` behavior.

- [x] **Step 3: Serialize only the V2 representation**

```ts
export const serializeStoredLetter = (
  letterText: string,
  payload: StoredLetter,
): string => `${letterText}${MARKER_V2}${JSON.stringify(payload)}`;
```

Update `serializeLetter` in `LetterDocument.tsx` to pass the rendered human text
and its existing payload to `serializeStoredLetter`. Re-export
`parseStoredLetter` and `StoredLetter` so current page imports remain valid.

- [x] **Step 4: Run the focused test and verify it passes**

Run: `node --test tests/letterTemplates.test.ts`

Expected: all tests pass.

### Task 3: Record the production compatibility decision and verify the project

**Files:**
- Modify: `PROJECT_CONTEXT_REPORT.md`
- Modify: `docs/superpowers/specs/2026-09-02-letter-metadata-marker-design.md`

**Interfaces:**
- Consumes: The verified V2/legacy behavior from Tasks 1 and 2.
- Produces: Durable documentation of the WAF-safe persistence format and its backward compatibility.

- [x] **Step 1: Extend D-010 with the marker decision**

Document that new letter metadata uses `GCP_LETTER_METADATA_V2:`, legacy HTML-comment metadata remains readable, and the format avoids production edge rejection.

- [x] **Step 2: Mark the design implemented**

Change the design status to `Implemented; deployment pending` after tests pass.

- [x] **Step 3: Run all Node tests**

Run: `node --test tests/*.test.ts`

Expected: all tests pass with zero failures.

- [x] **Step 4: Run the production build**

Run: `npm run build`

Expected: TypeScript and Vite complete successfully.

- [x] **Step 5: Review the final diff**

Run: `git diff -- src/components/letters/LetterDocument.tsx tests/letterTemplates.test.ts PROJECT_CONTEXT_REPORT.md docs/superpowers/specs/2026-09-02-letter-metadata-marker-design.md docs/superpowers/plans/2026-09-02-letter-metadata-marker.md`

Expected: only the approved marker compatibility change, tests, and documentation appear within the reviewed paths.

Commits are intentionally omitted because repository instructions require explicit user authorization before committing.
