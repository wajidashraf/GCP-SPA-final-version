# Combined 100 MiB Upload Quota Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow up to 100 MiB of newly selected files across every upload field in one request while blocking over-quota, pending, or failed submissions.

**Architecture:** Put byte arithmetic and readiness decisions in a pure shared module. Keep file collections owned by each matter form, compute a form-wide total explicitly from those collections, and pass that total into every shared `FileUpload`; retain the existing one-file multipart Function endpoint and Graph upload sessions.

**Tech Stack:** React 18, strict TypeScript, XMLHttpRequest upload progress, Azure Functions Node v4, Microsoft Graph upload sessions, Node test runner.

## Global Constraints

- The limit is exactly `100 * 1024 * 1024` bytes across newly selected files.
- Existing persisted SharePoint documents do not count in edit mode.
- Do not change `gcp_documentsurl` JSON or Dataverse mappings.
- Do not delete remote SharePoint files when a selection is removed.
- Keep the existing Graph 5 MiB chunking implementation.
- Deployed Function App setting changes require separate explicit authorization.
- Do not deploy or commit without explicit user authorization.

---

### Task 1: Implement tested quota and readiness helpers

**Files:**
- Create: `src/shared/uploadQuota.ts`
- Create: `tests/uploadQuota.test.ts`

**Interfaces:**
- Produces: `MAX_REQUEST_UPLOAD_BYTES = 104857600`
- Produces: `sumUploadBytes(groups): number`
- Produces: `checkUploadAddition(currentBytes, incomingBytes, maxBytes): UploadQuotaDecision`
- Produces: `checkUploadReplacement(currentBytes, previousBytes, replacementBytes, maxBytes): UploadQuotaDecision`
- Produces: `formatUploadBytes(bytes): string`
- Produces: `formatQuotaExceededMessage(currentBytes, incomingBytes, maxBytes): string`
- Produces: `getUploadReadiness(groups): UploadReadiness`
- Produces: `assertUploadsReady(groups): void`

- [ ] **Step 1: Write failing quota boundary tests**

Use small `UploadFileLike` fixtures and test:

```ts
assert.equal(MAX_REQUEST_UPLOAD_BYTES, 100 * 1024 * 1024);
assert.deepEqual(
  checkUploadAddition(70 * MIB, 30 * MIB, MAX_REQUEST_UPLOAD_BYTES),
  { allowed: true, nextBytes: 100 * MIB, remainingBytes: 0 },
);
assert.deepEqual(
  checkUploadAddition(70 * MIB, 30 * MIB + 1, MAX_REQUEST_UPLOAD_BYTES),
  { allowed: false, nextBytes: 100 * MIB + 1, remainingBytes: 30 * MIB },
);
assert.equal(
  checkUploadReplacement(90 * MIB, 20 * MIB, 30 * MIB, MAX_REQUEST_UPLOAD_BYTES).allowed,
  true,
);
```

Test summing three groups, empty groups, pending progress, an error, progress 100
without URL, and all completed files with URLs. Assert `assertUploadsReady`
throws the exact readiness message for non-ready states.

- [ ] **Step 2: Run the test and verify failure**

Run: `node --test tests/uploadQuota.test.ts`

Expected: FAIL because `uploadQuota.ts` is absent.

- [ ] **Step 3: Implement the pure module**

Use structural types so the helper does not depend on React:

```ts
type UploadFileLike = {
  file: { size: number };
  progress: number;
  error?: string;
  url?: string;
};

type UploadQuotaDecision = {
  allowed: boolean;
  nextBytes: number;
  remainingBytes: number;
};

type UploadReadiness = {
  ready: boolean;
  message: string | null;
};
```

Calculate allowed remaining bytes as `Math.max(0, maxBytes - nextBytes)` and
rejected remaining capacity as `Math.max(0, maxBytes - currentBytes)`.
`getUploadReadiness` prioritizes upload errors,
then pending uploads, then missing URLs, returning these messages:

```ts
'Remove or retry failed uploads before submitting.'
'Wait for all files to finish uploading before submitting.'
'One or more completed uploads is missing its SharePoint link.'
```

- [ ] **Step 4: Run the focused test**

Run: `node --test tests/uploadQuota.test.ts`

Expected: PASS.

### Task 2: Enforce form-wide quota before upload begins

**Files:**
- Modify: `src/forms/FileUpload.tsx`
- Modify: `src/forms/index.ts`
- Modify: `tests/uploadQuota.test.ts`

**Interfaces:**
- Adds `FileUploadProps.currentTotalBytes?: number`
- Adds `FileUploadProps.maxTotalBytes?: number`
- Defaults `maxFileSize` and `maxTotalBytes` to `MAX_REQUEST_UPLOAD_BYTES`

