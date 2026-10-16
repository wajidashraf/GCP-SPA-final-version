# Production deployment preflight — 2026-10-15

Status: **Deployed and restarted after renewed authorization.** The initial
upload was held when the user requested keeping backend configuration unchanged.
The user subsequently instructed deploying production and making the required
changes so requests continue working. That superseded the earlier configuration
restriction. The verified mapping was applied before the production upload.
Business records and Dataverse schema were not modified.

## Completed production release

- At `2026-10-15T20:17:06Z`, the shared Function's `POWERPAGE_SITE_IDS` was
  verified as
  `517038c0-eca4-4529-a872-f613ea02ad32,517038c0-eca4-4529-a872-f613ea02ad32`.
  The first entry remains dev; the second scopes production to its verified
  site in the production organization. Every other app setting was compared
  before/after and remained unchanged. No Function binary publish ran.
- All six anonymous backend probes (booking, notification, upload, from each
  portal origin) returned HTTP 401 with the correct matching CORS origin after
  the configuration restart. These verify availability/authentication boundaries,
  not signed-in business operations.
- A rollback snapshot of existing production SPA files and applicable portal
  metadata was saved under ignored
  `.deployment-staging/prod-rollback-20261015/` before external writes. It is
  not a Dataverse business-data backup.
- The mandatory upload checklist was repeated against the exact production
  environment. The fresh TypeScript/Vite build passed; existing mixed-import
  and chunk-size warnings remained. The manifest did not contain wrong-model
  permission deletion tombstones.
- PAC reported **100%, 71/71 events**, upload succeeded in **139.50 seconds**,
  and `Upload complete`, with no upload errors. The exact production runtime
  site restart returned `success: true`.
- Both before and after restart, readback verified **25 explicit field settings
  for 24 tables**, **53 table permissions**, and the expected booking grants.
  The existing duplicate signatory-member field setting
  `38ac9718-8a61-f111-a826-7ced8dfee0c6` was conditionally aligned with the
  canonical list. All **49 unrelated permissions** were unchanged. The other
  four operations were the two ordinary-user booking grant restrictions and
  two administrator grants described below.
- Dataverse-hosted asset bytes matched the fresh build:

  | Artifact | SHA-256 |
  |---|---|
  | `index-BW7hEKrW.js` | `7054ad58b9003d759df25f7d1c898279283e31523a040b24078e85eabb9c4f33` |
  | `index-DMnDV12K.css` | `da9d0ec8030674622a8210c1394c7baa044c7ec330b7f26066cf0f0b08cfd1d9` |

- At `2026-10-15T20:23:25Z` (23:23 Riyadh time on 15 October), public HTTP
  verification returned homepage **200**. It referenced both new assets, each
  returned **200**, and both served bodies exactly matched the fresh build.
  An initial HTTP probe timed out during restart recovery; the retry passed.
- The browser rendered the new production SPA and its expected Microsoft
  sign-in dialog, with no console errors after reload. Despite the user's
  sign-in confirmation, the isolated browser had no portal user/contact and
  remained at `/login`. Signed-in PP/JVP submissions, request-detail actions,
  and requester/administrator rescheduling were **not verified**. No production
  test submissions or booking mutations were attempted.

The release includes the hidden completed-history/booking summary panels,
right-aligned Request Detail actions with 8px gaps, explicit Web API column
lists including exact lookup bind names, duplicate-booking UI guards, and the
authorized server booking transaction. Existing workflow signing/letter actions
remain available under their original guards. See the earlier dev rollout and
lookup-write incident records for implementation scope and regression tests.

## Verified target

- Environment: PowerPagesProduction,
  `f99a8105-8032-ea69-966d-145edf57bc94`.
- Organization: `https://org09c47a7a.crm5.dynamics.com`, organization ID
  `3cb0eb45-f08a-f011-a701-000d3a099787`.
- Site record: `517038c0-eca4-4529-a872-f613ea02ad32`.
- Active Enhanced-model SPA: `gcp-nexus`.
- Runtime site: `b8a6c2c1-7134-4394-ac14-e8bdbb9569a3`,
  `https://gcp-nexus-prod.powerappsportals.com`.
- PAC identity: `o3csconsultant@O3CS.my`. Selecting the existing production
  authentication profile at index 4 resolved the duplicate-profile selection
  issue without deleting credentials. Independent auth/org/site checks matched
  the authorized target.

## Read-only preflight results before upload

- All 24 required tables and every explicit allow-list column/navigation name
  were validated against live production metadata, including the 55 exact
  lookup write names added in dev. The historical email-template and signatory
  schema gaps were not present.
- Request, engagement, and slot optimistic concurrency are enabled. The shared
  Function application identity has the required Global read/write/association
  privileges for the existing booking transaction.
- Portal-token site settings are configured and match the local release.
- Production has 25 field-setting records for 24 tables, including an existing
  duplicate signatory-member setting. Most field settings still use `*`.
  Any future release must align both signatory copies; do not assume dev's
  additional project duplicate exists in production.
- Production has 51 table permissions. Comparing the local release identifies
  only the four intended booking permission operations: restrict ordinary-user
  engagement/slot grants to reads and add two administrator write grants.
- Root tests passed 188/188; API build and tests passed 77/77. These do not
  establish signed-in production workflow success.
- The isolated browser remained on Microsoft sign-in. Signed-in production
  smoke tests were not performed.

## Historical hold and subsequent resolution

The initial shared `spa-integration-func` configuration had aligned dev/production
portal origins and Dataverse URLs, but `POWERPAGE_SITE_IDS` lacked a production
entry. The new
`/api/engagementBookings` handler requires an explicit site mapping and rejects
booking operations with HTTP 503 when it is absent. The current frontend sends
booking mutations to that endpoint; uploading it in that state would break
production booking.

A reviewed local operational script was prepared to fill only the production
entry with the verified site record ID, preserve dev and all unrelated settings,
and verify readback. It was not run under the initial authorization: the user
declined the configuration change after being told it briefly restarts the
shared Function App. After the later instruction to make the necessary changes
and deploy production, it was run and verified as recorded above.

For future releases, repeat live preflight and the mandatory upload checklist;
do not treat this dated mapping/privilege verification as proof of current
external state. Signed-in workflow checks remain outstanding for this release.
