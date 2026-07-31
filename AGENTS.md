# GCP Nexus development instructions

This is the canonical repository instruction file for coding assistants and
human contributors. Vendor-specific files must import or point here rather than
copying these rules.

## Read before changing code

1. Read [PROJECT_CONTEXT_REPORT.md](PROJECT_CONTEXT_REPORT.md) for architecture,
   data flows, security boundaries, and current caveats.
2. For form or Dataverse work, read [mapping.md](mapping.md) and the existing
   implementation for that matter type.
3. For edit-mode work, read
   [docs/edit-request-mode-plan.md](docs/edit-request-mode-plan.md) and
   [docs/edit-mode-rollout.md](docs/edit-mode-rollout.md).
4. For signatory server logic, read
   [server-logic/README.md](server-logic/README.md).
5. Treat [contex.md](contex.md) as the historical BRD, not as proof that a
   feature is currently implemented.

When documents disagree, prefer the deployed Dataverse schema and Power Pages
metadata, then current source code, then the newest dated decision document.
Report unresolved conflicts instead of guessing.

## Non-negotiable data rules

- Dataverse is an existing, externally owned data model. Do not create, rename,
  or modify tables, columns, relationships, or choice integers unless the user
  explicitly confirms that Dataverse changed and asks for the matching repo
  update.
- Never invent a logical name, entity-set name, navigation property, choice
  value, or web-role GUID. Verify it from existing source/metadata or ask.
- Reuse choice definitions from `src/data/*Choices.ts`. Do not inline duplicate
  `{ label, value }` arrays.
- Follow the existing `as const satisfies readonly DataverseChoice[]` pattern,
  derive the value union from the array, and use `toSelectOptions`,
  `getChoiceLabel`, and `parseChoiceValue` from `src/data/types.ts`.
- Keep [mapping.md](mapping.md) synchronized when a confirmed Dataverse-to-form
  mapping changes.

## Architecture boundaries

- The frontend is a strict TypeScript React 18 SPA built by Vite and hosted as a
  Power Pages code site.
- Same-origin Dataverse CRUD must go through
  `src/shared/powerPagesApi.ts` and the table services under
  `src/shared/services/`. Preserve anti-forgery-token handling, OData helpers,
  retries, and typed mapping layers.
- The Power Pages session is the browser authentication source. Do not add
  client-side token storage.
- Calls from the SPA to Azure Functions use the Power Pages portal token from
  `src/shared/portalToken.ts`. Do not restore the retired MSAL hidden-iframe
  flow; it fails inside the sandboxed Power Pages iframe.
- Signatory member and threshold operations use same-origin Power Pages Server
  Logic under `.powerpages-site/server-logic/` through
  `src/shared/signatoryApi.ts`. The Azure Function signatory implementation is
  legacy fallback code, not the active client path.
- Azure Functions under `api/` still handle SharePoint uploads, notification
  email, and web-role management. They validate portal tokens and use
  server-side credentials for Graph/Dataverse.
- UI role guards improve navigation but are not a security boundary. Dataverse
  table permissions and server-side authorization must allow every required
  operation and deny unauthorized ones.

## Frontend and form conventions

- Preserve strict TypeScript types. Follow the existing two-space indentation,
  semicolons, and predominantly single-quoted imports/strings in touched files.
- Reuse components exported from `src/forms/index.ts` for business-form inputs.
  Extend the shared form layer when a reusable field is missing; do not create a
  second one-off implementation in a matter form.
- Reuse `FormField` and `BaseFieldProps` conventions for label, error, help,
  required, read-only, and mode behavior.
- Multi-step forms use `MultiStepForm`, `StepIndicator`, and `useFormDraft`.
  Edit mode must not read or write the new-request session draft.
- New and edit modes render the same fields. Edit mode differs only in loaded
  initial state, disabled logged-in-user synchronization, and PATCH/diff submit
  behavior.
- In edit mode, display the original requestor/company from loaded state. Never
  overwrite record identity with the currently logged-in reviewer, verifier, or
  administrator. Rebind Project only where the existing implementation does so.
- Saving an RS edit leaves `gcp_requeststatus` at RS (`16`).
- Use `lucide-react` for UI icons. Decorative icons need `aria-hidden="true"`;
  icon-only controls need an accessible label. Inline SVG is acceptable for
  non-icon visuals such as signature drawing or progress graphics.
- Preserve existing file/document JSON conventions in `src/shared/documents.ts`
  and each form's API mapper. Some documented file controls are intentionally
  display-only; do not silently persist them to an invented column.

