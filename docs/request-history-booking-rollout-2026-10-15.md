# Request history, printing, and booking rollout record

**Date:** 2026-10-15 (Asia/Riyadh)
**State:** Implemented and verified locally on
`feature/request-history-print-rescheduling`, based on `03681c9`.
**Deployment:** Shared Function backend published with explicit approval;
development SPA and matching permissions uploaded successfully and dev site
restarted. Signed-in workflow verification was skipped at the user's request
to finish with deployment checks only. These feature
changes have not been committed or pushed.

## Request Detail presentation follow-up — 2026-10-15

**Status:** Uploaded successfully to the explicitly authorized GCP-Developer
site. The first follow-up upload's restart/verification command was declined
and did not run. The later
[lookup-write fix](webapi-lookup-writes-2026-10-15.md) deployed the same layout
with the booking guard, completed the dev restart, and verified live settings,
unchanged permissions, and bundle bytes. Signed-in workflow checks remain
subject to authentication; the earlier evidence below is preserved as history.

At the user's request, Request Detail no longer renders the added Engagement
Booking, Completed Signatures, saved HOC Acceptance, Acknowledgement Letter, or
Endorsement Letter panels. The page no longer loads the saved-signature history.
The original Pending Review signing controls and existing acceptance/letter
workflow actions remain available; they are separate from the removed history
panels. Print includes the remaining displayed record and does not wait for
the removed history or booking summary.

The original requester and administrator retain Edit Booking at Booked (R),
opening the existing engagement form with the saved engagement/current slot.
They can select another available slot using the unchanged authorized booking
transaction, including release of the old slot. Booking lookup failures retain
a compact retry message so removing the summary does not hide the recovery path.

Saved records, history components/helpers, backend booking code, table
permissions, and Dataverse mappings are preserved. This follow-up supersedes
only the Request Detail presentation and associated print contents described
below; the prior deployment evidence remains historical. Implementation plan:
[restore detail layout](superpowers/plans/2026-10-15-request-detail-layout-restore.md).

Local verification: SPA build passed with existing mixed-import/bundle-size
warnings; 29 focused booking-policy, print, history, and detail-field checks
passed; `git diff --check` passed. The engagement form and backend were not
changed. No browser/signed-in runtime test, commit, or push ran for this
presentation follow-up.

### Authorized dev upload of the presentation follow-up

- The user explicitly selected environment
  `19d73dc4-0f30-e868-bf7d-8abcd4b89699` and website record
  `517038c0-eca4-4529-a872-f613ea02ad32` through their maker-site link.
- The mandatory upload checklist was reread. Existing changes were preserved;
  `pac auth who` and `pac org who` confirmed GCP-Developer,
  `https://gcp-developer.crm5.dynamics.com/`, and
  `o3csconsultant@O3CS.my`. Environment selection encountered the existing PAC
  non-recoverable profile-selection error after connecting; the independent
  organization check then succeeded and verified the exact environment ID.
- A fresh SPA build passed. Configuration remained `gcp-nexus` / `dist`.
  `pac pages list -v` confirmed the exact site as active, Enhanced-model, and
  SPA, runtime portal ID `4474b2ad-02c9-4f82-8783-827627760235` at
  `https://gcp-nexus.powerappsportals.com/`. The manifest contained old bundle
  tombstones only, with no Standard-model permission tombstones.
- Upload used the absolute project root, explicit freshly built `dist`, and
  exact site name. PAC reached **100%, 74/74 events**, printed
  `Power Pages website upload succeeded in 164.55 secs` and `Upload complete`,
  and returned exit code 0, without an upload error or rejected required record.
- Built JavaScript: `index-piAcHTWT.js`, SHA-256
  `CEE777B23F670C42F1391CE835E5D9E6FDEF3D504F44C658FCB552B2EA9FBFE6`.
  CSS: `index-wEz7mtdN.css`, SHA-256
  `0111B6D9BB7682F001D3BF95DE3AE3A84F49C255E0B17CE8D126889CAB91A61D`.
  These are local build hashes; live byte comparison has not run for this upload.
