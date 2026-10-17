# RTP field text release — 2026-10-17

Status: development and production uploaded, restarted and deployment-verified.
The signed-in RTP form remains visually unverified.

## Authorized scope

The user requested the RTP form text changes and explicitly authorized production
deployment to environment `f99a8105-8032-ea69-966d-145edf57bc94`, website record
`517038c0-eca4-4529-a872-f613ea02ad32` through its maker URL.

`src/forms/rtp/RtpForm.tsx` changes only two strings:

- Project Name retains its label; placeholder becomes
  `Please enter a short title for the project`.
- Remarks is relabelled Project Description. Its existing placeholder already
  exactly matches the requested full-project-name/scope/objectives/background text.

Both controls retain `isRequired` and their existing validation, state keys,
Dataverse columns, mappings and submission behavior. The shared form supplies
both new-request and edit mode. Request Detail labels are outside this change.
No backend, schema, business-record, permission or authentication-policy changes
are included. The deployment skill's usage counter is updated separately.

## Validation and deployment

- Fresh TypeScript/Vite builds ran immediately before each upload. Existing
  mixed-import and bundle-size warnings remain.
- PAC verified the intended user, environment, website ID, active SPA and
  Enhanced model. Uploads explicitly use the absolute root and freshly built
  `dist` with `--siteName gcp-nexus`.
- Development upload completed 74/74 events in 246.19 seconds. Restart succeeded;
  both deployed assets match the build. All 53 permissions and 106 combined
  permission/Web API setting records match the pre-upload snapshot.
- The restarted development homepage redirects to its expected Microsoft tenant
  sign-in gate. The isolated browser has no authenticated portal session, so a
  signed-in RTP form check is not claimed.
- Production upload completed 71/71 events in 168.62 seconds. Restart succeeded
  at 06:35:22 UTC / 09:35:22 Riyadh. Both deployed assets match the build;
  all 53 permissions and 104 combined permission/Web API setting records remain
  unchanged, including 25 explicit field settings.
- At 06:36:56 UTC / 09:36:56 Riyadh, the production homepage and both referenced
  `/assets/` files returned HTTP 200 with exact build hashes. An initial asset
  probe used a root-level path and returned 404; correcting it to the actual
  homepage-referenced `/assets/` path passed without any site change.
- Fresh browser navigation loaded the production SPA and its expected Sign In
  page with zero console errors and one warning. No request was created or
  submitted for verification. The signed-in RTP visual check remains pending.

JavaScript: `index-Yvy9k6RF.js`, SHA-256
`4a942fee19c1d45b9eb078dc67b9d0f69827e6845ce29401797688b697c468ef`.
CSS: `index-DMnDV12K.css`, SHA-256
`da9d0ec8030674622a8210c1394c7baa044c7ec330b7f26066cf0f0b08cfd1d9`.

## PAC profile incident

The initial production preflight stopped before upload: `pac org select` raised
`Sequence contains more than one matching element` while updating duplicate
authentication profiles. Independent `pac org who` still reported development,
so the target guard blocked further action. Explicit profile selection/update
also reproduced the failure. The stack traced it to `AuthProfiles.Update`.

The existing production profile was temporarily isolated from profiles for the
same identity, with an untouched original-store backup beside the machine-local
profile file. The credential/token cache was never changed. Production selection
then succeeded and independently verified the exact requested org and environment.
After deployment, all 12 original profiles were restored. Only the existing
production profile's selected environment was updated to the intended production
target; independent `pac org who` verified that selection after restoration.

Rollback assets and metadata baselines are retained under ignored
`.deployment-staging/rtp-text-20261017-dev/` and
`.deployment-staging/rtp-text-20261017-prod/`. Deployment itself performed no
commit or push. The user subsequently requested publication to
`wajidashraf/GCP-SPA-final-version` on the existing
`feature/request-history-print-rescheduling` branch; the release commit includes
source, generated site artifacts and deployment evidence. Machine-local staging,
authentication backups and browser captures remain excluded.
The publication check passed a fresh SPA build, all 198 root Node tests and
`git diff --check`; the generated JavaScript hash matches the deployed release.

Machine-readable deployment evidence is in
`docs/alm/rtp-text-release-2026-10-17.json` and `docs/alm/last-deploy.json`.
The previous deployment record is archived as
`docs/alm/pre-rtp-text-2026-10-17-last-deploy.json`. The prior signed-in/runtime
test report remains historical and does not establish a signed-in check of this release.
