# Project Web API Logical-Name Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the checked-in Project Power Pages Web API site settings use the authoritative `gcp_projects` logical table name so production Project lookups survive deployment.

**Architecture:** Preserve the existing Power Pages site-setting records and correct only their key names. Keep the frontend on the independently verified Dataverse entity set `gcp_projectses`, then add a metadata regression test that detects future logical-name/entity-set drift.

**Tech Stack:** Power Pages metadata YAML, React 18/TypeScript, Node built-in test runner, Vite.

## Global Constraints

- Preserve site-setting IDs `693f56e8-f84f-45e6-9c7f-2e10e5484a29` and `de8ac975-1c61-4f48-bc61-246a990a1f22`.
- Use `gcp_projects` only as the Project table logical name in Web API site-setting keys.
- Keep `gcp_projectses` as the Dataverse EntitySetName used in `/_api` URLs and lookup binds.
- Do not create or change Dataverse tables, columns, relationships, permissions, choices, or entity-set names.
- Preserve all unrelated and pre-existing worktree changes.
- Do not upload, restart, commit, or push without separate explicit authorization.

---

## File Structure

- Create `tests/projectWebApiSettings.test.ts`: regression checks across Project table-permission, site-setting, and frontend-service metadata.
- Modify `.powerpages-site/site-settings/Webapi-gcp_project-enabled.sitesetting.yml`: correct the enabled key and description while retaining its ID/value.
- Modify `.powerpages-site/site-settings/Webapi-gcp_project-fields.sitesetting.yml`: correct the fields key and description while retaining its ID/value.
- Modify `src/shared/services/projectService.ts`: correct comments describing the logical name; keep executable entity-set code unchanged.
- Modify `src/types/project.ts`: correct the documented logical name.
- Modify `src/types/request.ts`: correct the documented Project lookup entity set to `gcp_projectses`.
- Modify `mapping.md`: correct the Project table logical-name note while retaining the existing entity-set mapping.
- Modify `package.json`: add the focused `test:project-webapi-settings` command.

### Task 1: Protect and correct Project Web API metadata

**Files:**

- Create: `tests/projectWebApiSettings.test.ts`
- Modify: `.powerpages-site/site-settings/Webapi-gcp_project-enabled.sitesetting.yml`
- Modify: `.powerpages-site/site-settings/Webapi-gcp_project-fields.sitesetting.yml`
- Modify: `src/shared/services/projectService.ts`
- Modify: `src/types/project.ts`
- Modify: `src/types/request.ts`
- Modify: `mapping.md`
- Modify: `package.json`

**Interfaces:**

- Consumes: `entitylogicalname` from `Project-Global-Access.tablepermission.yml`.
- Enforces: `Webapi/<entitylogicalname>/enabled` and `Webapi/<entitylogicalname>/fields`.
- Preserves: `PROJECT_ENTITY_SET = 'gcp_projectses'` and `/_api/gcp_projectses` behavior.

- [ ] **Step 1: Write the failing metadata regression test**

Create `tests/projectWebApiSettings.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryPath = (relativePath: string): string =>
  fileURLToPath(new URL(`../${relativePath}`, import.meta.url));

const readRepositoryFile = (relativePath: string): string =>
  readFileSync(repositoryPath(relativePath), 'utf8');

const readYamlScalar = (source: string, key: string): string => {
  const match = source.match(new RegExp(`^${key}:\\s*['\"]?([^'\"\\r\\n]+)['\"]?\\s*$`, 'm'));
  assert.ok(match, `Expected ${key} in YAML metadata`);
  return match[1].trim();
};

test('Project Web API settings use the table-permission logical name', () => {
  const permission = readRepositoryFile(
    '.powerpages-site/table-permissions/Project-Global-Access.tablepermission.yml',
  );
  const logicalName = readYamlScalar(permission, 'entitylogicalname');
  assert.equal(logicalName, 'gcp_projects');

  const enabled = readRepositoryFile(
    '.powerpages-site/site-settings/Webapi-gcp_project-enabled.sitesetting.yml',
  );
  const fields = readRepositoryFile(
    '.powerpages-site/site-settings/Webapi-gcp_project-fields.sitesetting.yml',
  );

  assert.equal(
    readYamlScalar(enabled, 'name'),
    `Webapi/${logicalName}/enabled`,
  );
  assert.equal(
    readYamlScalar(fields, 'name'),
    `Webapi/${logicalName}/fields`,
  );
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --test tests/projectWebApiSettings.test.ts
```

Expected: the test fails because the checked-in names are currently
`Webapi/gcp_project/enabled` and `Webapi/gcp_project/fields`.

- [ ] **Step 3: Apply the minimal site-setting correction**

Update the existing records without changing IDs or values:

```yaml
# Webapi-gcp_project-enabled.sitesetting.yml
description: Enable Web API access for gcp_projects table
id: 693f56e8-f84f-45e6-9c7f-2e10e5484a29
name: Webapi/gcp_projects/enabled
value: true
```

```yaml
# Webapi-gcp_project-fields.sitesetting.yml
description: Allowed fields for gcp_projects Web API access
id: de8ac975-1c61-4f48-bc61-246a990a1f22
name: Webapi/gcp_projects/fields
value: '*'
```

- [ ] **Step 4: Correct nearby documentation without changing runtime code**

Make these exact documentation corrections:

- In `src/shared/services/projectService.ts`, describe the table and setting as
  `gcp_projects` while leaving `const ENTITY_SET = 'gcp_projectses';` unchanged.
- In `src/types/project.ts`, change the logical-name comment to
  `Logical name: gcp_projects | Entity set: gcp_projectses | PK: gcp_projectsid`.
- In `src/types/request.ts`, change the Project lookup comment from
  `gcp_projects(<guid>)` to `gcp_projectses(<guid>)` because lookup binds use the
  entity-set name.
- In `mapping.md`, change the RTP stub-table note from `gcp_project` to
  `gcp_projects`; keep every `gcp_projectses` lookup mapping unchanged.

- [ ] **Step 5: Add the focused package script**

Add to `package.json` scripts:

```json
"test:project-webapi-settings": "node --test tests/projectWebApiSettings.test.ts"
```

- [ ] **Step 6: Run the focused test and verify GREEN**

Run:

```powershell
npm run test:project-webapi-settings
```

Expected: the metadata consistency test passes.

- [ ] **Step 7: Run all authored focused tests**

Run:

```powershell
node --test `
  tests/acceptReviewPayload.test.ts `
  tests/dashboardPipeline.test.ts `
  tests/hocAcceptanceConclusions.test.ts `
  tests/letterTemplates.test.ts `
  tests/projectWebApiSettings.test.ts `
  tests/requestEditPolicy.test.ts `
  tests/requestListState.test.ts `
  tests/reviewComments.test.ts
```

Expected: every discovered test passes with zero failures.

- [ ] **Step 8: Build the production SPA**

Run:

```powershell
npm run build
```

Expected: TypeScript and Vite complete successfully. The existing Vite
large-chunk warning is non-blocking.

- [ ] **Step 9: Review the prepared deployment diff and stop**

Run:

```powershell
git diff --check
git status --short --branch
git diff -- `
  .powerpages-site/site-settings/Webapi-gcp_project-enabled.sitesetting.yml `
  .powerpages-site/site-settings/Webapi-gcp_project-fields.sitesetting.yml `
  src/shared/services/projectService.ts `
  src/types/project.ts `
  src/types/request.ts `
  mapping.md `
  package.json `
  tests/projectWebApiSettings.test.ts
```

Expected: only the approved correction plus pre-existing unrelated changes are
present. Do not upload, restart, commit, or push.