- The subsequent combined dev restart, artifact comparison, and Web API/
  permission verification command received `Rejected("rejected by user")`
  before process creation. None of those operations ran. No alternative
  restart or equivalent verification path was attempted after that rejection.
  Deployment completion beyond the successful upload is not claimed.
- No Azure Function publish, production upload/restart, schema change, or
  business-record mutation was part of this follow-up.

## Request Detail action alignment — 2026-10-15

The user requested that Edit, Edit Booking, and Print sit together on the
right of the metadata strip with smaller gaps. Request Detail now wraps the
existing conditional actions in one named group. The group owns the automatic
start margin, aligns its contents to the right, wraps when needed, and uses an
8px gap. Individual buttons no longer each consume an automatic left margin.
Action handlers, authorization guards, and print exclusion are preserved.

Actual record-strip CSS was checked with synthetic metadata in an isolated
browser fixture at 1280px, 390px, and 320px. All three sizes retained right
alignment, exactly 8px between adjacent buttons, and no horizontal overflow.
The fixture did not use a portal session or modify business records.

After the user's explicit dev deployment request, the mandatory upload
checklist and fresh SPA build passed. PAC verified the exact GCP-Developer
environment/site and active Enhanced SPA, and uploaded using absolute root,
compiled `dist`, and `gcp-nexus`. Upload completed at **100%, 74/74 events**,
reporting `Power Pages website upload succeeded in 218.73 secs` and
`Upload complete`, with no upload error or rejected required record.

Live readback verified all 24 tables / 26 field settings and unchanged 53 table
permissions; no duplicate correction was needed. Dev restart returned
`success: true`. Deployed files match the fresh build byte for byte:

| Artifact | SHA-256 |
|---|---|
| `index-BW7hEKrW.js` | `7054AD58B9003D759DF25F7D1C898279283E31523A040B24078E85EABB9C4F33` |
| `index-DMnDV12K.css` | `DA9D0EC8030674622A8210C1394C7BAA044C7EC330B7F26066CF0F0B08CFD1D9` |

Verification timestamp: `2026-10-15T19:56:31.699Z`. The final post-restart
availability probe returned the expected HTTP 302 redirect to Microsoft's
private-site sign-in gate. Signed-in application layout has not been
verified. No production deployment, shared Function publish, business-record
write, commit, or push ran for this layout release.

## Deployment result — 2026-10-15

The user explicitly approved publishing `spa-integration-func`, including its
shared production API impact, then deploying the linked development site.
No production Power Pages site upload/restart or Dataverse schema change ran.

1. The local Core Tools npm launcher could not load its missing `lib/main.js`.
   Published the prepared runtime ZIP through the installed Azure CLI instead,
   without reinstalling tools or requesting a remote build. Deployment
   `b4cee1b412804e989b44617bb575e341` completed at
   `2026-10-15T11:18:38.410359Z`, status `4`, complete/active `true`.
   Package SHA-256:
   `188D44CEFB9ACEDF02E46F16E8703B19FF39EA580FC14D4CE740F90A0E432DF0`.
2. Azure's refreshed trigger listing contains all **12** HTTP functions,
   including `engagementBookings`. POSTs without a token to
   `/api/engagementBookings`, `/api/notifications/event`, and `/api/uploadFile`
   each returned **401**, with the correct development CORS origin. The first
   notification probe used its registration name instead of its public route
   and returned 404; the corrected route passed. No authenticated mutation ran.
   Before/after app-setting fingerprints were identical.
3. The SPA TypeScript/Vite build passed. The mandatory upload checklist verified
   the exact account, dev environment/site, active Enhanced data model, current
   `dist`, and manifest. PAC upload reached **100% (72/72 events)** and printed
   `Power Pages website upload succeeded in 171.77 secs` and `Upload complete`,
   with no upload error or rejected required operation.
4. Restarted the exact verified dev runtime site
   `4474b2ad-02c9-4f82-8783-827627760235`, backed by website record
   `517038c0-eca4-4529-a872-f613ea02ad32`. Restart returned
   `success: true` for `https://gcp-nexus.powerappsportals.com`.