- [ ] **Step 1: Extend pure tests for selection and replacement messages**

Add a formatter assertion such as:

```ts
assert.equal(
  formatQuotaExceededMessage(90 * MIB, 15 * MIB, 100 * MIB),
  'These files would use 105.0 MiB. The combined limit is 100 MiB, with 10.0 MiB remaining.',
);
```

- [ ] **Step 2: Update FileUpload props and defaults**

Import quota helpers and add local `quotaError`. For ordinary additions, apply
the quota only to the `accepted` slice after `maxFiles` truncation:

```ts
const incomingBytes = accepted.reduce((sum, file) => sum + file.size, 0);
const currentBytes = effectiveTotalBytes;
const decision = checkUploadAddition(
  currentBytes,
  incomingBytes,
  maxTotalBytes,
);
if (!decision.allowed) {
  setQuotaError(formatQuotaExceededMessage(currentBytes, incomingBytes, maxTotalBytes));
  return;
}
```

Set `effectiveTotalBytes` once per render:

```ts
const effectiveTotalBytes =
  currentTotalBytes ?? sumUploadBytes([filesRef.current]);
```

For replacement, find the previous file and use `checkUploadReplacement` before
changing state or starting the uploader. Clear quota error after a successful
addition/replacement or removal. Do not create error chips for a rejected
over-quota selection because the approved behavior rejects the selection as a
whole.

Display:

```tsx
<p style={styles.hint}>
  Allowed: PDF, Word, Excel, JPG, PNG. Combined usage:{' '}
  {formatUploadBytes(effectiveTotalBytes)} of {formatUploadBytes(maxTotalBytes)}.
</p>
```

Render `quotaError` as a `role="alert"` banner. Preserve MIME validation,
file-count behavior, previewing, progress, replacement, and removal.

- [ ] **Step 3: Export quota types/constants and run checks**

Export the new helpers from `src/forms/index.ts` only if forms import through the
form barrel; otherwise import directly from `src/shared/uploadQuota.ts` and keep
the form barrel limited to components/types.

Run:

```powershell
node --test tests/uploadQuota.test.ts
npm run build
```

Expected: tests and build pass.

### Task 3: Integrate quota and readiness into all matter forms

**Files:**
- Modify: `src/forms/rtp/RtpForm.tsx`
- Modify: `src/forms/pbl/PblForm.tsx`
- Modify: `src/forms/jvp/JvpForm.tsx`
- Modify: `src/forms/stsp/StspForm.tsx`
- Modify: `src/forms/caa/CaaForm.tsx`
- Modify: `src/forms/pcca/PccaForm.tsx`
- Modify: `src/forms/pp/PpForm.tsx`
- Modify: `src/forms/vap/VapForm.tsx`
- Modify: `src/forms/others/OthersForm.tsx`
- Modify: `src/forms/cpr/CprForm.tsx`
- Modify: `src/forms/ci/CiForm.tsx`
- Modify: `src/forms/rpcca/RpccaForm.tsx`
- Modify: `src/forms/rpp/RppForm.tsx`

**Interfaces:**
- Consumes: `sumUploadBytes`, `getUploadReadiness`, `assertUploadsReady`, `MAX_REQUEST_UPLOAD_BYTES`
- Supplies: identical `currentTotalBytes` and `maxTotalBytes` to every FileUpload in one form

- [ ] **Step 1: Add explicit group totals**

Use these exact group arrays:

```ts
// RTP, PBL, PCCA, PP, VAP, Others, CPR, CI, R-PCCA, R-PP
const uploadGroups = [attachments] as const;

// CAA
const uploadGroups = [orgChartFiles, attachments] as const;

// ST/SP
const uploadGroups = [contractStructureFiles, attachments] as const;

// JVP
const uploadGroups = [cashflowFiles, costStructureFiles, attachments] as const;
```

For every form compute:

```ts
const currentUploadBytes = sumUploadBytes(uploadGroups);
const uploadReadiness = getUploadReadiness(uploadGroups);
```

Pass to every control:

```tsx
currentTotalBytes={currentUploadBytes}
maxTotalBytes={MAX_REQUEST_UPLOAD_BYTES}
```

- [ ] **Step 2: Block final-step progression and direct submission**

In each document/final-step `validate`, preserve existing acknowledgement and
business validation, then return `uploadReadiness.message` when non-null.

At the first line of every `handleSubmit`, before `setSubmitting(true)` and
before any Dataverse write, call:

```ts
assertUploadsReady(uploadGroups);
```

This second guard prevents a stale render or direct handler invocation from
persisting only the subset with URLs.

