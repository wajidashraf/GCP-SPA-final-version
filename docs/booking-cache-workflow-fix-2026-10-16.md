# Booking cache and create-workflow incident — 2026-10-16

Status: backend, dev and production deployments verified; authenticated saves remain unverified. Follows the
[shared-slot fix](booking-shared-slot-fix-2026-10-15.md).

## Evidence and causes

REQ-1262 (`9992fa3e-14bb-f111-aaae-70a8a5706abb`) was successfully moved by
the user to 31 October at 03:26:02 UTC. Direct Dataverse reads showed its new
binding, booked destination and released 20 October slot. Reopening the portal
showed the older selection. REQ-1283 (`8185239b-bdc6-f111-a05c-000d3a091cd7`)
remained Ready for Engagement with no engagement. Its screenshot showed 31
October available and omitted the now-available 20 October slot, opposite to
live data. Function writes bypassed the portal cache, while previous form reads
used that cache. Microsoft documents that
[external changes can take up to 15 minutes to appear](https://learn.microsoft.com/power-pages/admin/clear-server-side-cache).
A browser refresh does not invalidate the server cache.

Two existing synchronous engagement-create workflows named `Update Request
Status` update the related parent to R (`3`). Production XAML confirms their
parent update; IDs `0b25da77-7b98-f011-b41c-002248ebc9e4` and
`e436cf94-c961-f111-a825-6045bd1e35c3`. Previously the atomic batch created the
engagement before its parent ETag guard, so its own workflow invalidated that
guard. A regression simulating this reproduced the reported save conflict.

Both editors also counted the current booked slot as available. Review found
that an old open editor could undo a newer reschedule because it did not send
the version originally displayed.

## Implementation

- Creation checks/updates the request first in the same atomic changeset, then
  reserves the slot and creates the engagement. ETags, rollback, deterministic
  create IDs and response reconciliation remain. Existing workflows are unchanged.
- Authenticated GET on `/api/engagementBookings` reads current Dataverse data.
  A request ID requires its original requester or site administrator.
  `scope=slots` and `scope=management` require an administrator. Portal issuer,
  exact org/site mapping and server-side roles remain authoritative. Responses
  use `no-store`.
- Booking editors, admin slot/engagement management and requester/admin Request
  Detail booking actions use fresh reads. Other detail roles retain existing
  same-origin table-permission reads. Any scheduled reservation excludes a slot
  from available targets, even if its stored status is inconsistent; reads do
  not repair saved records. Current booking is separate from availability counts.
- The frontend retains engagement ETags. Reschedule/cancel require the version
  displayed as `expectedVersion`; stale or pre-release editors must refresh.
  Saved engagement dates remain authoritative when a slot was reused.
- Engagement labels fall back to canonical choices when fresh records have no
  formatted annotations.

No schema, choice, workflow, application setting or table permission changes.
No production business records are changed by investigation or tests.

## Validation and rollout

API: 99 tests pass, covering synchronous workflows, external concurrent changes,
rollback, stale editors, GET authorization/isolation and shared-slot behavior.
Root: 193 tests pass. Both strict TypeScript projects build.

Release sequence: capture production rollback snapshot; package four changed
compiled booking modules and maps over the previously verified Function runtime;
publish and verify unchanged settings/12 triggers; upload and verify dev; then
upload and verify production. Record actual results below after deployment.
Signed-in checks require the user's test-browser session; the normal browser
session is separate. No test bookings or reschedules are made in production.

### Verified deployment evidence

- Shared backend: deployment `5d7808f72ae148298419b6c526dfd07b`, complete and
  active at 03:51:21 UTC, 16 October. All 12 triggers remain registered; booking
  exposes GET/POST. Settings fingerprint remains
  `35aef3a27c4dbfbd1cb84eb690f895d79195f5ce1169ef5ffc42325292f20e1c`.
  Runtime ZIP SHA-256:
  `6CDA72340A19F4692F5DA0CB571936C348EC3FEACB4420FDAD5FB810AB8C68D7`.
- The only package changes are four compiled booking modules and their maps;
  the prior deployed runtime/dependencies remain the rollback baseline.
- Live read-only checks at 03:49 UTC returned REQ-1262's current 31 October
  booking, no booking for REQ-1283, and available 19/20/30 October slots.
  Both transaction plans were constructed with a local capture callback;
  zero mutations were sent to Dataverse.
- Dev: 74/74 upload events completed in 217.71 seconds, restart succeeded,
  26 field settings/24 tables verified, all 53 permissions unchanged.
  Deployed artifacts matched the fresh build at 03:59:38 UTC. After warm-up,
  HTTP 302 redirected to the expected Microsoft tenant sign-in gate.
- Release JavaScript `index-BB_POdJ5.js` SHA-256:
  `98979c27b2b118d89315edfa9bc3883d1a762b63ab26e1ad39979a8518b483d9`.
  CSS `index-DMnDV12K.css` SHA-256:
  `da9d0ec8030674622a8210c1394c7baa044c7ec330b7f26066cf0f0b08cfd1d9`.
- One initial dev release stopped before upload because PowerShell converted a
  Vite warning on stderr into a terminating error. The release runner now merges
  build output while retaining the build exit-code gate; the fresh retry passed.
  The known PAC org-selection crash was followed by an independent successful
  exact organization/user/environment verification before either upload.

- Production: 71/71 events completed in 162.48 seconds; restart succeeded.
  At 04:06:38 UTC all 25 field settings/24 tables and all 53 unchanged permissions
  were verified, and both artifacts matched the dev-tested build.
  At 04:06:57 UTC the production homepage and both release assets returned HTTP
  200, with matching references and byte hashes. Browser navigation loaded the
  new SPA and displayed its expected sign-in page, with zero console errors.
- Fresh read-only checks at 04:07:12 UTC confirmed the same REQ-1262/REQ-1283
  state and available slots. Local transaction capture still passed for both;
  zero business writes were performed. The automated browser remained signed
  out; no actual production first booking or reschedule was submitted.
- Production SPA/metadata rollback snapshot is retained under
  `.deployment-staging/prod-rollback-cache-workflow-20261016/`. Previous shared
  Function runtime ZIP is retained separately. Updated machine-readable evidence
  is in `docs/alm/last-deploy.json`, `docs/alm/last-test-site.json`, and the dated
  `production-booking-cache-workflow-2026-10-16.json`. Previous reports are archived
  before replacement. No commit or push was made.

**User verification and follow-up:** The user subsequently confirmed booking
works. Direct production reads confirmed REQ-1283 was created on the 30 October
slot with request status R (`3`). The remaining cached `/requests` status display
is addressed by the [Requests list follow-up](request-list-status-refresh-2026-10-16.md).
