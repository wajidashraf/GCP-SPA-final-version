# Form → Dataverse field mapping

Single source of truth for **which form field maps to which Dataverse column**, per
multi-step form. Update this file whenever a form's field wiring changes.

Conventions used below:
- **Parent** = `gcp_request` table (entity set `gcp_requests`). Every form creates one parent row first.
- **Lookups** are written via `<NavProperty>@odata.bind`, never to `_value`.
- **JSON string** = a `RepeatableTextField` / `DynamicTableSection` value serialized into a single text column.
- **Display-only** = shown in the UI but intentionally **not** persisted.
- **Document uploads** = `FileUpload` files upload to **SharePoint** via the Azure Function in [api/](api/); their links are stored as a JSON array on the parent's `gcp_documentsurl` column. Each link is tagged with a field key (e.g. `projectOrgManpowerChart`); untagged links (`field: null`) belong to the request. See [src/shared/documents.ts](src/shared/documents.ts) for the contract and [api/README.md](api/README.md) for setup. Persisting a field requires `gcp_documentsurl` in the `Webapi/gcp_request/fields` site setting + write permission.

## Parent request fields (common to all forms)

Set on `gcp_request` for every submission (see each form's `api.ts`):

| Form field | `gcp_request` column | Notes |
|---|---|---|
| Category | `gcp_category` | from `requestCategoryChoices` |
| Matter | `gcp_mattertype` | from `matterChoices` |
| SOA code | `gcp_soacode` | per-form constant (RTP=1, PBL=2, JVP=3, ST/SP=4, CAA=5, PCCA=6) |
| Requestor email | `gcp_requestoremail` | |
| Project name | `gcp_project_name` | |
| Project code | `gcp_projectcode` | auto-filled from the selected project (CAA, JVP, PBL, ST/SP) |
| Acknowledgement | `gcp_acknowledgement` | the final step checkbox |
| (submit time) | `gcp_submittedon` | `new Date().toISOString()` |
| (status) | `gcp_requeststatus` | `1` = New |
| Requestor (contact) | `gcp_RequestorName@odata.bind` → `contacts` | skipped unless a GUID |
| Company | `gcp_Company@odata.bind` → `accounts` | logged-in user's parent account |
| Project | `gcp_Project@odata.bind` → `gcp_projectses` | |
| Document uploads | `gcp_documentsurl` | JSON array of SharePoint links (field-tagged); see note above |

---

## RTP — Registration of Tender & Proposal List

- Matter code `RTP` · SOA `1` · Child table `gcp_rtprequest` (`gcp_rtprequests`)
- Files: [src/forms/rtp/](src/forms/rtp/) · [api.ts](src/forms/rtp/api.ts)
- Note: RTP **creates a stub `gcp_project`** first (status inactive), then the parent, then the child.

| Step | Field | Component | Target column | Table |
|---|---|---|---|---|
| 1 Basics | Matter / Category / Requestor Name / Requestor Email / Company | Select/Text (read-only) | parent (see common) | `gcp_request` |
| 2 Project | Client Name | TextField | `gcp_client_name_text` | `gcp_rtprequest` |
| 2 Project | Registration Type | SelectField | `gcp_registrationtype` | `gcp_rtprequest` |
| 2 Project | Tender Closing Date | DateField | `gcp_tenderclosingdate` | `gcp_rtprequest` |
| 2 Project | Project Name | TextField | `gcp_projectname` (+ parent `gcp_project_name`) | `gcp_rtprequest` |
| 2 Project | Project Description | TextAreaField | `gcp_projectdescription` (+ parent `gcp_projectdiscription`) | `gcp_rtprequest` |
| 3 Confirm | Acknowledgement | CheckboxField | `gcp_acknowledgement` (both parent + child) | both |
| 3 Confirm | Mark as special project | CheckboxField | `gcp_specialproject` | `gcp_rtprequest` |
| 3 Confirm | Attachments | FileUpload → SharePoint | parent `gcp_documentsurl` (request-level, `field: null`) | `gcp_request` |

Also mirrored onto the child row: `gcp_requesteremail`, `gcp_category`, `gcp_matters`, `gcp_formtype` (=1), `gcp_requeststatus` (=1).

---

## PBL — Prospective Bidders List

- Matter code `PBL` · SOA `2` · Child tables `gcp_pblrequest` (`gcp_pblrequests`) + `gcp_pblbidders` (`gcp_pblbidderses`)
- Files: [src/forms/pbl/](src/forms/pbl/) · [api.ts](src/forms/pbl/api.ts)

| Step | Field | Component | Target column | Table |
|---|---|---|---|---|
| 1 Basics | Matter / Category / Requestor / Company | Select/Text (read-only) | parent (see common) | `gcp_request` |
| 2 Project Details | Project Name | SelectField | parent `gcp_Project` lookup + `gcp_project_name` | `gcp_request` |
| 2 Project Details | Project Code | TextField (read-only auto) | parent `gcp_projectcode` + child `gcp_projectcode` | `gcp_request` + `gcp_pblrequest` |
| 2 Project Details | Procurement Method | SelectField | `gcp_procurementmethod` | `gcp_pblrequest` |
| 3 Bidders | Company Name | Select/Text | `gcp_pblbiddername` + `gcp_company` | `gcp_pblbidders` (one row each) |
| 3 Bidders | Company (account) | SelectField | `gcp_Company` lookup (unless "Other") | `gcp_pblbidders` |
| 3 Bidders | Sector | SelectField | `gcp_sector` | `gcp_pblbidders` |
| 3 Bidders | Location | TextField | `gcp_location` | `gcp_pblbidders` |
| 3 Bidders | Person In Charge | TextField | `gcp_person_in_charge` | `gcp_pblbidders` |
| 3 Bidders | PIC Contact Number | TextField | `gcp_piccontactnumber` | `gcp_pblbidders` |
| 3 Bidders | Recommended By | TextField | `gcp_recommendedby` | `gcp_pblbidders` |
| 3 Bidders | Sources From | TextField | `gcp_sourcesfrom` | `gcp_pblbidders` |
| 3 Bidders | Justification (< 3 bidders) | TextAreaField | `gcp_justificationforlt3bidders` (on every bidder row) | `gcp_pblbidders` |
| 4 Confirm | Acknowledgement | CheckboxField | parent `gcp_acknowledgement` | `gcp_request` |

---

## JVP — JV / Partnership

- Matter code `JVP` · SOA `3` · Child table `gcp_jvmrequest` (`gcp_jvmrequests`) — schema uses **JVM** prefix; no `gcp_soacode` column on the child.
- Files: [src/forms/jvp/](src/forms/jvp/) · [api.ts](src/forms/jvp/api.ts)

| Step | Field | Component | Target column | Table |
|---|---|---|---|---|
| 1 Basic Information | Matter / Category / Requestor / Company / **Project** | Select/Text | parent (Project lookup + `gcp_project_name`) | `gcp_request` |
| 1 Basic Information | Project Code | TextField (read-only auto) | parent `gcp_projectcode` | `gcp_request` |
| 2 PIC | Team Lead | TextField | `gcp_pic_team_leader` | `gcp_jvmrequest` |
| 2 PIC | Financial Matters | TextField | `gcp_picfinancialmatters` | `gcp_jvmrequest` |
| 2 PIC | Technical Matters | TextField | `gcp_pictechnicalmatters` | `gcp_jvmrequest` |
| 2 PIC | Contract Matters | TextField | `gcp_piccontractmatters` | `gcp_jvmrequest` |
| 2 PIC | Procurement Matters | TextField | `gcp_picprocurementmatters` | `gcp_jvmrequest` |
| 2 PIC | Costing Estimation | TextField | `gcp_piccostingestimation` | `gcp_jvmrequest` |
| 2 PIC | Implementation Stage | TextField | `gcp_picimplementationstage` | `gcp_jvmrequest` |
| 3 JVP Info | Background of Collaboration | RepeatableTextField (JSON) | `gcp_backgroundofcollaboration` | `gcp_jvmrequest` |
| 3 JVP Info | Scope of Collaboration | RepeatableTextField (JSON) | `gcp_scope_of_collaboration` | `gcp_jvmrequest` |
| 3 JVP Info | Proposed Structure | RepeatableTextField (JSON) | `gcp_proposed_structure` | `gcp_jvmrequest` |
| 4 JVP Info | Key Terms | RepeatableTextField (JSON) | `gcp_key_terms` | `gcp_jvmrequest` |
| 4 JVP Info | Financial Overview | RepeatableTextField (JSON) | `gcp_financialoverview` | `gcp_jvmrequest` |
| 4 JVP Info | Cashflow Forecast | FileUpload | **display-only — not persisted** | — |
| 4 JVP Info | Technical Capabilities & Resources | RepeatableTextField (JSON) | `gcp_technical_capabilities_resources` | `gcp_jvmrequest` |
| 5 JVP Info | Work Packages / Division of Responsibilities | RepeatableTextField (JSON) | `gcp_workpackages_divisionofresponsibilities` | `gcp_jvmrequest` |
| 5 JVP Info | Resource Contribution | RepeatableTextField (JSON) | `gcp_resourcecontributionmanpowerdesigntoolset` | `gcp_jvmrequest` |
| 5 JVP Info | Cost Structure / Breakdown | FileUpload | **display-only — not persisted** | — |
| 5 JVP Info | Risk Review & Mitigation | DynamicTableSection (JSON) | `gcp_risk_review_mitigation` | `gcp_jvmrequest` |
| 6 Document | Acknowledgement | CheckboxField | parent `gcp_acknowledgement` | `gcp_request` |

---

## ST/SP — Submission of Tender / Proposal

- Matter code `ST/SP` · SOA `4` · Child table `gcp_stsprequest` (`gcp_stsprequests`) — no `gcp_soacode` column on the child.
- Files: [src/forms/stsp/](src/forms/stsp/) · [api.ts](src/forms/stsp/api.ts)

| Step | Field | Component | Target column | Table |
|---|---|---|---|---|
| 1 Basic Information | Matter / Category / Requestor Name / Requestor Email / Company | Select/Text (read-only) | parent (see common) | `gcp_request` |
| 2 Project Details | Project Name | SelectField | parent `gcp_Project` lookup + `gcp_project_name` | `gcp_request` |
| 2 Project Details | Project Code | TextField (read-only auto) | parent `gcp_projectcode` | `gcp_request` |
| 2 Project Details | Company Name | SelectField (read-only) | parent `gcp_Company` lookup (set in step 1) | `gcp_request` |
| 2 Project Details | Tender/Proposal Submission Date | DateField | `gcp_tenderproposalsubmissiondate` (ISO datetime) | `gcp_stsprequest` |
| 2 Project Details | Tender Validity Period (Days) | TextField | `gcp_tendervalidityperiod` | `gcp_stsprequest` |
| 3 PIC | Team Leader | TextField | `gcp_teamleader` | `gcp_stsprequest` |
| 3 PIC | Financial Matters | TextField | `gcp_financialmatters` | `gcp_stsprequest` |
| 3 PIC | Technical Matters | TextField | `gcp_technicalmatters` | `gcp_stsprequest` |
| 3 PIC | Contract Matters | TextField | `gcp_contractmatters` | `gcp_stsprequest` |
| 3 PIC | Procurement Matters | TextField | `gcp_procurementmatters` | `gcp_stsprequest` |
| 3 PIC | Costing And Estimation Matters | TextField | `gcp_costingandestimationmatters` | `gcp_stsprequest` |
| 3 PIC | Implementation Stage | TextField | `gcp_implementationstage` | `gcp_stsprequest` |
| 4 ST/SP Info | Brief on the background of matters for review | TextAreaField | `gcp_backgroundreview` | `gcp_stsprequest` |
| 4 ST/SP Info | Scope of Works | TextAreaField | `gcp_scopeofworks` | `gcp_stsprequest` |
| 4 ST/SP Info | Key Terms | TextAreaField | `gcp_keyterms` | `gcp_stsprequest` |
| 4 ST/SP Info | Financial | RepeatableTextField (JSON) | `gcp_financials` | `gcp_stsprequest` |
| 4 ST/SP Info | Contract Structure Image | FileUpload | **display-only — not persisted** (`gcp_resourcescontribution` left unset) | — |
| 5 ST/SP Info | Technical (Competency, Specification and Delivery) | TextAreaField | `gcp_technical` | `gcp_stsprequest` |
| 5 ST/SP Info | Procurement Strategy & Work Packages | TextAreaField | `gcp_procurementstrategyworkpackages` | `gcp_stsprequest` |
| 5 ST/SP Info | Sourcing Reference | TextAreaField | `gcp_sourcingreference` | `gcp_stsprequest` |
| 5 ST/SP Info | Cost Breakdown | TextAreaField | `gcp_costbreakdown` | `gcp_stsprequest` |
| 5 ST/SP Info | Risk Identification & Mitigation Plan | DynamicTableSection (JSON) | `gcp_riskidentificationmitigationplan` | `gcp_stsprequest` |
| 6 Document | Acknowledgement | CheckboxField | parent `gcp_acknowledgement` | `gcp_request` |

---

## CAA — Client Acceptance of Award

- Matter code `CAA` · SOA `5` · Child table `gcp_caarequest` (`gcp_caarequests`) — schema name `gcp_CAARequest`; primary name `gcp_title`; no `gcp_soacode` column on the child.
- Files: [src/forms/caa/](src/forms/caa/) · [api.ts](src/forms/caa/api.ts)
- Lookups on the child: `gcp_Request` → `gcp_requests`, `gcp_Project` → `gcp_projectses`, `gcp_Company` → `accounts`.
- Steps 5–7 use `DynamicRowFields` (single-column repeatable lists) serialized to JSON into one multiline-text column each.

| Step | Field | Component | Target column | Table |
|---|---|---|---|---|
| 1 Basic Information | Matter / Category / Requestor / Company / **Project Name** | Select/Text | parent (Project lookup + `gcp_project_name`) | `gcp_request` |
| 1 Basic Information | Project Code | TextField (read-only auto) | parent `gcp_projectcode` (child `gcp_title` ← project name) | `gcp_request` |
| 2 Cost Information | Tender / Proposal Price | NumberField | `gcp_tenderproposalpriceduringsubmissionoftend` (Currency) | `gcp_caarequest` |
| 2 Cost Information | Final Contract Amount | NumberField | `gcp_finalcontractamount` (Currency) | `gcp_caarequest` |
| 2 Cost Information | Estimated Budget Cost | NumberField | `gcp_estimatedbudgetcost` (Currency) | `gcp_caarequest` |
| 2 Cost Information | Estimated Margin % | NumberField | `gcp_estimatedmargin` (Decimal) | `gcp_caarequest` |
| 2 Cost Information | Tender / Proposal Ref. No. | TextField | `gcp_tenderproposalrefno` | `gcp_caarequest` |
| 2 Cost Information | Letter of Award (LOA) Date | DateField | `gcp_letterofawardloa` (ISO datetime) | `gcp_caarequest` |
| 2 Cost Information | Contract Commencement Date | DateField | `gcp_contractcommencement` (ISO datetime) | `gcp_caarequest` |
| 2 Cost Information | Contract Completion Date | DateField | `gcp_contractcompletiondate` (ISO datetime) | `gcp_caarequest` |
| 2 Cost Information | Contract Period (days) | NumberField | `gcp_contractperioddays` (Whole Number) | `gcp_caarequest` |
| 3 CAA Information | Performance Bond (PB) for Project | TextField | `gcp_performancebondpbforproject` | `gcp_caarequest` |
| 3 CAA Information | Stamp Duty (Inclusive legal fees) | NumberField | `gcp_stampdutyinclusiveoflegalcostandfees` (Whole Number) | `gcp_caarequest` |
| 3 CAA Information | Insurance | TextField | `gcp_insurance` | `gcp_caarequest` |
| 3 CAA Information | Bumiputera Participation | TextField | `gcp_bumiputeraparticipation` | `gcp_caarequest` |
| 3 CAA Information | Formation of JV Company | TextField | `gcp_formationofjvcompany` | `gcp_caarequest` |
| 3 CAA Information | Critical Activities & Milestones | TextField | `gcp_criticalactivitymilestone` | `gcp_caarequest` |
| 3 CAA Information | Defect Liability Period (DLP) | TextField | `gcp_defectliabilityperioddlp` | `gcp_caarequest` |
| 3 CAA Information | Project Org & Manpower Chart | FileUpload → SharePoint | parent `gcp_documentsurl` (field tag `projectOrgManpowerChart`) | `gcp_request` |
| 4 CAA Information | Liquidated Damages (LAD/day) Rate | NumberField | `gcp_liquidateddamagesladrate` (Whole Number) | `gcp_caarequest` |
| 4 CAA Information | Payment Term | TextField | `gcp_paymentterm` | `gcp_caarequest` |
| 4 CAA Information | Type of Contract | TextField | `gcp_typeofcontract` | `gcp_caarequest` |
| 4 CAA Information | Form of Contract / Condition of Contract | TextField | `gcp_formofcontractconditionofcontract` | `gcp_caarequest` |
| 4 CAA Information | Project Director (PD) | TextField | `gcp_projectdirectorpd` | `gcp_caarequest` |
| 4 CAA Information | Contact Person at Site / Designation / Contact No. | TextField | `gcp_contactpersonatsitedesignationcontactno` | `gcp_caarequest` |
| 5 CAA Information | Claim Management - Claim Application Process | DynamicRowFields (JSON) | `gcp_claimmanagementclaimapplicationprocess` | `gcp_caarequest` |
| 5 CAA Information | Claim Management - Claim Certification Process | DynamicRowFields (JSON) | `gcp_claimmanagementclaimcertificationprocess` | `gcp_caarequest` |
| 5 CAA Information | Change Management – Variation Order Application Process | DynamicRowFields (JSON) | `gcp_changemanagementvariationorderapplicationpr` | `gcp_caarequest` |
| 6 CAA Information | Change Management – Extension of Time Application Process | DynamicRowFields (JSON) | `gcp_changemanagementextensionoftimeapplication` | `gcp_caarequest` |
| 6 CAA Information | Commissioning and Completion Management Systems | DynamicRowFields (JSON) | `gcp_commissioningandcompletionmanagementsystems` | `gcp_caarequest` |
| 6 CAA Information | Key Delivery Milestone | DynamicRowFields (JSON) | `gcp_keydeliverymilestone` | `gcp_caarequest` |
| 7 CAA Information | Mandatory Testing required to commission | DynamicRowFields (JSON) | `gcp_mandatorytestingrequiredtocommission` | `gcp_caarequest` |
| 7 CAA Information | Document required for Contractual Acceptance (CPC) | DynamicRowFields (JSON) | `gcp_documentrequiredforcontractualacceptanceofpr` | `gcp_caarequest` |
| 7 CAA Information | Pre requisite documents for completion of DLP | DynamicRowFields (JSON) | `gcp_prerequisitedocumentsforcompletionofdlp` | `gcp_caarequest` |
| 8 Document | Acknowledgement | CheckboxField | `gcp_acknowledgement` (both parent + child) | both |

---

## PCCA — Project Cost & Construction Analysis

- Matter code `PCCA` · SOA `6` · Child table `gcp_pccarequest` (`gcp_pccarequests`) — schema name `gcp_PCCARequest`; **primary name `gcp_occarequestname`** (NOT `gcp_title`); no `gcp_soacode` column on the child.
- Files: [src/forms/pcca/](src/forms/pcca/) · [api.ts](src/forms/pcca/api.ts)
- Lookups on the child: `gcp_Request` → `gcp_requests`, `gcp_Project` → `gcp_projectses`, `gcp_Company` → `accounts`.
- `gcp_acknowledgement` (bit) is **required** on the child.
- Step 2 uses two `DynamicRowFields` (2-column repeatable lists) serialized to JSON into one `ntext` column each. Step 3's two totals are auto-summed from those rows (read-only) and rounded to whole numbers.

| Step | Field | Component | Target column | Table |
|---|---|---|---|---|
| 1 Basic Information | Matter / Category / Requestor / Company Name / **Project Name** | Select/Text | parent (Project lookup + `gcp_project_name`) | `gcp_request` |
| 1 Basic Information | Project Code | TextField (read-only auto) | parent `gcp_projectcode` (child `gcp_occarequestname` ← project name) | `gcp_request` |
| 2 Cost Information | Price/Revenue (from Contract BQ) — *Work Description (BQ)* + *Price/Revenue (RM)* | DynamicRowFields (JSON) | `gcp_pricerevenuefromcontractbq` (ntext) | `gcp_pccarequest` |
| 2 Cost Information | Cost (from Contract BQ) — *Work Description (BQ)* + *Cost (RM)* | DynamicRowFields (JSON) | `gcp_costfromcontractbq` (ntext) | `gcp_pccarequest` |
| 3 Cost Summary | Total Revenue (RM) | NumberField (read-only, auto-sum of Price/Revenue RM) | `gcp_totalrevenuerm` (Whole Number) | `gcp_pccarequest` |
| 3 Cost Summary | Total Cost (RM) | NumberField (read-only, auto-sum of Cost RM) | `gcp_totalcostrm` (Whole Number) | `gcp_pccarequest` |
| 3 Cost Summary | Construction Cost (RM) | NumberField | `gcp_constructioncostrm` (Whole Number) | `gcp_pccarequest` |
| 3 Cost Summary | Internal Cost | NumberField | `gcp_internalcost` (Whole Number) | `gcp_pccarequest` |
| 3 Cost Summary | Remarks | TextAreaField | `gcp_remarks` | `gcp_pccarequest` |
| 4 Document | Acknowledgement | CheckboxField | `gcp_acknowledgement` (both parent + child; **required** on child) | both |

---

## PP — Procurement Plan

- Matter code `PP` · SOA `7` · Child table `gcp_pprequest` (`gcp_pprequests`) — schema name `gcp_PPRequest`; primary name `gcp_pprequestname`; no `gcp_soacode` column on the child.
- Files: [src/forms/pp/](src/forms/pp/) · [api.ts](src/forms/pp/api.ts)
- Lookups on the child: `gcp_Request` → `gcp_requests`, `gcp_Project` → `gcp_projectses`, `gcp_Company` → `accounts`.
- `gcp_acknowledgement` (bit) is **required** on the child. Project details (name/code/company) persist on the **parent** `gcp_request`; the child carries only name + project code + acknowledgement + the parent link.

| Step | Field | Component | Target column | Table |
|---|---|---|---|---|
| 1 Basic Information | Matter / Category / Requestor Name / Requestor Email / Company | Select/Text (read-only) | parent (see common) | `gcp_request` |
| 2 Project Details | Project Name | SelectField | parent `gcp_Project` lookup + `gcp_project_name` (child `gcp_pprequestname` ← project name) | `gcp_request` |
| 2 Project Details | Project Code | TextField (read-only auto) | parent `gcp_projectcode` (+ child `gcp_projectcode`) | `gcp_request` |
| 2 Project Details | Company Name | SelectField (read-only) | parent `gcp_Company` lookup (set in step 1) | `gcp_request` |
| 3 Document | Acknowledgement | CheckboxField | `gcp_acknowledgement` (both parent + child; **required** on child) | both |

---

## RPP — Revised Procurement Plan

- Matter code `R-PP` · **channel `gcp`** · SOA `14` · Child table `gcp_rpprequest` (`gcp_rpprequests`) — schema name `gcp_RPPRequest`; **primary name `gcp_name`**; no `gcp_soacode` column on the child.
- Files: [src/forms/rpp/](src/forms/rpp/) · [api.ts](src/forms/rpp/api.ts)
- Lookups on the child: `gcp_Request` → `gcp_requests`, `gcp_Project` → `gcp_projectses`, `gcp_Company` → `accounts`.
- Same shape as PP: project details (name/code/company) persist on the **parent** `gcp_request`; the child carries name + project code + acknowledgement + the parent link. (`gcp_acknowledgement` is **not** required on this child, but is still written.)

| Step | Field | Component | Target column | Table |
|---|---|---|---|---|
| 1 Basic Information | Matter / Category / Requestor Name / Requestor Email / Company | Select/Text (read-only) | parent (see common) | `gcp_request` |
| 2 Project Details | Project Name | SelectField | parent `gcp_Project` lookup + `gcp_project_name` (child `gcp_name` ← project name) | `gcp_request` |
| 2 Project Details | Project Code | TextField (read-only auto) | parent `gcp_projectcode` (+ child `gcp_projectcode`) | `gcp_request` |
| 2 Project Details | Company Name | SelectField (read-only) | parent `gcp_Company` lookup (set in step 1) | `gcp_request` |
| 3 Document | Acknowledgement | CheckboxField | `gcp_acknowledgement` (both parent + child) | both |

---

## VAP — Vendor Appointment and Procurement

- Matter code `VAP` · SOA `8` · Child table `gcp_vaprequest` (`gcp_vaprequests`) — schema name `gcp_VAPRequest`; **primary name `gcp_vaprequestname`**; no `gcp_soacode` column on the child.
- Files: [src/forms/vap/](src/forms/vap/) · [api.ts](src/forms/vap/api.ts)
- Lookups on the child: `gcp_Request` → `gcp_requests`, `gcp_Project` → `gcp_projectses`, `gcp_Company` → `accounts`.
- Same shape as PP: project details (name/code/company) persist on the **parent** `gcp_request`; the child carries name + project code + acknowledgement + the parent link. `gcp_acknowledgement` (bit) is **required** on the child.

| Step | Field | Component | Target column | Table |
|---|---|---|---|---|
| 1 Basic Information | Matter / Category / Requestor Name / Requestor Email / Company | Select/Text (read-only) | parent (see common) | `gcp_request` |
| 2 Project Details | Project Name | SelectField | parent `gcp_Project` lookup + `gcp_project_name` (child `gcp_vaprequestname` ← project name) | `gcp_request` |
| 2 Project Details | Project Code | TextField (read-only auto) | parent `gcp_projectcode` (+ child `gcp_projectcode`) | `gcp_request` |
| 2 Project Details | Company Name | SelectField (read-only) | parent `gcp_Company` lookup (set in step 1) | `gcp_request` |
| 3 Document | Acknowledgement | CheckboxField | `gcp_acknowledgement` (both parent + child; **required** on child) | both |

---

## Others — "Others Form" (GCPC) & "GCP - Others" (GCP)

- Matter code `Others` for **two** matters: GCPC `Others Form` (value 9, SOA 9) and GCP `GCP - Others` (value 13, SOA 13). Both render the **same** `OthersForm` and write to the **same** child table.
- Child table `gcp_otherrequests` (entity set **`gcp_otherrequestses`**) — schema name `gcp_OtherRequests`; **primary name `gcp_requestname`**; no `gcp_soacode` column on the child.
- Files: [src/forms/others/](src/forms/others/) · [api.ts](src/forms/others/api.ts)
- Lookups on the child: **`gcp_Requestlookup`** → `gcp_requests` (NOT `gcp_Request`), `gcp_Project` → `gcp_projectses`, `gcp_Company` → `accounts`.
- SOA code resolved by matter value: 13 → 13, otherwise 9. `gcp_acknowledgement` (bit) is **required** on the child.

| Step | Field | Component | Target column | Table |
|---|---|---|---|---|
| 1 Basic Information | Matter / Category / Requestor Name / Requestor Email / Company | Select/Text (read-only) | parent (see common) | `gcp_request` |
| 2 Project Details | Project Name | SelectField | parent `gcp_Project` lookup + `gcp_project_name` (child `gcp_requestname` ← project name) | `gcp_request` |
| 2 Project Details | Project Code | TextField (read-only auto) | parent `gcp_projectcode` (+ child `gcp_projectcode`) | `gcp_request` |
| 2 Project Details | Company Name | SelectField (read-only) | parent `gcp_Company` lookup (set in step 1) | `gcp_request` |
| 2 Project Details | Description of Matter | TextAreaField | `gcp_descriptionofmatters` (ntext) | `gcp_otherrequests` |
| 3 Document | Acknowledgement | CheckboxField | `gcp_acknowledgement` (both parent + child; **required** on child) | both |

---

## CPR — Contract Progress Report

- Matter code `CPR` · **channel `gcp`** · SOA `12` · Child table `gcp_cprrequestgcp` (entity set **`gcp_cprrequestgcps`**) — schema name `gcp_CPRRequestGCP`; **primary name `gcp_cprrequestgcp1`**; no `gcp_soacode` column on the child.
- Files: [src/forms/cpr/](src/forms/cpr/) · [api.ts](src/forms/cpr/api.ts)
- Lookups on the child: `gcp_Request` → `gcp_requests`, `gcp_Project` → `gcp_projectses`, `gcp_Company` → `accounts`.
- **Acknowledgement column on the child is `gcp_acknowledgementconfirmed`** (NOT `gcp_acknowledgement`); it is **required**.
- Both status fields use the global choice `gcp_cprapplicationstatuschoices` (`1 = Active`, `2 = Inactive`) — mirrored in [src/data/cprChoices.ts](src/data/cprChoices.ts). EOT status defaults to 1 (Active), VO status to 2 (Inactive).

| Step | Field | Component | Target column | Table |
|---|---|---|---|---|
| 1 Basic Information | Matter / Category / Requestor / Company Name / **Project Name** | Select/Text | parent (Project lookup + `gcp_project_name`) | `gcp_request` |
| 1 Basic Information | Project Code | TextField (read-only auto) | parent `gcp_projectcode` (child `gcp_cprrequestgcp1` ← project name) | `gcp_request` |
| 2 EOT Information | EOT Latest No. | TextField | `gcp_eotlatestno` | `gcp_cprrequestgcp` |
| 2 EOT Information | EOT Latest Date | DateField | `gcp_eotlatestdate` (ISO datetime) | `gcp_cprrequestgcp` |
| 2 EOT Information | EOT New Application Date | DateField | `gcp_eotnewapplicationdate` | `gcp_cprrequestgcp` |
| 2 EOT Information | EOT New Completion Date | DateField | `gcp_eotnewcompletiondate` | `gcp_cprrequestgcp` |
| 2 EOT Information | Status of New EOT Application | SelectField (choice) | `gcp_statusofneweotapplication` (default 1) | `gcp_cprrequestgcp` |
| 2 EOT Information | EOT New Justifications | TextAreaField | `gcp_eotnewjustifications` | `gcp_cprrequestgcp` |
| 3 VO Information | VO Latest No. | TextField | `gcp_volatestno` | `gcp_cprrequestgcp` |
| 3 VO Information | Latest Approved VO Cumulative Amount | NumberField | `gcp_latestapprovedvocumulativeamount` (Whole Number) | `gcp_cprrequestgcp` |
| 3 VO Information | New VO Application Amount | NumberField | `gcp_newvoapplicationamount` (Whole Number) | `gcp_cprrequestgcp` |
| 3 VO Information | VO New Application No. | TextField | `gcp_vonewapplicationno` | `gcp_cprrequestgcp` |
| 3 VO Information | VO New Application Date | DateField | `gcp_vonewapplicationdate` | `gcp_cprrequestgcp` |
| 3 VO Information | Status of New VO Application | SelectField (choice) | `gcp_statusofnewvoapplication` (default 2) | `gcp_cprrequestgcp` |
| 3 VO Information | VO New Justification | TextAreaField | `gcp_vonewjustification` | `gcp_cprrequestgcp` |
| 4 Claims to Client | Cumulative Claim Application Amount to Date | NumberField | `gcp_cumulativeclaimapplicationamounttodate` (Whole Number) | `gcp_cprrequestgcp` |
| 4 Claims to Client | Cumulative Claim Certified Amount to Date | NumberField | `gcp_cumulativeclaimcertifiedamounttodate` (Whole Number) | `gcp_cprrequestgcp` |
| 4 Claims to Client | Pending Certified Amount to Date | NumberField | `gcp_pendingcertifiedamounttodate` (Whole Number) | `gcp_cprrequestgcp` |
| 4 Claims to Client | No. of Claims for Pending Certified Amount | NumberField | `gcp_noofclaimsforpendingcertifiedamount` (Whole Number) | `gcp_cprrequestgcp` |
| 4 Claims to Client | New Net Certified Amount | NumberField | `gcp_newnetcertifiedamount` (Whole Number) | `gcp_cprrequestgcp` |
| 4 Claims to Client | Date of Claim Pending Certified Amount | DateField | `gcp_dateofclaimpendingcertifiedamount` | `gcp_cprrequestgcp` |
| 5 Document | Acknowledgement | CheckboxField | parent `gcp_acknowledgement` + child `gcp_acknowledgementconfirmed` (**required** on child) | both |

---

## CI — Contractual Issue Relating to Payment

- Matter code `CI` · **channel `gcp`** · SOA `11` · Child table `gcp_requestcigcp` (entity set **`gcp_requestcigcps`**) — schema name `gcp_RequestCIGCP`; **primary name `gcp_name`**; no `gcp_soacode` column on the child.
- Files: [src/forms/ci/](src/forms/ci/) · [api.ts](src/forms/ci/api.ts)
- Lookups on the child: `gcp_Request` → `gcp_requests`, `gcp_Project` → `gcp_projectses`, **`gcp_Company` → `accounts` (REQUIRED on the child)**.
- `gcp_companyroleinthisissue` is a choice from `companyRoleInIssueChoices` ([src/data/companyChoices.ts](src/data/companyChoices.ts)). `gcp_category` is a free **TEXT** column constrained in the UI to VO / EOT / L&E ([src/data/ciChoices.ts](src/data/ciChoices.ts)). `gcp_contractclausepayment` was added to Dataverse recently (may be absent from older solution exports; `fields: '*'` covers it).

| Step | Field | Component | Target column | Table |
|---|---|---|---|---|
| 1 Basic Information | Matter / Category / Requestor / Company Name | Select/Text (read-only) | parent (see common) | `gcp_request` |
| 2 Project Details | Project Name | SelectField | parent `gcp_Project` lookup + `gcp_project_name` (child `gcp_name` ← project name) | `gcp_request` |
| 2 Project Details | Project Code | TextField (read-only auto) | parent `gcp_projectcode` (+ child `gcp_projectcode`) | `gcp_request` |
| 2 Project Details | Company Role in this Issue | SelectField (choice) | `gcp_companyroleinthisissue` | `gcp_requestcigcp` |
| 3 VO/EOT/L&E | Category (VO / EOT / L&E) | SelectField (text value) | `gcp_category` (nvarchar) | `gcp_requestcigcp` |
| 3 VO/EOT/L&E | Contract Clause | TextField | `gcp_contractclause` | `gcp_requestcigcp` |
| 3 VO/EOT/L&E | Chronology of Event | TextAreaField | `gcp_chronologyofeventvo` (ntext) | `gcp_requestcigcp` |
| 3 VO/EOT/L&E | Brief of Issues | TextAreaField | `gcp_briefofissuesvo` (ntext) | `gcp_requestcigcp` |
| 3 VO/EOT/L&E | Time and Cost Impact | TextAreaField | `gcp_timeandcostimpactvo` (ntext) | `gcp_requestcigcp` |
| 3 VO/EOT/L&E | Advisory Required from GCP | TextAreaField | `gcp_advisoryrequiredfromgcpvo` (ntext) | `gcp_requestcigcp` |
| 4 Payments | Contract Clause (Payment) | TextField | `gcp_contractclausepayment` (nvarchar) | `gcp_requestcigcp` |
| 4 Payments | Brief of Issues (Payments) | TextAreaField | `gcp_briefofissuespayments` (ntext) | `gcp_requestcigcp` |
| 4 Payments | Chronology of Event (Payments) | TextAreaField | `gcp_chronologyofeventpayments` (ntext) | `gcp_requestcigcp` |
| 4 Payments | Advisory Required from GCP (Payments) | TextAreaField | `gcp_advisoryrequiredfromgcppayments` (ntext) | `gcp_requestcigcp` |
| 5 Document | Acknowledgement | CheckboxField | parent `gcp_acknowledgement` + child `gcp_acknowledgement` | both |
