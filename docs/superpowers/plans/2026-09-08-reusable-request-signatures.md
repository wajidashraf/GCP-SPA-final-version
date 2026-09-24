# Reusable Request Signatures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preview a signatory's latest saved image on each unsigned request and create a new request-specific signature only after explicit confirmation.

**Architecture:** Keep `gcp_signature` as the per-request signing-event table. Add a service query for the current user's latest reusable image, an idempotent confirmation operation that creates a new current-request row with the old URL, and explicit signed/preview/empty UI states in the existing signature box.

**Tech Stack:** React 18, strict TypeScript, Power Pages Web API/OData, Dataverse, Node's built-in test runner, CSS.

## Global Constraints

- Do not change the externally owned Dataverse schema, relationships, logical names, or choice values.
- A reusable preview never counts toward Prepared or Confirmed thresholds.
- Every confirmation creates a separate row linked to the current request with a new `createdon` value supplied by Dataverse.
- Preserve the current Draw and Upload behavior as the replacement path.
- Reuse the existing Power Pages API client and `gcp_signature` table service.
- Do not deploy, restart the site, commit, or push during this implementation.
- Preserve all unrelated worktree changes.

---

## File structure

- Modify `src/shared/services/signatureService.ts`: map request/contact IDs, build the latest-reusable query, and add idempotent saved-signature confirmation.
- Modify `src/components/signatures/SignatureSection.tsx`: load the signed-in member's preview and render/handle the three signature states.
- Modify `src/styles/requestDetail.css`: visually distinguish an unconfirmed saved image and support its two actions.
- Create `tests/signatureReuse.test.ts`: cover reusable-query identity rules and idempotent confirmation.
- Modify `package.json`: add the focused test command.
- Modify `PROJECT_CONTEXT_REPORT.md`: record the reusable-image/per-request-event decision.

---

### Task 1: Signature reuse service behavior

**Files:**

- Create: `tests/signatureReuse.test.ts`
- Modify: `src/shared/services/signatureService.ts`
- Modify: `package.json`

**Interface:**

```ts
type ReusableSignatureInput = {
  requestId: string;
  signatoryEmail: string;
  signatoryContactId: string | null;
};

const listLatestReusableSignature = async (
  input: ReusableSignatureInput,
): Promise<GcpSignature | null>;

type ConfirmReusableSignatureInput = CreateSignatureInput;

type ConfirmReusableSignatureResult = {
  signatureId: string | null;
  alreadySigned: boolean;
};

const confirmReusableSignature = async (
  input: ConfirmReusableSignatureInput,
  io?: SignatureConfirmationIo,
): Promise<ConfirmReusableSignatureResult>;
```

- [x] Write tests proving the reusable query excludes the current request, requires a non-empty URL, prefers contact lookup when available, falls back to escaped email, orders newest first, and requests one row.
- [x] Write tests proving confirmation creates a row when unsigned and returns `alreadySigned: true` without creating when the current request already contains the member email.
- [x] Run `node --test tests/signatureReuse.test.ts` and verify failure because the new exports do not exist.
- [x] Extend `GcpSignatureEntity`/`GcpSignature` with `_gcp_signatory_value`/`signatoryContactId` and `_gcp_request_value`/`requestId`.
- [x] Implement the latest-reusable OData query with `escapeODataString`, `createdon desc`, and `$top=1`.
- [x] Implement `confirmReusableSignature` with a request-signature recheck before delegating to `createSignature`.
- [x] Add `test:signature-reuse` to `package.json` and run it until all focused tests pass.

### Task 2: Saved preview and confirmation UI

**Files:**

- Modify: `src/components/signatures/SignatureSection.tsx`
- Modify: `src/styles/requestDetail.css`

**Behavior:**

```text
current request row -> signed image + date, no action
no current row + reusable row -> unconfirmed preview + Confirm Signature + Draw/Upload Different
no current row + no reusable row -> Awaiting signature + Sign
```

- [x] Add state for the reusable signature, reusable-load error/loading, and confirmation progress/error.
- [x] Load a reusable signature only after member and current-request signature reads succeed, only for the signed-in user's configured member, and only while that member is unsigned on this request.
- [x] Pass the reusable preview only to the signed-in member's box; never show another member's saved image as completed.
- [x] Add the saved-but-unconfirmed status copy and distinguish it from the signed checkmark/style.
- [x] Add **Confirm Signature** and **Draw/Upload Different** actions for the matching user.
- [x] On confirmation, call `confirmReusableSignature` with the current request/member identity and reusable URL, then reload current-request signatures.
- [x] Keep threshold counts based only on `signatures`, not the reusable preview.
- [x] Add CSS for preview border/background, action layout, disabled state, and compact secondary replacement action.
- [x] Run `npm run test:signature-reuse` and `npm run build`.

### Task 3: Durable documentation and final verification

**Files:**

- Modify: `PROJECT_CONTEXT_REPORT.md`

- [x] Add a dated durable decision explaining that signature images may be reused but signing events remain request-specific and require explicit confirmation.
- [x] Run `git diff --check` on the files touched by this feature.
- [x] Run `npm run test:signature-reuse` and record the passing result.
- [x] Run `npm run build` and record the successful TypeScript/Vite result.
- [x] Inspect `git diff` to confirm no unrelated files were modified by this work and no Dataverse metadata changed.
- [x] Report that runtime Power Pages authorization and persistence still require a signed-in GCP-Developer smoke test; do not deploy without explicit authorization.
