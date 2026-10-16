# Shared historical slot rescheduling — 2026-10-15

Status: **deployed to the shared backend and both portals; production verified
on 16 October 2026.** Signed-in booking saves remain unverified.

The user reported production rescheduling failures for REQ-1262 and REQ-1282
after the production release. Existing data was inspected read-only. No request,
engagement, slot, or workflow status was repaired or changed during investigation.

## Evidence and cause

- REQ-1262 (`9992fa3e-14bb-f111-aaae-70a8a5706abb`) is at R (`3`) with one
  Scheduled R01 engagement (`6f685864-14bb-f111-aaae-70a8a5706abb`) dated
  29 September 2026.
- Its slot (`35ef2d0d-14bb-f111-aaae-70a8a5706abb`) was subsequently reused:
  it now represents 23 December 2026 and is also linked to the Scheduled
  engagement of REQ-1279 (`93fd341d-02c2-f111-aaaf-000d3a091cd7`). Both links
  predate this release. The other request is at status `12`; its engagement's
  stored Scheduled status is preserved rather than inferred or repaired.
- The new transaction required exactly one Scheduled engagement on the old
  slot, so it rejected REQ-1262 before any mutation. That avoided releasing
  another reservation but also prevented moving this booking away safely.
- REQ-1282 (`50d78b8f-bcc6-f111-a05c-000d3a091cd7`) was Ready for Engagement
  (`2`) with no engagement. The specific old-slot conflict was not reproduced
  from its saved data. Its normal action is creation, not rescheduling.
  The frontend now clears prior submission errors when loading a request so a
  previous request's failure is not carried into a new booking page.

## Fix and safeguards

The owner/site administrator can move their own single Scheduled engagement
to a future Available slot with no Scheduled reservations. If other Scheduled
engagements remain on the old slot, the transaction keeps it Booked and does
not write to those engagements. An exclusively occupied old slot is released
as before. Same-slot detail edits keep saved engagement dates and all existing
reservations. Cancellation retains shared slots even when the normal time
policy would permit release.

The current engagement must still appear exactly once in the old slot's
Scheduled collection. Request stage, ownership, binding, destination availability,
and conditional request/engagement/slot guards remain enforced. All operations
stay in one atomic change set. Lost-response reconciliation requires the new
booking plus the exact remaining old-slot reservation IDs/status; it cannot
declare success if the shared slot was released or another reservation vanished.

Both booking editors display the current choice using the engagement's saved
dates, preserving the underlying slot identity/status. This avoids presenting
the slot's newer December time as the unchanged September booking. Other
available choices retain their live slot dates. No display mapping writes data.

## Verification

- Ten new/changed backend behavioral checks reproduced the old rejection before
  the fix. The complete API build and suite pass **87/87**, including owner/admin
  moves, retained reservations, occupied destinations, same-slot dates, cancellation,
  old-slot ETag rollback, lost responses, and existing authorization/create tests.
- Three saved-date display tests failed before the helper was implemented and
  then passed. The complete root suite passes **191/191**.
- A separate read-only execution of the fixed planner against live production
  records captured a valid rescheduling plan for REQ-1262 and a creation plan
  for REQ-1282. Its transaction adapter only captured operations locally:
  **zero writes were sent**. The REQ-1262 plan retained the old slot as Booked.
- Independent review found no important backend authorization/concurrency/
  reconciliation issues, and identified the saved-date display issue addressed
  above. Final follow-up review and deployment verification are recorded below.

The read-only plan and local tests do not replace a signed-in portal save.
Runtime rescheduling verification requires the user's chosen destination and
normal authorized save; no production test booking is created automatically.

## Verified rollout — 16 October 2026

The user explicitly requested checking and deploying the fix to production.
The existing shared Function hotfix was independently confirmed as the latest
active, complete Azure deployment, ID `c6011b0e68614d4281c41a05bec71156`, status
`4`. It completed at `2026-10-15T20:43:56Z`; the package changes only the compiled
booking module and its source map. All 12 Function registrations and unchanged
app-setting fingerprints were verified at publish. Fresh probes on 16 October
returned 401 with matching CORS for booking, notification, and upload endpoints
from both portal origins. Live production routing, application privileges, and
booking concurrency checks passed again.

Package SHA-256:
`F40A00B6BD66A466C66346E6DA0C34508D9CA055090061D03D265753E23CCD3D`.
Booking module SHA-256:
`DDE1A6A6AC00B6CC7AE3929F79441027BBF3D7D97FF7F069D9C683C41466D30E`.
The prior published ZIP remains available locally for rollback. A fresh snapshot
of production SPA files and applicable metadata was saved under ignored
`.deployment-staging/prod-rollback-shared-slot-20261016/` before uploading.

The root suite passed **191/191** and API build/suite **87/87** in the current
rollout. The follow-up independent review confirmed the saved-date display
finding was addressed and found no remaining Important issues.

The mandatory upload checklist was followed separately for each portal, with a
fresh TypeScript/Vite build immediately before its upload. Existing bundle-size
and mixed-import warnings remain. Neither upload reported an error:

| Check | Development | Production |
|---|---|---|
| PAC completion | 100%, 74/74 events; 196.21 seconds | 100%, 71/71 events; 142.38 seconds |
| Runtime restart | Successful | Successful |
| Field setting readback | 26 records / 24 tables | 25 records / 24 tables |
| Permissions | All 53 unchanged | All 53 unchanged against the fresh snapshot |
| Deployed bytes | Exact fresh-build match | Exact fresh-build match before and after restart |

Final bundle hashes:

| File | SHA-256 |
|---|---|
| `index-BBqXTnKg.js` | `382aea37a557e9800a8bfbe53837979fa663d296796b96352d6cca58ea53111f` |
| `index-DMnDV12K.css` | `da9d0ec8030674622a8210c1394c7baa044c7ec330b7f26066cf0f0b08cfd1d9` |

Dev recovered to its expected HTTP 302 Microsoft private-site sign-in gate.
At `2026-10-16T03:13:17Z` (**06:13 Riyadh time**), the production homepage and both
new assets returned **200**, the homepage referenced the new files, and their
served bytes matched the fresh build. Initial post-restart probes timed out
during warm-up; retries passed. Browser navigation loaded the new JavaScript
and then the expected sign-in page, with no portal user session and no console
errors. Signed-in saves were not attempted.

The current read-only planner verification again passed REQ-1262 rescheduling
and REQ-1282 creation while capturing transactions locally with zero writes.
The original saved records remained as inspected; no automatic data repair,
production test booking, schema change, permission broadening, commit, or push
was performed. PAC-generated spaces on empty manifest checksums were trimmed
locally after uploads. Current machine-readable evidence is in
`docs/alm/last-deploy.json` and `docs/alm/last-test-site.json`.

**Later follow-up, 16 October:** The
[cache/workflow release](booking-cache-workflow-fix-2026-10-16.md) replaces the
deployment evidence above with a newer build while retaining this shared-slot
fix. It addresses stale portal reads, create-workflow self-conflicts and stale
open editors. The older rollout evidence remains historical.
