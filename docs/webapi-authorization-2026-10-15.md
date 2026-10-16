# Development Web API authorization incident — 2026-10-15

**Status:** Column-configuration fix deployed to GCP-Developer and dev site
restarted. Live configuration verified; signed-in request-list confirmation
has been requested from the user.

**Follow-up:** The PP/JVP submission report exposed missing case-sensitive
lookup write names in this initial migration. The
[lookup-write follow-up](webapi-lookup-writes-2026-10-15.md) records the complete
source audit and 55 metadata-verified additions. The read/configuration
evidence below remains historical; it did not establish working submissions.

## Report and verified cause

After the development release, the user reported HTTP 403 / `90040122`
(`WebApiUnAuthorizedAccess`) on the Requests list while signed in as either an
administrator or a requestor. The supplied GET targets `/_api/gcp_requests`
with the existing 35-column `DEFAULT_REQUEST_SELECT`, `createdon desc`, and
`$count=true`.

Read-only inspection of the exact GCP-Developer site confirmed
`Webapi/gcp_request/fields = *`. Twenty-three of the site's 24 configured tables
still use wildcard field settings; contact already has an explicit list.
Microsoft removed wildcard support on September 14, 2026, including requests
from authenticated users. This is a column-configuration failure, independent
of the original request's table-permission scope.

Primary reference:
https://learn.microsoft.com/en-us/troubleshoot/power-platform/power-pages/migrate-web-api-wildcard

The preceding release verified uploaded artifacts, backend anonymous rejection,
and booking permission metadata but did not catch the obsolete column settings.
Signed-in SPA workflows were not exercised in that release.

## Access policy retained

The user confirmed that administrators, reviewers, and verifiers can read all
requests, while requestors can read only their own. The live `gcp_request`
permission union already implements this policy:

| Actor | Existing scope |
|---|---|
| Requestor / default Authenticated Users | Contact, via verified `gcp_request_RequestorName_contact` (`gcp_requestorname` → contact) |
| Administrators | Global Read, with existing administration privileges |
| Reviewer / Verifier | Global Read, with separate existing review/verification Write |

Permissions accumulate. A user with Requestor plus Administrator/Reviewer/
Verifier receives the broader role's access. Existing HOC company scope and
Endorser/Working/Main committee policies are preserved. No role IDs, contact
assignments, table permissions, Dataverse schema, choice values, or browser
authentication mechanism are changed by this incident fix.

## Remediation and checks

1. Inventory actual projections, payloads, filters, ordering, and lookup binds
   for every currently exposed table; compare them with deployed metadata.
2. Replace wildcard site settings with explicit used-column lists. Include
   verified logical lookup names and the computed `_lookup_value` names needed
   by reads. Preserve each existing site-setting ID.
3. The live site has duplicate `fields` records for `gcp_projects` and
   `gcp_signatorymember1`; update both copies consistently without deleting
   records or creating a second local source of truth.
4. Verify the reported projection, all default typed-service projections,
   supplementary reads, used writes, and metadata validity. Keep the parent
   permission matrix covered by a regression check.
5. Build and deploy only to the already authorized dev site, following the
   mandatory upload checklist; restart it after verified upload success.
6. Read back all deployed settings and the permission union. Signed-in
   administrator/requestor/reviewer/verifier runtime checks are still needed
   to prove the complete portal behavior.

## Completion evidence

- Initial regression run: three configuration checks failed as expected; the
  parent access-policy check passed. After migration, all four focused checks
  passed, and the full root suite passed **182/182**, with no failures/skips.
- The SPA TypeScript/Vite build passed immediately before upload. Its existing
  mixed-import and bundle-size warnings are unchanged; no frontend behavior or
  API Function code was changed by this incident fix.
- Independent review checked all 24 column lists against deployed metadata,
  real default/supplementary projections, filters/order columns, and inventoried
  writes/lookup navigation names. No Important/Critical blocker was found in
  the migration. All table GET paths already use explicit selections.
- The mandatory upload checklist reverified GCP-Developer, user
  `o3csconsultant@O3CS.my`, site `517038c0-eca4-4529-a872-f613ea02ad32`, active
  Enhanced data model, current `dist`, and absence of Standard permission
  tombstones. The known duplicate-auth-profile error during `pac org select`
  did not change the independently verified target.
- PAC upload reached **100%, 71/71 events** and printed
  `Power Pages website upload succeeded in 162.10 secs` and `Upload complete`,
  without a rejected required operation or upload error.
- Post-upload readback identified only two remaining wildcard records: existing
  duplicate project fields ID `c1671f1f-c25c-f111-a826-7ced8dfee0c6` and
  signatory fields ID `38ac9718-8a61-f111-a826-7ced8dfee0c6`. Conditional ETag
  PATCHes aligned their `content.value` with the canonical lists, preserving
  the rest of their content, IDs, site ownership, and all other settings. No
  records were deleted. Future column-list changes must keep duplicate values
  aligned unless a separately reviewed cleanup removes them.
- Final live readback verified **24 tables / 26 fields records**, **zero
  wildcard values**, and an unchanged normalized fingerprint of all **53**
  existing table permissions. The request list's 35 columns are included in
  its explicit 46-field read/write allow list. Contact's eight-field list was
  preserved unchanged.
- Restart of the exact dev runtime site returned `success: true` for
  `https://gcp-nexus.powerappsportals.com`. No production-site upload/restart,
  shared Function publish, Dataverse schema mutation, business-record write,
  commit, or push occurred for this incident fix.
- A focused HTML audit is available at
  [permissions-audit-webapi-2026-10-15.html](permissions-audit-webapi-2026-10-15.html).
  It records the separate pre-existing child-access gap rather than claiming
  full data isolation. The user was asked to hard-refresh Requests and report
  whether the signed-in list and role visibility now work. A successful
  authenticated HTTP 200 is not yet claimed.

## Repeat dev deployment requested on 2026-10-15

- Reverified the authorized GCP-Developer environment and active Enhanced
  `gcp-nexus` SPA, completed the mandatory upload checklist, and rebuilt the SPA
  immediately before uploading the current `dist`.
- PAC completed **100%, 71/71 events**, reporting
  `Power Pages website upload succeeded in 157.13 secs` and `Upload complete`
  without an upload error or rejected required operation.
- Fresh live verification again confirmed **24 tables / 26 fields records**,
  **zero wildcard values**, no duplicate corrections required, and unchanged
  table-permission fingerprints.
- The dev restart returned `success: true`. An anonymous request to the site
  returned HTTP **302** to the private site's sign-in gate after restart.
  Signed-in request-list and role visibility checks remain unverified.

## Separate findings outside the column-configuration fix

- Ordinary authenticated users have existing Global read/write grants on many
  matter child tables and Global reads on signatures/engagements. Although
  parent request access is correctly scoped, direct child-table access is
  broader. A separate hardening change must preserve trusted-role editing,
  HOC/committee policies, booking availability, and signature reuse before
  narrowing those grants. This incident fix does not claim child-data isolation.
- The shared schema validator rejects four existing IDs for RFC UUID variant
  formatting. These GUIDs exist successfully in Dataverse; do not regenerate
  deployed component IDs to satisfy that stricter validator.
- Existing RTP verifier-comments projection and STSP display-only resource
  contribution omissions are not changed as part of this fix.
