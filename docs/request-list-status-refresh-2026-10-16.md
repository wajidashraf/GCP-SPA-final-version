# Requests list status refresh — 2026-10-16

Status: backend, dev and production deployed and verified; signed-in list badge/filter check remains unverified.

The user confirmed the preceding booking fix works. REQ-1283
(`8185239b-bdc6-f111-a05c-000d3a091cd7`) was successfully booked for 30 October.
Direct production reads at 04:13 UTC confirmed its request status is R (`3`),
while `/requests` still displayed Ready for Engagement (`2`). This is the
remaining cached list path from the
[booking cache/workflow incident](booking-cache-workflow-fix-2026-10-16.md).

The Requests list fetches 100 records at a time using the Power Pages Web API,
then applies filters and UI paging locally. It now refreshes the IDs' statuses
in one authenticated batch before publishing items or checking integrity.
Badges, row actions and status-filter membership therefore use the actual
saved value, including later workflow stages. No status is inferred from an
engagement, stored locally as an override, or written to Dataverse.

GET `/api/engagementBookings?scope=request-statuses&requestIds=<comma-separated-ids>`
accepts at most 100 GUIDs. The existing portal JWT, issuer and exact org/site
mapping checks apply. The backend reads this site's deployed request table
permissions and contact roles, including the implicit authenticated-users role.
It supports only the verified Enhanced Global, Contact and Account read scopes;
the owner/company relationships must match the deployed, verified names.
Unsupported grants fail closed. Queries apply both requested IDs and permitted
owner/company scope server-side. Responses contain only authorized ID/status
pairs with `Cache-Control: no-store`. No table permissions, roles, settings,
workflow, schema or business data are changed.

Missing or no-longer-authorized IDs are omitted. Read failures surface the list
error; a full reload clears previous items instead of presenting stale badges
as current. Additional server pages refresh their newly loaded IDs. Already
loaded records retain normal list snapshot semantics until full reload.
Dashboard count queries are unchanged.

Validation: root 198 tests and API 108 tests pass; strict TypeScript/Vite build
passes. Regressions cover Ready-to-Booked display/filtering, later workflow
statuses, missing IDs, failed reads, batch limits, scoped/global read grants,
unmatched roles/sites, invalid identities and status-only projection. An
independent review found no critical or important issues. Direct live read-only
queries verify production REQ-1283's saved status. Actual signed-in list behavior
still requires the user's test-browser session.

Release sequence: production rollback snapshot, minimal backend package,
verified backend publish, dev upload/restart/hash and permission verification,
then the authorized production follow-up upload/restart and runtime verification.

Backend deployment `a2a9e34ce8b7415ca24f80b78ddf1c2b` completed at
04:24:18 UTC with unchanged configuration fingerprint
`35aef3a27c4dbfbd1cb84eb690f895d79195f5ce1169ef5ffc42325292f20e1c` and all
12 triggers. Runtime ZIP SHA-256:
`FA2F62D668335E0957D5632E4DD10B77F5C2D6E6C05A78DA0E38E77D9E79EF4F`.
Only the handler and new status-reader module/maps differ from the previous
runtime. Booking transaction code is byte-identical to the preceding release.
Both origins reject unsigned status reads with HTTP 401, correct CORS and
`Cache-Control: no-store`. A read-only live check at 04:26:25 UTC returned
REQ-1283 status `3`, confirmed implicit authenticated-role discovery, and
confirmed the real Dataverse owner filter denies a different owner.

Dev upload completed 74/74 events in 187.71 seconds. Restart and fresh asset
hashes were verified at 04:30:34 UTC; all 53 permissions and 26 field settings
were unchanged/verified. After restart warm-up the site returned its expected
Microsoft tenant sign-in redirect. Production preflight built the identical
`index-DiJ8Jqe5.js` bundle (SHA-256
`a0f80311ccac53912b69ed69544db179d305b83c93dfc81e1a82a3aa707b8376`).
An unsigned full 100-ID request (3,931-character query string) reached the live
Function handler and returned the expected HTTP 401/no-store/CORS response,
confirming the gateway accepts the full batch URL length.

Production upload completed 71/71 events in 139.46 seconds. Restart and deployed
hash/permission verification completed at 04:36:00 UTC. All 53 permissions were
unchanged; 25 field settings across 24 tables were verified with no duplicate
corrections. At 04:37:08 UTC the production homepage and both release assets
returned HTTP 200, referenced the new bundle, and matched its byte hashes.
The first post-restart request timed out during warm-up; the retry passed.
At 04:36:28 UTC the final live read again returned REQ-1283 status R (`3`),
verified default authenticated membership, denied a different owner, and passed
a real 100-ID owner-scoped Dataverse query. Zero business writes were performed.

Browser navigation to `/requests` loaded the release but confirmed the test
browser remained signed out. The authenticated badge/filter check is recorded
as skipped, rather than claiming a signed-in runtime test. Production evidence
is in `docs/alm/production-request-list-status-2026-10-16.json` and the updated
`last-deploy.json` / `last-test-site.json`; the preceding reports are archived.
Rollback SPA/metadata snapshot is retained in
`.deployment-staging/prod-rollback-request-status-20261016/`, and the previous
Function ZIP is preserved. No data repair, schema/permission change, commit or
push was performed.