## Security and configuration

- Do not commit secrets, certificates, tokens, connection strings, or populated
  Azure Function settings.
- `.env.local`, `api/local.settings.json`, `CLAUDE.local.md`, and tool-local
  permission files are machine-specific.
- Treat changes under `.powerpages-site/table-permissions/`,
  `.powerpages-site/web-roles/`, server logic, authentication, or Function token
  validation as security-sensitive. Trace create/read/write/delete plus
  append/append-to requirements before changing permissions.
- Do not broaden Global permissions merely to make a 403 disappear. Determine
  the intended role and scope first.
- Keep browser-visible configuration limited to non-secret values. Graph and
  Dataverse application credentials belong only in Function App/local settings.

## Development workflow

- Start by checking `git status`. Preserve unrelated and pre-existing changes.
- Search for an existing pattern before adding files or abstractions.
- Root SPA:
  - `npm run dev` starts Vite.
  - `npm run build` runs TypeScript project build and creates `dist/`.
- Azure Functions:
  - from `api/`, `npm run build` compiles TypeScript;
  - `npm start` builds and runs Functions Core Tools.
- There is currently no real automated test suite or lint script. Do not report
  `api/npm test` as meaningful coverage; it is a placeholder.
- Validate proportionally: at minimum build the affected TypeScript project.
  Runtime Power Pages behavior, table permissions, portal tokens, and server
  logic require a signed-in deployed-site smoke test.
- Update the relevant context/decision document when architecture, mappings,
  authentication, permissions, or deployment behavior changes.

## Deployment rules

- Do not deploy, restart a site, commit, or push unless the user explicitly asks
  for that external action.
- Deploy to GCP-Developer and verify before production. Production deployment
  requires explicit confirmation.

### Mandatory Power Pages upload checklist

Before **every** `pac pages upload-code-site` attempt, reread this checklist and
complete it in order:

1. Check `git status` and preserve unrelated/pre-existing changes.
2. Read the current deployment context and environment IDs in
   [PROJECT_CONTEXT_REPORT.md](PROJECT_CONTEXT_REPORT.md). Repository text is
   not proof of current external state.
3. Run `pac auth who`, then select and verify the explicitly authorized target:

   ```powershell
   pac org select --environment "<environment-id>"
   pac org who
   ```

   Stop if the friendly name, URL, user, or environment ID is not the intended
   target.
4. Run `npm run build` immediately before upload and stop on any build error.
5. Confirm `powerpages.config.json` still identifies `gcp-nexus` and `dist`.
6. Run `pac pages list -v` and confirm that `gcp-nexus` is the intended active
   SPA and that its data model is **Enhanced**.
7. Inspect `.powerpages-site/.portalconfig/manifest.yml` for stale deletion
   tombstones from the wrong Power Pages data model. In particular, do not
   upload an Enhanced Data Model site while the manifest is trying to delete
   Standard-model entities such as `adx_entitypermission`. Diagnose and resolve
   the manifest/model mismatch first; do not guess a `--modelVersion` flag that
   the installed `pac pages upload-code-site help` does not support.
8. Upload using the absolute root, freshly built `dist`, and exact site name:

  ```powershell
  pac pages upload-code-site `
    --rootPath "<absolute-project-root>" `
    --compiledPath "<absolute-project-root>\dist" `
    --siteName "gcp-nexus"
  ```

9. Treat PAC output—not only the process exit code—as authoritative. The upload
   is failed if output contains `Error:`, `Upload failed`, a non-completing
   progress report, or a rejected required record operation, even when PAC
   returns exit code `0`. Do not restart, smoke-test, commit, push, or report a
   successful deployment until the upload finishes without such errors.
10. After a verified successful upload, restart the authorized site and verify
   with a hard refresh/incognito session using the affected roles.

Omitting `--compiledPath` can upload the stale `.powerpages-site/web-files/`
snapshot instead of the current SPA bundle.

## Documentation discipline

- Keep durable rules here. Put architecture and onboarding context in
  `PROJECT_CONTEXT_REPORT.md`.
- Put dated incidents, environment gaps, and rollout status in a dated document,
  not as permanent universal rules.
- Preserve historical decision records even after implementation; mark them
  superseded or completed and link the replacement.
- Vendor adapters (`CLAUDE.md`, `.github/copilot-instructions.md`, and
  `.cursor/rules/*.mdc`) must stay thin and must not fork these instructions.
