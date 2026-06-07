# GCP Nexus — Requests User Guide

This guide covers the **Requests** section of GCP Nexus: how to browse submitted requests, understand statuses, and use each action button to move a request through its review lifecycle.

---

## Table of Contents

1. [Requests List](#1-requests-list)
2. [Request Detail](#2-request-detail)
3. [Action Buttons & Related Pages](#3-action-buttons--related-pages)
   - 3.1 [Verify Data](#31-verify-data--status-new)
   - 3.2 [Book Engagement](#32-book-engagement--status-ready-for-engagement)
   - 3.3 [Review Request](#33-review-request--status-r)
4. [Request Status Reference](#4-request-status-reference)
5. [Decision Code Reference](#5-decision-code-reference)
6. [Full Lifecycle Workflow](#6-full-lifecycle-workflow)

---

## 1. Requests List

**URL:** `/requests`

The Requests page shows every submitted request in a filterable, paginated table.

### Columns

| Column | Description |
|---|---|
| **Request no.** | Unique request title (or a short ID if no title). A GCP / GCPC channel badge is shown alongside. |
| **Matter type** | The form type submitted (e.g. RTP, PBL, JVP, PCCA). The short code badge appears below the full label. |
| **Requester** | Name and email of the person who submitted the request. |
| **Project** | Project name linked to the request. |
| **Company** | Company name and code of the requestor. |
| **Status** | Colour-coded status pill showing the current lifecycle stage (see [Status Reference](#4-request-status-reference)). |
| *(action)* | A context-sensitive button — label changes based on the current status (see below). |

### Filter Bar

Five filters appear at the top of the page. They work together — all active filters must match for a row to show.

| Filter | Type | Behaviour |
|---|---|---|
| **Project** | Text search | Case-insensitive partial match on the project name. |
| **Company** | Text search | Partial match on company name or company code. |
| **Status** | Dropdown | Exact match on a single request status. |
| **Matter type** | Dropdown | Exact match on a specific form type (RTP, PBL, etc.). |
| **SOA code** | Dropdown | Exact match on the SOA code assigned at submission. |

When any filter is active a **brush icon** (Clear filters) button appears to reset all filters at once.

A count badge on the page header shows the total number of records and, when filters narrow the list, how many currently match.

### Row Action Button

The last column shows a button whose label and icon change based on the request's current status:

| Status | Button label | Icon |
|---|---|---|
| **New** | Verify | Shield-check |
| **Draft Review** | Engage | Calendar-check |
| *Any other status* | View | Arrow-up-right |

Clicking the button (or anywhere on the row) opens the [Request Detail](#2-request-detail) page for that request.

### Pagination

The table shows **10 rows per page**. Use the **← / →** buttons to move between pages. The footer shows the current range (e.g. "Showing 1 to 10 of 34").

If the server has more records than the currently loaded batch, a **Load more** button appears next to the page controls. Clicking it fetches the next batch from Dataverse and adds them to the local filter pool.

---

## 2. Request Detail

**URL:** `/requests/:id`

The detail page is a read-only summary of one request. It is divided into a **header**, a **record bar**, two **information sections**, a **review history section**, and a status-driven **action area**.

### Header

The navy hero header shows:
- **Matter label** — the full name of the form type (e.g. "Prospective Bidders List (PBL)").
- **Matter code badge** — the short code (e.g. `PBL`, `RTP`, `PCCA`) coloured by channel (GCP = dark, GCPC = lighter).
- **Request ID / title** — the unique request identifier.
- **Category** — GCP or GCPC.
- **Status pill** — the current lifecycle status with a colour indicator dot.

### Record Bar

A slim strip below the header shows quick-scan metadata:
- Project name
- Company name
- Submission date
- An "Acknowledged" badge (shield icon) if the requestor confirmed the acknowledgement checkbox during submission.

### Section 1 — Basic Information

Common fields that every request type records:

| Field | Notes |
|---|---|
| Matter Title | Full name of the matter/form type. |
| Project Name / Contract | Labelled "Project Name" for registration/proposal types (RTP, PBL, JVP, ST/SP, CAA); "Contract" for all other types. |
| Requestor | Contact name of the person who submitted. |
| Requestor Email | Email address. |
| Company | Submitting company. |
| Project Code | Auto-populated ERP project code. |
| Submitted On | Date and time of submission. |

### Section 2 — Detail Information

Form-specific fields pulled from the child record linked to this request (e.g. tender dates for RTP, bidder lists for PBL, cost figures for PCCA). The exact fields depend on the matter type.

If no child detail record exists, or the matter type does not have a structured detail view yet, an info notice is shown in this section.

### General Review Section

Visible for all requests **except** those still at status **New**. Shows:
- **Comment** — the verifier's written comment from the Verify Data step.
- **By** — the name of the staff member who verified the data.

This section is populated when a verifier submits the [Verify Data](#31-verify-data--status-new) form.

### Action Area

One action button appears at the bottom of the page. Which button shows (if any) is determined by the current request status:

| Status | Button shown | Navigates to |
|---|---|---|
| **New** | Verify Data | `/requests/:id/verify-data` |
| **Ready for Engagement** | Book Engagement | `/requests/:id/engagement` |
| **R** (Under Review) | Review Request | `/requests/:id/review` |
| *All other statuses* | *(no button)* | — |

Each button and its destination page are described in detail in the next section.

---

## 3. Action Buttons & Related Pages

### 3.1 Verify Data — Status: New

**Button:** Verify Data (shield-check icon)
**URL:** `/requests/:id/verify-data?type=<matter>`

This is the **first action** in the lifecycle. A verifier reviews the submitted data and decides the next step for the request.

#### What you see

- **Request Status** dropdown — select the outcome status (options depend on the matter type; see below).
- **Comment** text area — optional free-text note recorded against the request as the verifier comment. It will be visible in the General Review section on the detail page.

#### Status options by matter type

| Matter type | Available statuses |
|---|---|
| Default (most types) | FR, RS, Ready for Engagement |
| RTP (special project) | FR, RS, Ready for Engagement, W |
| PP, VAP, RPP, CAA, CI, R-PCCA, R-PP, GCP-Others | FR, RS, Pending Ack (no Ready for Engagement) |
| CPR (Contract Progress Report) | FR only |

The request's current status is always included in the dropdown.

#### What happens on submit

1. The request status is updated to the selected value.
2. The verifier comment, verification date, and verifier name are saved to the request record.
3. The page polls until Dataverse confirms the new status, then returns to the detail page.

---

### 3.2 Book Engagement — Status: Ready for Engagement

**Button:** Book Engagement (calendar-check icon)
**URL:** `/requests/:id/engagement?type=<matter>&soacode=<soa>`

Used to schedule a formal engagement (meeting) between the reviewer and the requestor. This step moves a request from "Ready for Engagement" into an active review session.

#### What you see

**Existing engagements panel** — a list of all engagements previously created for this request, showing:
- Date, time range, duration
- Engagement type (Virtual or In-Person) badge
- Status badge (Scheduled / Cancelled / Completed)
- A **Cancel** button for any currently Scheduled engagement

**Book a new engagement panel** — a form to schedule a new engagement:

| Field | Description |
|---|---|
| **Available slot** | Select from reviewer-defined time slots that are still available and fall within the next 90 days. |
| **Type** | Virtual or In-Person. |
| **Location** | Shown only for In-Person; choose a meeting room or enter a custom location. |
| **Notes** | Optional free-text to include with the booking. |

#### Constraints

- Only one **Scheduled** engagement is allowed at a time per request.
- If a scheduled engagement already exists, the "Book a new engagement" form is hidden and a notice is shown instead.

#### What happens on submit

1. A new engagement record is created in Dataverse and linked to the request and the selected slot.
2. The slot is marked as **Booked**.
3. The page reloads showing the new engagement in the list.

---

### 3.3 Review Request — Status: R

**Button:** Review Request (clipboard-check icon)
**URL:** `/requests/:id/review?type=<matter>&soacode=<soa>`

Used by the reviewer to record a **formal decision** on the request after the engagement session has taken place. This is the core review decision screen.

#### Layout

The field order depends on the matter type:

- **Standard layout** (most matter types): Decision Code → Reviewer Comments
- **Special layout** for PCCA, PP, R-PCCA, R-PP (matter types 6, 7, 10, 14): Info and Criteria for Review → Reviewer Comments → Decision Code

#### Fields

**Decision Code** *(required)*

A radio-button list. Select one code — the full description is shown beside each option:

| Code | Label | Description |
|---|---|---|
| Code 1 | Proceed | Proceed with acceptance of review. |
| Code 2 | Resubmit | Resubmit for review, critical information missing. |
| Code 3 | Non-compliant | No submission for review. Non-compliance. |
| Code 4 | Exempted | Exempted for review and approved by Main GCPC (signed letter as attached). |
| Code W | Waived | Waived for review. Company attached signed Waiver Form from Group CEO. *(ST/SP requests only)* |

**Reviewer Comments** *(optional)*

A block-based editor. Add one or more content blocks by clicking the toolbar buttons:

| Block type | Use |
|---|---|
| **Text** | A free-text paragraph. |
| **Bulleted list** | An unordered list of points. |
| **Numbered list** | An ordered list of points. |

Each block can be moved up/down with the arrow buttons or removed with the trash icon. Within list blocks, individual items can be added or removed.

The comments are stored as structured JSON in the `gcp_reviewercomments` column.

**Info and Criteria for Review** *(PCCA / PP / R-PCCA / R-PP only)*

A free-text textarea prefilled from the existing record value. Edit as needed before submitting.

#### Confirmation

After clicking **Submit Review**, a confirmation modal appears. Click **Confirm** to proceed or **Cancel** to go back and adjust.

#### What happens on submit

1. The decision code, reviewer comments, review date, and reviewer name are saved to the request record.
2. The request status and outcome are updated according to the decision code (see [Decision Code Reference](#5-decision-code-reference)).
3. The **Scheduled** engagement linked to this request (if any) is automatically marked **Completed**.
4. The page polls until Dataverse confirms the new status, then returns to the detail page.

---

## 4. Request Status Reference

| Status | Value | Colour | Meaning |
|---|---|---|---|
| New | 1 | Blue | Request submitted, awaiting data verification. |
| Ready for Engagement | 2 | Gold | Verification passed; awaiting engagement booking. |
| R | 3 | Amber | Engagement complete; awaiting reviewer decision. |
| Draft Review | 4 | Purple | Review submitted (Code 1); pending internal acceptance. |
| Pending Review | 5 | Purple | Queued for further review. |
| Complete Review | 6 | Purple | Review fully completed. |
| Pending Acceptance | 7 | Purple | Awaiting HOC acceptance signature. |
| Complete Acceptance | 8 | Purple | Acceptance stage completed. |
| Pending Ack | 9 | Purple | Awaiting acknowledgement. |
| ACK | 10 | Green | Acknowledged — HOC signed Acceptance of Review. |
| Pending Endorse | 11 | Purple | Awaiting HOC endorsement signature. |
| E | 12 | Green | Endorsed — HOC signed Acceptance of Review (GCPC). |
| Submitted | 13 | Blue | Re-submitted after rework. |
| Under Verification | 14 | Blue | Currently being re-verified. |
| Scheduled | 15 | Blue | Engagement session scheduled. |
| RS | 16 | Amber | Resubmission required (Code 2 outcome). |
| NC3 | 17 | Red | Non-compliant (Code 3 — GCPC). |
| NC4 | 18 | Red | Non-compliant (Code 4 — no review requested). |
| W | 19 | Grey | Compliant with waiver (Code W). |
| FR | 0 | Red | For Revision — sent back for rework. |

---

## 5. Decision Code Reference

The decision code chosen on the Review Request page determines the **request status** and **outcome** written to the record.

| Code | GCP outcome | GCPC outcome | "Others" type outcome | Status set |
|---|---|---|---|---|
| **Code 1** | ACK | E | FA | Draft Review (4) |
| **Code 2** | RS | RS | RS | RS (16) |
| **Code 3** | NC | NC3 | NC / NC3 | NC3 (17) |
| **Code 4** | NC4 | NC4 | NC4 | NC4 (18) |
| **Code W** *(ST/SP only)* | W | W | W | W (19) |

**"Others" types** = GCP-Others (matter 13) and GCPC Others Form (matter 9). These receive outcome **FA** (For Action) on Code 1.

---

## 6. Full Lifecycle Workflow

```
Submit request
       │
       ▼
  Status: New
       │
       │  [Verify Data button]
       │  Verifier reviews submitted data
       │  and picks an outcome status
       │
       ├─── FR (0) ──────────────────────► For Revision (returned to requestor)
       │
       ├─── RS (16) ─────────────────────► Resubmission required
       │
       ├─── Pending Ack (9) ─────────────► Pending acknowledgement flow
       │
       └─── Ready for Engagement (2)
                    │
                    │  [Book Engagement button]
                    │  Book a reviewer slot
                    │  (engagement record created, slot booked)
                    │
                    ▼
             Engagement takes place
             Status moves to R (3)
                    │
                    │  [Review Request button]
                    │  Reviewer records decision code
                    │  and structured comments
                    │
                    ├─── Code 1 ──► Draft Review (4)  +  outcome ACK / E / FA
                    │               (engagement auto-marked Completed)
                    │
                    ├─── Code 2 ──► RS (16)  +  outcome RS
                    │               (new engagement required)
                    │
                    ├─── Code 3 ──► NC3 (17)  +  outcome NC / NC3
                    │
                    ├─── Code 4 ──► NC4 (18)  +  outcome NC4
                    │
                    └─── Code W ──► W (19)  +  outcome W
                                   (ST/SP requests only)
```

---

*Last updated: June 2026*