- [ ] **Step 3: Verify all 17 FileUpload instances carry the shared quota**

Run:

```powershell
rg -n "<FileUpload|currentTotalBytes|maxTotalBytes" src/forms -g "*Form.tsx"
```

Expected: every `FileUpload` occurrence in the 13 matter forms has both props;
CAA has two, ST/SP has two, JVP has three, and the other ten have one each.

- [ ] **Step 4: Run tests and the SPA build**

Run:

```powershell
node --test tests/*.test.ts
npm run build
```

Expected: all Node tests pass and the production SPA build succeeds.

- [ ] **Step 5: Commit only if explicitly authorized**

```powershell
git add src/shared/uploadQuota.ts src/forms/FileUpload.tsx src/forms/index.ts src/forms/rtp/RtpForm.tsx src/forms/pbl/PblForm.tsx src/forms/jvp/JvpForm.tsx src/forms/stsp/StspForm.tsx src/forms/caa/CaaForm.tsx src/forms/pcca/PccaForm.tsx src/forms/pp/PpForm.tsx src/forms/vap/VapForm.tsx src/forms/others/OthersForm.tsx src/forms/cpr/CprForm.tsx src/forms/ci/CiForm.tsx src/forms/rpcca/RpccaForm.tsx src/forms/rpp/RppForm.tsx tests/uploadQuota.test.ts
git commit -m "feat: enforce combined request upload quota"
```

### Task 4: Align Function validation and documented runtime settings

**Files:**
- Modify: `api/src/config.ts`
- Modify: `api/local.settings.json.example`
- Modify: `api/README.md`
- Create: `tests/uploadFunctionSettings.test.ts`

**Interfaces:**
- Sets default `MAX_FILE_BYTES` to `104857600`
- Documents required `FUNCTIONS_REQUEST_BODY_SIZE_LIMIT=125829120`

- [ ] **Step 1: Write the failing repository-settings test**

Read the three files and assert:

```ts
assert.match(config, /optional\('MAX_FILE_BYTES', '104857600'\)/);
assert.match(example, /"MAX_FILE_BYTES": "104857600"/);
assert.match(example, /"FUNCTIONS_REQUEST_BODY_SIZE_LIMIT": "125829120"/);
assert.match(readme, /100 MiB/);
assert.match(readme, /FUNCTIONS_REQUEST_BODY_SIZE_LIMIT/);
```

- [ ] **Step 2: Run the settings test and verify failure**

Run: `node --test tests/uploadFunctionSettings.test.ts`

Expected: FAIL because the repository still documents/defaults to 10 MiB.

- [ ] **Step 3: Update safe repository configuration**

Change the `getConfig()` fallback to `104857600`. In
`api/local.settings.json.example`, set:

```json
"MAX_FILE_BYTES": "104857600",
"FUNCTIONS_REQUEST_BODY_SIZE_LIMIT": "125829120"
```

Update the README settings table to define 100 MiB per incoming file, a 120 MiB
Function HTTP body ceiling for multipart overhead, and the need to verify plan
memory because the handler materializes FormData, ArrayBuffer, and Buffer.

Do not edit `api/local.settings.json`; it is machine-specific and may contain
secrets.

- [ ] **Step 4: Run frontend tests and both builds**

Run:

```powershell
node --test tests/uploadQuota.test.ts tests/uploadFunctionSettings.test.ts
npm run build
Set-Location api
npm run build
Set-Location ..
```

Expected: tests pass and both TypeScript builds succeed.

### Task 5: Record the upload architecture decision

**Files:**
- Modify: `PROJECT_CONTEXT_REPORT.md`

- [ ] **Step 1: Add the durable upload-quota decision**

Record the 100 MiB combined frontend quota, explicit parent-owned multi-field
totals, submission-readiness guard, 100 MiB Function file limit, 120 MiB request
body setting, existing Graph chunking, edit-mode exclusion of existing files,
and the requirement for GCP-Developer large-file smoke testing.

- [ ] **Step 2: Perform final local verification**

Run:

```powershell
node --test tests/*.test.ts
npm run build
Set-Location api
npm run build
Set-Location ..
git diff --check
git status --short
```

Expected: every test passes, both builds succeed, no whitespace errors appear,
and only the design, plan, and implementation files are modified.

- [ ] **Step 3: Prepare—but do not perform—the external configuration handoff**

Report that the GCP-Developer Function App still needs these settings applied
under separate authorization:

```text
MAX_FILE_BYTES=104857600
FUNCTIONS_REQUEST_BODY_SIZE_LIMIT=125829120
```

Do not deploy or change Azure settings in this task.