5. Downloaded the two deployed bundle files through the existing application
   user's dev Dataverse access and compared them with fresh `dist/assets`.
   Both match byte for byte:

   | File | SHA-256 |
   |---|---|
   | `index-CR0xuWx_.js` | `C0778424D82C56E5C3F89DDCB25AA27CD57FF23000EEC04C762A0BE54B4735C4` |
   | `index-wEz7mtdN.css` | `0111B6D9BB7682F001D3BF95DE3AE3A84F49C255E0B17CE8D126889CAB91A61D` |

6. Read back all five dev engagement/slot permission records. Authenticated
   Users have only Read through their two grants. Administrator-only engagement
   Write/Append, slot Create/Write/Append/Append To, and the existing slot Delete
   grant match the design. The deployed permission union has no additional
   ordinary-user engagement/slot mutation grant.
7. The restarted portal responds **302** to its Microsoft sign-in gate; the
   identity-provider page returns **200**. One browser navigation timed out at
   60 seconds, then inspection confirmed it had reached that sign-in page.
   The user reported signing in, but the isolated automated browser still has
   no portal session. After clarification, the user chose
   **"Finish with deployment checks only"**.
   Authenticated page/API, role, print, and booking transaction checks have not
   run; the signed-in matrix below remains outstanding.

The bundle comparison and permission readback use administrator/application
access and do not prove portal-user authorization or runtime booking behavior.
No real request, booking, slot, email, upload, or signature was changed during
smoke checks. Local skill-usage counters were updated after upload for a future
release; no additional upload was performed for those counters.
The partial read-only smoke report is `docs/alm/last-test-site.json`: seven
checks passed, one browser-navigation timeout warning failed its timing check,
and four signed-in/crawl checks were skipped at the user's request. Its outcome is
`passed-with-warnings`; it does not assert authenticated application health.
No ALM plan exists to refresh. PAC-generated trailing spaces on empty manifest
checksums were trimmed locally after upload, and `git diff --check` passed.

## Development deployment preflight — 2026-10-15

- The requested environment is verified as **GCP-Developer**,
  `19d73dc4-0f30-e868-bf7d-8abcd4b89699`, at
  `https://gcp-developer.crm5.dynamics.com/`, using
  `o3csconsultant@O3CS.my`. `pac pages list -v` confirms active Enhanced SPA
  `gcp-nexus`, site `517038c0-eca4-4529-a872-f613ea02ad32`, portal
  `https://gcp-nexus.powerappsportals.com/`.
- PAC initially selected an unrelated OIAC profile. The existing named
  GCP-Developer profile was selected before deployment preparation. `pac org
  select` validated GCP-Developer but then encountered the existing duplicate
  profile error (`Sequence contains more than one matching element`). Subsequent
  `pac org who` and site listing independently confirmed the exact intended
  environment. Authentication profiles were preserved.
- The existing Function application's credentials authenticated against dev.
  Metadata reports `IsOptimisticConcurrencyEnabled: true` for `gcp_request`,
  `gcp_engagements`, and `gcp_slot`; existing entity-set names match the code.
  The application has Global Read/Write/Append To on request/slot, Global
  Read/Create/Write/Append on engagements, Read/Append To on contact, and Read
  on `powerpagecomponent`. The two relevant dev web-role IDs match the checked-in
  administrator/authenticated-user permission bindings. No schema or privilege
  changes were made.
- Azure confirms a single Windows Consumption (`Y1`) Function App,
  `spa-integration-func`, in `spa-integration-func_group`, subscription
  `2dd7697f-9c83-4553-a579-99621bc04a29`. It has no deployment slots and currently
  exposed the existing 11 functions at preflight. Its live `PORTAL_BASE_URLS` and
  `DATAVERSE_URLS` include both development and production. Dev has the correct
  `POWERPAGE_SITE_IDS` entry; production's site entry is blank. The new booking
  endpoint will fail closed for that incomplete production mapping. Existing
  settings and routes have not been changed.
- An isolated runtime-only Function package was prepared under ignored
  `.deployment-staging/function-20261015/`. The API build passed; production
  dependencies were installed from the lockfile. The package includes compiled
  `dist/generated/bookingChoices.js` and excludes `local.settings.json`, source
  tests, and local environment files. Local development dependencies were
  preserved.
