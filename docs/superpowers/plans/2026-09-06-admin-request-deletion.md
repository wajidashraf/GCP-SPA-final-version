# Administrator Request Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Administrators delete a parent request, its matter-specific child, and PBL bidders through the same-origin Power Pages Web API with explicit confirmation and least-privilege metadata.

**Architecture:** Centralize verified child entity-set metadata, implement a retry-safe sequential deletion service over `powerPagesFetch`, and expose it through an Administrator-only Requests-row action. Power Pages table permissions—not the React role check—authorize every read and delete.

**Tech Stack:** React 18, React Bootstrap Modal, strict TypeScript, Power Pages Web API, Dataverse table-permission YAML, Node test runner.

## Global Constraints

- Delete only `gcp_request`, its matter-specific child, and PBL bidders.
- Do not delete SharePoint files, engagements, suggestions, signatures, or audit/workflow rows.
- Do not change Dataverse relationships or cascade behavior.
- Reuse the existing Administrators web-role GUID `f48675b4-13bf-459d-8a1d-f9a42f468dba`.
- Do not grant Delete to Requestor or Authenticated Users.
- Treat the multi-call operation as non-transactional and report partial failure truthfully.
- Do not deploy or commit without explicit user authorization.

---

### Task 1: Centralize verified request-child metadata

**Files:**
- Create: `src/shared/requestChildSources.ts`
- Modify: `src/shared/services/requestIntegrityService.ts`
- Create: `tests/requestChildSources.test.ts`

**Interfaces:**
- Produces: `RequestChildSource { entitySet; logicalName; idField; parentField }`
- Produces: `REQUEST_CHILD_SOURCE_BY_KIND: Record<ChildKind, RequestChildSource>`
- Produces: `PBL_BIDDER_SOURCE`
- Consumes: existing `ChildKind` from `src/shared/requestIntegrity.ts`

- [ ] **Step 1: Write the failing metadata test**

Assert all 13 kinds and exact primary IDs:

```ts
assert.deepEqual(REQUEST_CHILD_SOURCE_BY_KIND.other, {
  entitySet: 'gcp_otherrequestses',
  logicalName: 'gcp_otherrequests',
  idField: 'gcp_otherrequestsid',
  parentField: '_gcp_requestlookup_value',
});
assert.deepEqual(PBL_BIDDER_SOURCE, {
  entitySet: 'gcp_pblbidderses',
  logicalName: 'gcp_pblbidders',
  idField: 'gcp_pblbiddersid',
  parentField: '_gcp_pblrequest_value',
});
assert.equal(Object.keys(REQUEST_CHILD_SOURCE_BY_KIND).length, 13);
```

The complete source table must use these triples:

```ts
rtp:   ['gcp_rtprequests', 'gcp_rtprequest', 'gcp_rtprequestid'],
pbl:   ['gcp_pblrequests', 'gcp_pblrequest', 'gcp_pblrequestid'],
jvp:   ['gcp_jvmrequests', 'gcp_jvmrequest', 'gcp_jvmrequestid'],
stsp:  ['gcp_stsprequests', 'gcp_stsprequest', 'gcp_stsprequestid'],
caa:   ['gcp_caarequests', 'gcp_caarequest', 'gcp_caarequestid'],
pcca:  ['gcp_pccarequests', 'gcp_pccarequest', 'gcp_pccarequestid'],
pp:    ['gcp_pprequests', 'gcp_pprequest', 'gcp_pprequestid'],
vap:   ['gcp_vaprequests', 'gcp_vaprequest', 'gcp_vaprequestid'],
other: ['gcp_otherrequestses', 'gcp_otherrequests', 'gcp_otherrequestsid'],
rpcca: ['gcp_rpccarequestgcps', 'gcp_rpccarequestgcp', 'gcp_rpccarequestgcpid'],
rpp:   ['gcp_rpprequests', 'gcp_rpprequest', 'gcp_rpprequestid'],
ci:    ['gcp_requestcigcps', 'gcp_requestcigcp', 'gcp_requestcigcpid'],
cpr:   ['gcp_cprrequestgcps', 'gcp_cprrequestgcp', 'gcp_cprrequestgcpid'],
```

All use `_gcp_request_value` except `other`.

- [ ] **Step 2: Run the test and verify failure**

Run: `node --test tests/requestChildSources.test.ts`

Expected: FAIL because the new module does not exist.

- [ ] **Step 3: Create the typed source module and consume it from integrity checks**

Move `SOURCE_BY_KIND` and `PBL_BIDDER_SOURCE` out of
`requestIntegrityService.ts`, add logical and ID fields, export them from the new
module, and update integrity imports without changing query behavior.

- [ ] **Step 4: Run integrity and source tests**

Run:

```powershell
node --test tests/requestChildSources.test.ts tests/requestIntegrity.test.ts
```

Expected: PASS.

### Task 2: Implement the tested deletion service

**Files:**
- Create: `src/shared/services/requestDeletionService.ts`
- Create: `tests/requestDeletion.test.ts`

