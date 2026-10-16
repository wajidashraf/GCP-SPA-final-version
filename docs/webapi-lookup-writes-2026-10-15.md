# Web API lookup writes and booking-state audit — 2026-10-15

**Status:** Deployed to GCP-Developer; settings/permissions and bundle verified,
site restart succeeded, and the browser reaches Microsoft sign-in. Signed-in
workflow verification is awaiting user-controlled authentication.

## Reported failures and evidence

Procurement Plan (`/submit/gcpc/pp`) and JVP (`/submit/gcpc/jvp`) submissions
reported `Attribute gcp_RequestorName in table gcp_request is not enabled for
Web Api`. All matter forms share the parent request creation service, which
binds the original requestor using `gcp_RequestorName@odata.bind`.

The prior wildcard migration included the lookup logical column
`gcp_requestorname` and read property `_gcp_requestorname_value`, but omitted
the exact navigation property `gcp_RequestorName`. The previous regression
check only exercised reads and required lowercase allow-list entries. It could
not catch this write failure. This follow-up corrects that audit gap.

Microsoft documents case-sensitive Web API operations and requires columns used
by payloads, queries, filters, sorting, and related reads to be enabled:
[Web API overview](https://learn.microsoft.com/en-us/power-pages/configure/web-api-overview)
and [wildcard migration troubleshooting](https://learn.microsoft.com/en-us/troubleshoot/power-platform/power-pages/migrate-web-api-wildcard).
The reported runtime error identifies the navigation spelling that must also
be retained; normalizing it to lowercase loses a distinct, required entry.

## Audit scope and correction

Fresh read-only dev inspection verified 24 configured tables and 26 field
setting records, including existing project/signatory duplicates. Each added
navigation name was checked against the exact deployed
`ReferencingEntityNavigationPropertyName` and its underlying logical lookup.
No navigation property, logical name, column, choice, relationship, table, or
role ID was invented or changed.

The durable source inventory in `tests/webApiColumnInventory.ts` covers all
23 direct SPA Web API table services, their projections, actual scalar/form
payloads, exact lookup bindings, dynamic attendee bindings and null clearing,
supplementary filters/sorting, and shared child integrity/deletion queries.
It identifies 386 distinct executable table/column pairs. The 24th configured
table, signatory membership, is currently accessed through Server Logic; its
existing setting is preserved. There are no executable `$expand` queries; a
regression guard requires target-aware auditing when one is introduced.

Fifty-five exact navigation entries were added across these 20 existing settings:

| Logical table | Added exact navigation names |
|---|---|
| `gcp_request` | `gcp_RequestorName`, `gcp_Company`, `gcp_Project`, `gcp_Verified_by`, `gcp_Reviewedby` |
| `gcp_projects` | `gcp_Company` |
| `gcp_engagements` | `gcp_Slot`, `gcp_Request`, `gcp_EngagementCreatedBy`, `gcp_AttendeeEmail` |
| `gcp_slot` | `gcp_Attendee`, `gcp_Attendee_1`, `gcp_Attendee_2` |
| `gcp_rtprequest` | `gcp_Request`, `gcp_Company`, `gcp_ClientsName`, `gcp_Requester`, `gcp_Verifiedby` |
| `gcp_pblrequest` | `gcp_Request`, `gcp_Project` |
| `gcp_pblbidders` | `gcp_PBLRequest`, `gcp_CompanyName` |
| `gcp_jvmrequest` | `gcp_Request`, `gcp_Project` |
| `gcp_stsprequest` | `gcp_Request`, `gcp_Project` |
| `gcp_caarequest` | `gcp_Request`, `gcp_Project`, `gcp_Company` |
| `gcp_pccarequest` | `gcp_Request`, `gcp_Project`, `gcp_Company` |
| `gcp_pprequest` | `gcp_Request`, `gcp_Project`, `gcp_Company` |
| `gcp_vaprequest` | `gcp_Request`, `gcp_Project`, `gcp_Company` |
| `gcp_otherrequests` | `gcp_Requestlookup`, `gcp_Project`, `gcp_Company` |
| `gcp_cprrequestgcp` | `gcp_Request`, `gcp_Project`, `gcp_Company` |
| `gcp_requestcigcp` | `gcp_Request`, `gcp_Project`, `gcp_Company` |
| `gcp_rpccarequestgcp` | `gcp_Request` |
| `gcp_rpprequest` | `gcp_Request`, `gcp_Project`, `gcp_Company` |
| `gcp_signature` | `gcp_Request`, `gcp_Signatory` |
| `gcp_suggestion` | `gcp_Request`, `gcp_Contact` |

Existing logical/read names and setting IDs are retained. Account, contact,
email-template, and signatory-member lists require no additions. This enables
every audited application column without restoring the retired wildcard or
exposing all unrelated schema columns. Table permissions remain unchanged.

Unused optional input contracts `gcp_notes`, RTP `gcp_verifiercomments`, and
STSP `gcp_resourcescontribution` are distinguished from executable payloads.
They are not silently enabled or persisted; the resource-contribution image
continues to follow the existing display-only mapping.

## Ready request with an already scheduled engagement

Read-only inspection found one such dev request: **REQ-0095**
(`f52a21d3-4265-f111-ab0d-7ced8dfee0c6`). It is at Ready (`2`) while engagement
R01 (`07cd8828-4365-f111-ab0d-7ced8dfee0c6`) is Scheduled (`1`) and linked to
one Booked slot for 30 June 2026. That slot has exactly one scheduled
reservation. The engagement was last modified on 11 June and the request on
1 August; this saved mismatch predates the October release.

The older booking implementation wrote the engagement, slot reservation, and
parent status in separate calls, which could leave partial state. That is a
possible explanation, not a confirmed history of this record. The current
server transaction already updates booking/slot/request together and rejects
duplicate scheduled engagements.

The client still offered Create Engagement despite loading a scheduled
engagement. The fix makes the creation policy consider the loaded scheduled
booking, suppresses the duplicate action on Request Detail and the engagement
page, and proactively explains Ready-plus-Scheduled inconsistencies on the
engagement page. Existing original-requestor/admin edit and reschedule rules
at Booked (`3`) remain intact. The recently hidden history panels remain hidden.

The user explicitly chose **leave saved data unchanged; fix app behavior only**.
REQ-0095, its engagement, slot, and all other business records are not repaired,
cancelled, recreated, or otherwise modified by this work.

## Verification

- Requestor lookup regression failed before the setting fix.
- Active-booking creation regression failed before the UI/policy fix.
- Full root Node suite: **188/188 passed**, no failures/skips.
- SPA TypeScript/Vite build passed; existing mixed-import and bundle-size
  warnings remain. A fresh build is also required immediately before upload.
- `git diff --check` passed before deployment.
- Signed-in PP/JVP submission and affected-role booking checks remain required;
  administrative metadata readback does not prove those browser workflows.
- No backend publish, production deployment, schema mutation, commit, push, or
  business-record write is part of this fix.

## Dev deployment evidence

- Revalidated PAC identity `o3csconsultant@O3CS.my`, environment
  `19d73dc4-0f30-e868-bf7d-8abcd4b89699`, dev organization URL, active Enhanced
  SPA, and website `517038c0-eca4-4529-a872-f613ea02ad32`. The known PAC
  profile-selection crash was followed by a successful independent exact org
  check; authentication profiles were preserved.
- Completed the mandatory upload checklist, including fresh build, exact
  `gcp-nexus` / `dist` configuration and manifest-model inspection.
- PAC reached **100%, 74/74 events**, reporting
  `Power Pages website upload succeeded in 211.23 secs` and `Upload complete`,
  without an upload error or rejected required record.
- Readback verified all **24 tables / 26 field records**, including all 55
  added navigation names. The existing duplicate project setting
  `c1671f1f-c25c-f111-a826-7ced8dfee0c6` was conditionally aligned to the
  canonical value while preserving its other content and identity. No setting
  was deleted or recreated. All **53 table permissions** matched the pre-fix
  fingerprint.
- The exact dev site restart returned `success: true` for
  `https://gcp-nexus.powerappsportals.com`.
- Downloaded deployed JavaScript and CSS through administrative Dataverse
  access and compared them byte for byte with `dist/assets`; both match:

  | Artifact | SHA-256 |
  |---|---|
  | `index-CbVIGXUh.js` | `AD2BFE7D43D513C8551DEC7A8787D1D37AA8A4386C013F1FEE451144EEC14E58` |
  | `index-wEz7mtdN.css` | `0111B6D9BB7682F001D3BF95DE3AE3A84F49C255E0B17CE8D126889CAB91A61D` |

- Initial browser navigation after restart returned HTTP 503. A later fresh
  navigation recovered and reached the tenant's Microsoft sign-in page. The
  automated browser has no signed-in portal session; the user was asked to
  sign in or finish with deployment checks only. No login was automated and
  no real submission was replayed. A successful PP/JVP submission is not yet
  claimed.
- Independent review found no Critical/Important issues in the exact-name
  settings fix, source audit, or booking guard. A minor test-inventory omission
  for the already enabled contact phone column was reproduced and corrected;
  all default query projections now have explicit inventory coverage. The
  final root suite still passes 188/188 and `git diff --check` passed after
  trimming PAC-generated trailing spaces on empty manifest checksums.

## Repeat dev deployment requested — 2026-10-15

- Repeated the complete mandatory upload checklist for the same explicitly
  authorized GCP-Developer environment and website. The fresh SPA build passed;
  the deployed JavaScript/CSS content is unchanged from the fix above.
- PAC reached **100%, 73/73 events**, reporting
  `Power Pages website upload succeeded in 241.64 secs` and `Upload complete`
  without an upload error or rejected required record.
- Live readback again verified **24 tables / 26 field records**, all 55 exact
  navigation permissions, and all **53** unchanged table permissions. No
  duplicate setting needed correction on this repeat deployment.
- Dev restart returned `success: true`. Both deployed bundles again matched
  the fresh build hashes above; verification completed at
  `2026-10-15T19:13:20.480Z`.
- The first read-only availability probe immediately after restart returned
  HTTP 503; a later probe recovered to the expected **302** private-site
  redirect to Microsoft's identity provider. Signed-in application checks
  have not run for this repeat deployment. No business record, production site,
  shared Function code/settings, commit, or push was changed.