- The preflight upload manifest contained expected old `adx_webfile`/annotation bundle
  tombstones and no `adx_entitypermission` section. The complete mandatory
  checklist and fresh SPA build were completed before the successful upload.
- A fresh browser navigation reaches the tenant's Microsoft sign-in gate.
  Signed-in runtime checks have not run; user login is required after deployment.

The shared Function publish received the additional explicit approval required
under `AGENTS.md`'s production-deployment rule. The production Power Pages site
remained outside this dev deployment. The matching backend was deployed and
verified before uploading the narrowed dev permissions.

## Implemented requirements

| Requirement | Result | Main files |
|---|---|---|
| RTP placeholders | Exact requested Project Name and Remarks placeholders; labels, required rules, values, bindings, and current Project Details step retained. | `src/forms/rtp/RtpForm.tsx` |
| Booking edits/rescheduling | Original requester/site admin can edit the current Scheduled engagement at R. Form prefills saved details/current slot. Server rechecks identity, request stage, binding, availability and versions; transaction updates the same engagement, reserves the new slot and releases the old slot together. R, engagement number, creator, comments and workflow data remain unchanged. | `src/pages/Engagement.tsx`, `src/components/engagements/EditEngagementModal.tsx`, `src/pages/EngagementManagement.tsx`, `src/shared/engagementBookingApi.ts`, `src/shared/engagementBookingPolicy.ts`, `api/src/dataverse/engagementBooking.ts`, `api/src/dataverse/dataverseBatch.ts`, `api/src/dataverse/engagementBookingIo.ts`, `api/src/booking/engagementBookingHandler.ts`, `api/src/functions/engagementBooking.ts` |
| Status labels | Shared descriptive filter/row/detail labels. Canonical choice integers, URL/filter values, predicates, and status styling remain based on existing definitions. | `src/shared/requestStatusPresentation.ts`, `src/pages/Requests.tsx`, `src/pages/RequestDetail.tsx` |
| Complete request printing | Original requester/admin Print action waits for accessible saved data/images. Collapsed sections print, unsaved controls are excluded, long content paginates, full attachment names remain linked, and identity/image readiness is rechecked before printing. | `src/pages/RequestDetail.tsx`, `src/shared/requestPrint.ts`, `src/components/detail/DetailSection.tsx`, `src/components/detail/DocumentCard.tsx`, `src/styles/requestPrint.css`, `src/main.tsx` |
| STSP step order | Basic Information → PIC → Project Details → remaining ST/SP Information steps → Document. Existing step blocks and validation moved together; form payload mapping unchanged. | `src/forms/stsp/StspForm.tsx`, `mapping.md` |
| Saved forms/signatures | Saved signature events, acceptance conclusions/date, acknowledgement text and endorsement text appear read-only below existing review. Letter bodies are not regenerated. All accessible child/bidder/signature pages are loaded; multiple child records retain distinct fields; RTP Remarks is visible. | `src/components/detail/RequestHistory.tsx`, `src/shared/hooks/useRequestHistory.ts`, `src/shared/hooks/useRequestDetail.ts`, `src/shared/requestHistory.ts`, `src/shared/requestDetailRecordFields.ts`, `src/shared/services/signatureService.ts`, `src/components/letters/letterPersistence.ts` |

`src/shared/hooks/useRequestEngagements.ts` supplies the request-scoped booking
summary. Engagement and available-slot reads follow their continuation pages.

Key function/component changes:

- Booking: `saveEngagementBooking`, `executeEngagementBooking`,
  `createEngagementBookingHandler`, `buildChangeSet`,
  `validateChangeSetResponse`, `executeChangeSet`, `readBookingEngagement`, and
  `readBookingCollection`. Booking forms now call this path for create/edit/
  cancel; `getSlotById` supports current-slot prefill.