**Interfaces:**
- Produces: `deleteRequestTree(request: Pick<GcpRequest, 'id' | 'soaCode' | 'matter'>, io?: RequestDeletionIo): Promise<DeleteRequestResult>`
- Produces: `canDeleteRequests(roles: readonly string[]): boolean`
- Produces: `DeleteRequestResult { deletedBidders: number; deletedChildren: number; parentDeleted: true }`

- [ ] **Step 1: Write failing orchestration tests with injected I/O**

Define fake `listIds` and `deleteRecord` functions and assert:

```ts
assert.deepEqual(events, [
  'list:gcp_pblrequests:request-1',
  'list:gcp_pblbidderses:pbl-1',
  'delete:gcp_pblbidderses:bidder-1',
  'delete:gcp_pblrequests:pbl-1',
  'delete:gcp_requests:request-1',
]);
```

Also test a non-PBL route, no child rows, an unsupported request failing before
mutation, 404 delete errors continuing, non-404 errors stopping before parent,
and case-insensitive Administrator role matching:

```ts
assert.equal(canDeleteRequests(['Administrators']), true);
assert.equal(canDeleteRequests([' administrators ']), true);
assert.equal(canDeleteRequests(['Requestor']), false);
```

- [ ] **Step 2: Run the deletion test and verify failure**

Run: `node --test tests/requestDeletion.test.ts`

Expected: FAIL because the service is absent.

- [ ] **Step 3: Implement pure orchestration and real Power Pages I/O**

Use this dependency boundary:

```ts
type RequestDeletionIo = {
  listIds: (source: RequestChildSource, parentId: string) => Promise<string[]>;
  deleteRecord: (entitySet: string, id: string) => Promise<void>;
  isNotFound: (error: unknown) => boolean;
};
```

The real `listIds` must use `buildODataQuery`, select only
`source.idField`, filter on `source.parentField`, follow `@odata.nextLink`, and
return non-empty IDs. The real delete calls:

```ts
await powerPagesFetch<void>(`/_api/${entitySet}(${id})`, { method: 'DELETE' });
```

Implement `safeDelete` so only `WebApiError` status 404 is swallowed. Resolve
the kind with `resolveChildKind`, run PBL bidder reads/deletes first, then direct
children, then `gcp_requests`. Wrap thrown errors in a `RequestDeletionError`
carrying stage `'bidders' | 'child' | 'parent'` and a user-safe message while
retaining the original error as `cause`.

- [ ] **Step 4: Run service tests**

Run:

```powershell
node --test tests/requestDeletion.test.ts tests/requestIntegrity.test.ts
```

Expected: PASS.

### Task 3: Add least-privilege Administrator delete permissions

**Files:**
- Modify: `.powerpages-site/table-permissions/Request-Admin-Global-Access.tablepermission.yml`
- Create: 14 `*-Admin-Delete.tablepermission.yml` files listed below
- Create: `tests/requestDeletePermissions.test.ts`

**Interfaces:**
- Produces: Global Read/Delete access for Administrators on each scoped child table
- Preserves: all existing Requestor permissions unchanged

- [ ] **Step 1: Write the failing metadata test**

Read YAML using the existing `readYamlScalar` pattern. Assert parent `delete` is
`true`. For every new file, assert `read: true`, `delete: true`, `create: false`,
`write: false`, `append: false`, `appendto: false`, `scope: 756150000`, and only
the Administrator GUID appears under `adx_entitypermission_webrole`.

Use this exact manifest:

| File stem | ID | Logical name |
|---|---|---|
| RTP-Request-Admin-Delete | `a750d842-6b16-487f-b8fc-343614afd4a7` | `gcp_rtprequest` |
| PBL-Request-Admin-Delete | `8238330c-cf72-4f55-865d-a2bd69af64f7` | `gcp_pblrequest` |
| JVP-Request-Admin-Delete | `56144b3d-7534-4652-bbfd-7c96d488428d` | `gcp_jvmrequest` |
| STSP-Request-Admin-Delete | `1c0c10f8-9ac8-45ab-ab28-b6a41d15e0ee` | `gcp_stsprequest` |
| CAA-Request-Admin-Delete | `c3e994b2-8898-4d1c-8a5c-65722fb3460d` | `gcp_caarequest` |
| PCCA-Request-Admin-Delete | `4e290eab-88bb-425e-a0f3-52c44325e299` | `gcp_pccarequest` |
| PP-Request-Admin-Delete | `ebf64b6c-885d-472e-93c3-c2403e1513b2` | `gcp_pprequest` |
| VAP-Request-Admin-Delete | `f22e3b12-7aff-449b-803e-f580d1a5d4c9` | `gcp_vaprequest` |
| Other-Request-Admin-Delete | `85c926ea-10f0-4697-a593-2792cd77113f` | `gcp_otherrequests` |
| RPCCA-Request-Admin-Delete | `13fc2d33-ed78-4962-9896-f59609d90134` | `gcp_rpccarequestgcp` |
| RPP-Request-Admin-Delete | `265ef945-9773-4219-8907-a5982e94c947` | `gcp_rpprequest` |
| CI-Request-Admin-Delete | `26c78460-c99d-4968-ba59-c8f967ce3daa` | `gcp_requestcigcp` |
| CPR-Request-Admin-Delete | `928fa51e-eaac-46df-8073-429aad6af130` | `gcp_cprrequestgcp` |
| PBL-Bidders-Admin-Delete | `c9f51923-03f0-4482-878e-afad6fb99499` | `gcp_pblbidders` |