- Detail/history: `RequestHistory`, `useRequestHistory`,
  `useRequestEngagements`, `getAcceptanceHistory`, `getRequestSignatureEvents`,
  `extractStoredLetterText`, `collectRequestPages`, and
  `combineDetailRecordFields`. `useRequestDetail` and signature/engagement reads
  retain all accessible pages instead of stopping at the first page.
- Presentation/print: `getRequestStatusDisplayLabel`,
  `requestStatusFilterOptions`, `printRequestRecord`, the detail page's
  `handlePrint`, mounted `DetailSection` bodies, and print-specific document
  filenames in `DocumentCard`.

## Data and integration changes

No Dataverse tables, columns, relationships, choice values, or existing web-role
IDs changed. The new Function uses existing request, engagement, slot, contact,
and site-role records. Creates use a deterministic existing primary-key GUID
derived from the operation/contact/request/portal, avoiding a new alternate key.
Rescheduling patches the existing engagement; it never creates a replacement.

The Function uses the existing Power Pages portal-token validator, server-side
application credentials, and invocation-scoped environment routing. Browser
reads remain same-origin through the existing typed services. No new client
credentials, token storage, or browser environment variables were introduced.

The API build generates its booking choices from the root canonical choice
files; run the build from a full repository checkout. Publish the compiled
`api/dist/generated/bookingChoices.js` with the rest of the Function artifact.

## Permission changes and deployment dependency

The checked-in `Engagement-Global-Access` and `Slot-Global-Access` permissions
retain Read for Authenticated Users and remove Create/Write/Append/Append To.
Delete was already disabled. This prevents ordinary users bypassing booking
authorization with direct table mutations. New administrator-only write grants
preserve slot creation/management and engagement detach/restore during slot
deletion; the existing administrator delete grant is unchanged. Contact and
request target association grants are reused, not broadened.

Before an explicitly authorized rollout:

1. Verify GCP-Developer, the deployed schema/permissions, existing plugins/flows,
   and each existing table's optimistic-concurrency capability. The new endpoint
   checks concurrency metadata and fails closed if it cannot enforce versions;
   it does not enable it or modify the schema.
2. Verify the Function application user's Read/Write on request/slot,
   Read/Create/Write/Append on engagements, Append To on linked request/slot/
   contact, and existing site-role reads. Metadata reads must also succeed.
3. Verify `PORTAL_BASE_URLS`, `DATAVERSE_URLS`, and `POWERPAGE_SITE_IDS` are aligned
   for every portal. Multi-portal booking never falls back to another org/site;
   missing mappings fail closed. Single-portal configuration can use the
   corresponding singular settings. Do not expose their server credentials.
4. Build/deploy the Function first. Coordinate the SPA/permission release:
   uploading the narrowed permissions before its matching Function/frontend
   would break the old browser booking path. Follow the complete mandatory PAC
   checklist in `AGENTS.md` for every authorized site upload.
5. Smoke-test GCP-Developer with actual signed-in roles before seeking separate
   production deployment authorization. Check that existing automation treats
   the conditional same-value R guard as intended and does not retrigger actions.

Existing global read grants and unrelated permissions are not a general
security remediation. Do not interpret this delivery as resolving every issue
from the October application review. Verify the deployed permission union,
explicit Web API field configuration, and actual SharePoint access separately.

## Verification completed

| Check | Result |
|---|---|
| Root focused Node suite | **178 passed**, 0 failed/skipped. Baseline was 142. |
| API `npm test` | API build plus **77 passed**, 0 failed/skipped. This replaces its former placeholder. |
| SPA TypeScript and Vite build | Passed. Existing mixed static/dynamic import and large-bundle warnings remain. |
| Whitespace/diff checks | Passed; repository LF/CRLF conversion notices do not indicate failed checks. |
| Independent backend/permission review | No remaining Important/Critical findings after adding a same-slot ETag guard. Regression reproduces a concurrent administrator release and verifies rollback. |
| Independent frontend/history/print review | No remaining Important/Critical findings after excluding editors, retaining every child record, guarding print identity/readiness/images, and separating cancellation success from read-refresh failure. |
| Final integration review | No remaining Important/Critical findings after restoring cancellation for Scheduled engagements detached by supported administrator slot deletion. Eight added tests cover owner/admin cancellation, rebooking, concurrency rollback, authorization, stage/binding, and lost-response reconciliation. |

Tests cover owner/admin authorization; non-owner Reviewer/Verifier denial;
cross-portal context; invalid inputs and bindings; booked/new-slot races;
conditional rollback; old-slot release; same-slot guard; duplicate create
delivery; uncertain-result reconciliation; cancellation policy; nested/malformed
batch responses; canonical labels; stored text/legacy marker parsing;
acceptance evidence; same-origin pagination; multiple records; and print image/
identity/readiness races. Behavioral regressions were observed failing before
their fixes.
The final detached-slot cancellation regression run produced six expected
failures before the fix and 77/77 passes afterward. Existing reservation checks
remain in force whenever an engagement still has a slot.

### Browser fixtures

Playwright intercepted local API responses and portal-token/config modules with
synthetic records; no real booking or Dataverse write occurred. These checks
verify browser integration, not live portal authorization:

- Booking edit prefilled the original name/current slot. Selecting another slot
  sent one reschedule mutation for the same engagement GUID. The refreshed
  detail displayed the changed time; fixture state retained R with old slot
  Available/new slot Booked.
- Non-owner Reviewer/Verifier had neither Edit Booking nor Print; Administrator
  had both. The initial reviewer-comment editor stayed excluded in print mode.
- STSP Next/Previous visited PIC before Project Details and retained entered PIC
  text. RTP controls displayed both exact requested placeholders in the existing
  four-row textarea/form layout.
- Two saved child rows both displayed their distinct Remarks.
- Printing expanded collapsed details/signatures, retained saved letter text
  without metadata, waited for a loaded signature, and included the complete
  attachment name. A long synthetic record generated a **7-page A4 PDF**.
- A failed signature image prevented `window.print()` and displayed retry
  guidance. The initial exact-text locator timed out because the error container
  also contained a reload button; direct DOM inspection confirmed the expected
  error and zero print calls.
- At a 390px viewport, the document width was 390px: no horizontal overflow.

Synthetic PDF/screenshot artifacts are in the machine's temporary directory,
not the repository's deployable files. Browser fixtures did not change product
authentication or persist user data.

## Storage limitations and remaining runtime verification

Older acceptance records retain conclusions/date but not the exact original
declaration, final submitter, or selected signature event. The view states this
limitation and presents related signature events without claiming which signed
the acceptance. No historical facts or new snapshot storage were invented.
Images still depend on existing SharePoint authorization. The app restricts
its Print button; it cannot revoke browser printing of already accessible data.

The signed-in development-site matrix remains required after authorized
deployment:

| Actor/scenario | Expected runtime result |
|---|---|
| Original requester, R, new slot | Same engagement updated; old slot Available, new Booked; request R; comments/review actions preserved. |
| Administrator on another request | Authorized edit; same transactional rules. Slot create/edit/delete and engagement detach/restore still work. |
| Non-owner Reviewer/Verifier | No edit action; direct booking endpoint denied; direct engagement/slot writes denied by table permissions. Existing review/verify actions still work. |
| Owner with another role | Ownership authorizes booking without granting that ability to non-owners of that role. |
| Concurrent reservation/status/slot change | Conflict and rollback, with the prior valid booking retained. No duplicate active booking. |
| Network loss after transaction | Exact saved state reconciled or an uncertain result reported; no blind create replay. |
| Same-slot details edit | Existing reservation remains Booked and version-guarded; no release. |
| Requester/admin cancellation | Existing role-specific timing policy preserved; no false success if release fails. |
| Cancellation after administrator slot deletion | Detached Scheduled engagement can be cancelled by its owner/admin with request/engagement ETags; subsequent booking works; deleted slot is not recreated or queried. |
| Saved forms/history and print | Only accessible records/images load; all relevant saved sections and collapsed content print; failed loads/images show retry. |
| RTP/STSP creation and edit | Required validations, data identity, submission payloads, uploads, and existing edit/status behavior preserved. |

Development deployment evidence is recorded above. Signed-in development
workflow verification and production-site validation are not claimed.