- [ ] **Step 2: Run the permission test and verify failure**

Run: `node --test tests/requestDeletePermissions.test.ts`

Expected: FAIL because parent delete is false and child permission files are absent.

- [ ] **Step 3: Create exact permission metadata**

Set parent `delete: true`. Each new YAML file uses its row above and this exact
privilege shape:

```yaml
adx_entitypermission_webrole:
- f48675b4-13bf-459d-8a1d-f9a42f468dba
append: false
appendto: false
create: false
delete: true
entitylogicalname: gcp_rtprequest
entityname: RTP Request - Admin Delete
id: a750d842-6b16-487f-b8fc-343614afd4a7
read: true
scope: 756150000
write: false
```

For each remaining manifest row, use its exact logical name and ID; set
`entityname` to the file stem with hyphens replaced by spaces. Do not modify the
existing Requestor permission files.

- [ ] **Step 4: Run metadata tests**

Run: `node --test tests/requestDeletePermissions.test.ts`

Expected: PASS.

### Task 4: Add the Requests-row action and confirmation modal

**Files:**
- Create: `src/components/requests/DeleteRequestModal.tsx`
- Modify: `src/pages/Requests.tsx`
- Modify: `src/styles/theme.css`

**Interfaces:**
- Consumes: `canDeleteRequests(user?.roles ?? [])`
- Consumes: `deleteRequestTree(target)`
- Consumes: `useRequests().refetch()`

- [ ] **Step 1: Build the focused modal component**

Use props:

```ts
type DeleteRequestModalProps = {
  target: { request: GcpRequest; matterLabel: string } | null;
  isDeleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};
```

Use React Bootstrap `Modal` and `Button`, a `TriangleAlert` icon, `backdrop="static"`
and `keyboard={!isDeleting}`. The confirm label is `Delete request`; while busy
show `Spinner` and `Deleting…`. Render the approved scope statement and an
`InlineMessage` for errors. Disable close/cancel/confirm appropriately.

- [ ] **Step 2: Wire Administrator-only deletion into Requests**

Import `useAuth`, `Trash2`, the modal, and deletion service. Add state for target,
deleting, and delete error. Destructure `refetch` from `useRequests`.

Render the trash action only when:

```ts
const canDelete = canDeleteRequests(user?.roles ?? []);
```

Put View/Edit and Delete inside `.rq-row-actions`. Both stop propagation. Delete
sets the modal target with the full request and matter label. Confirm calls
`deleteRequestTree`, then awaits `refetch`, clears the target, and leaves URL
search parameters untouched. On error, keep the modal open and show the
`RequestDeletionError.message`.

- [ ] **Step 3: Style the action group and destructive button**

Keep the existing open button dimensions. Add `.rq-delete-btn` as a 32–38px
icon button using the existing danger red, visible focus outline, and disabled
state. Expand `.col-action` enough for both actions and rebalance adjacent column
percentages without hiding table content.

- [ ] **Step 4: Run all affected checks**

Run:

```powershell
node --test tests/requestChildSources.test.ts tests/requestIntegrity.test.ts tests/requestDeletion.test.ts tests/requestDeletePermissions.test.ts tests/requestListPresentation.test.ts
npm run build
```

Expected: all tests pass and the SPA build succeeds.

- [ ] **Step 5: Commit only if explicitly authorized**

```powershell
git add src/shared/requestChildSources.ts src/shared/services/requestIntegrityService.ts src/shared/services/requestDeletionService.ts src/components/requests/DeleteRequestModal.tsx src/pages/Requests.tsx src/styles/theme.css tests/requestChildSources.test.ts tests/requestDeletion.test.ts tests/requestDeletePermissions.test.ts .powerpages-site/table-permissions
git commit -m "feat: add administrator request deletion"
```

### Task 5: Record the security-sensitive architecture change

**Files:**
- Modify: `PROJECT_CONTEXT_REPORT.md`

- [ ] **Step 1: Add a dated durable decision**

Document that Administrator deletion uses same-origin Power Pages Web API,
Administrator-only Global Read/Delete child permissions, sequential PBL
bidder/child/parent ordering, 404 idempotency, non-transactional partial-failure
reporting, and explicit exclusion of SharePoint/workflow data.

- [ ] **Step 2: Verify documentation and worktree state**

Run:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors and only planned files changed.
