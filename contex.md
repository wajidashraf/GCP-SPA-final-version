content = """# Business Requirements Document (BRD)

## 1. Project Overview
This system aims to digitize and streamline the end-to-end process of submitting, reviewing, and engaging contract procurement related requests within the organization (and its sub-companies). Leveraging Microsoft Power Platform tools, the system will automate workflows for both the Group Contract Procurement (GCP) and Group Contract Procurement Committee (GCPC), enhance visibility through dashboards, and ensure compliance with service-level agreements (SLAs). This initiative supports operational efficiency, transparency, and governance in contract procurement management.

## 2. Business Objectives
The primary objectives of this project are:
*   **Efficiency:** Reduce manual handling and delays in contract procurement processes.
*   **Automation:** Implement intelligent routing and automated notifications to minimize human error.
*   **Compliance:** Track SLA adherence and flag violations to ensure timely processing.
*   **Visibility:** Provide stakeholders with real-time dashboards and reporting tools.
*   **Security:** Ensure secure document handling and role-based access control.
*   **User Experience:** Replace manual Word-based forms with structured digital interfaces.

## 3. Stakeholders & User Roles

| Category | Users | Responsibilities |
| :--- | :--- | :--- |
| **Business stakeholders** | Product Owner/GCP | Represents the business side, prioritizes backlog, and defines features based on stakeholder needs. |
| **System users** | Requestor (generally companies) | Submit requests related to contract procurement matters for their projects. |
| | Verifier (GCP) | Verifies the correctness of the request submitted, and documents uploaded by the requestor. |
| | Reviewer (GCP/GCPC) | Manage the requests related to GCP and GCPC, including review requests. |
| | Acknowledgement (Head of GCP) | Provide acknowledgement by the end of GCP request management lifecycle. |
| | Endorser (Head of GCPC) | Provide formal endorsement by the end of GCPC request management lifecycle. |
| | Main Committee GCPC | Granted view-only access to all requests submissions and decisions listings as well as receive notification for the outcome of requests. |
| | Admin (GCP) | Manage the company inventory details and control access of the system. |

## 4. Scope

### 4.1 In-Scope (Phase 1-3)
*   Request submission and review of contract procurement identified matters.
*   Routing logic for GCP and GCPC engagement based on request type.
*   Generation of Summary Reports, acknowledgement and endorsement letters.
*   Automated notifications and reminders.
*   SLA tracking and flagging of breaches.
*   Role-based access control and dashboards.

### 4.2 Out of Scope
*   Integration with external procurement systems (future enhancement).
*   Integration with vendor management (future enhancement).
*   Integration with contract management (future enhancement).

## 5. Features and Requirements

### 5.1 Summary Table of Functional Requirements

| ID | Feature | Priority | Related User Stories |
| :--- | :--- | :--- | :--- |
| **FR1** | Request submission by Requestor | P1 | US1 |
| **FR2** | Attachments upload to request | P1 | US1, US2, US6 |
| **FR3** | Dynamic web form to replace word-based submission | P1 | US1, US5, US7 |
| **FR4** | Request verified by Verifier | P1 | US2 |
| **FR5** | Routing logic for GCP/GCPC | P1 | US3 |
| **FR6** | GCP engagement session scheduling | P2 | US4 |
| **FR7** | Generate GCP Summary Review report with signature | P2 | US3 |
| **FR8** | HOS accept the GCP Summary Review report with signature | P2 | US3 |
| **FR9** | Generate acknowledgement letter with signature | P2 | US3 |
| **FR10** | GCPC engagement session scheduling | P2 | US5 |
| **FR11** | Generate GCPC Summary Review report with signature | P2 | US3 |
| **FR12** | HOS accept the GCPC Summary Review report | P2 | US3 |
| **FR13** | Generate endorsement letter with signature | P2 | US3 |
| **FR14** | Automated notifications | P3 | US8 |
| **FR15** | Timestamp tracking | P3 | US9 |
| **FR16** | SLA violation flagging | P3 | US10 |
| **FR17** | Role management | P4 | US11 |
| **FR18** | Dashboard for SLA and request tracking | P4 | P4-A |
| **FR19** | SLA configuration management | P4 | P4-B |
| **FR20** | Exportable reports | P4 | P4-C |

#### Updated Prioritization Logic:
*   **P1 (Essential):** Absolutely required for basic operation of the system.
*   **P2 (Important):** System can function without it temporarily, but usability and workflow efficiency suffer.
*   **P3 (Good to have):** Improve user experience and automation.
*   **P4 (Nice to have):** Reporting capabilities and administrative conveniences.

### Detailed Functional Requirements

#### P1 & P2 - Core Workflow (Sprint 1)
*   **FR1:** Requestor submits contract procurement request (US1).
*   **FR2:** As part of request submission, the Requestor must upload the required documents (Word, Excel, and/or PDF). The system should support any file types to upload with a size limit of 10 MB and store them securely in SharePoint or Dataverse for reviewer access.
*   **FR3:** Provide a structured web form (for request submission, request verification, request review, acknowledgement, and endorsement) replacing the Word document. Form fields are directly mapped to Dataverse which include field validation.
*   **FR4:** Verifier verified the request to proceed for engagement, or sends back the request for rework if needed (US2).
*   **FR5:** System detects GCP or GCPC routing logic based on request type (US3).
*   **FR6:** Requestor completes GCP engagement session scheduling activity.
*   **FR7:** GCP engagement session is held, a Summary Review Report generated at the end with signature (US4).
    *   *Code 1:* If the review is accepted.
    *   *Code 2:* If the review requires rework and resubmission.
    *   *Code 3:* If there is no resubmission within 30 days after issuance of Code 2.
*   **FR8:** HOC required to submit Acceptance of Review Report with signature to accept the review result.
*   **FR9:** Acknowledgement letter is generated (US5) at the end of GCP request lifecycle.
*   **FR10:** Requestor completes GCPC engagement session scheduling activity.
*   **FR11:** GCPC engagement session is held, a Summary Review Report generated at the end with signature (US4).
    *   *Code 1:* If the review is accepted.
    *   *Code 2:* If the review requires rework and resubmission.
    *   *Code 3:* If request to review is received (after tender/proposal submission) — non-compliant.
    *   *Code 4:* If no request to review is received until award/acceptance — non-compliant.
    *   *Code W:* If exemption from review is requested.
*   **FR12:** HOC required to submit Acceptance of Review Report with signature to accept the review result.
*   **FR13:** Endorsement letter is generated (US5) at the end of GCPC request lifecycle.

#### P3 - Notifications and SLA Tracking (Sprint 2)
*   **FR14:** Send automated notifications upon each completed step (US6/US8).
*   **FR15:** Capture timestamps for each step in the process (US7/US9).
*   **FR16:** Compare actual time taken with SLA; flag violations (US8/US10).

#### P4 - Admin Tools and Reporting (Sprint 3)
*   **FR17:** Enable role-based access control (Requestor, Reviewer, GCP, GCPC, Admin) (US9/US11).
*   **FR18:** Display dashboards showing request statuses and SLA breaches (P4-A).
*   **FR19:** Admin can configure SLA thresholds per workflow step (P4-B).
*   **FR20:** Allow users to export reports in PDF/Excel formats (P4-C).

### 5.2 Detailed Non-Functional Requirements

| ID | Feature | Description | Priority |
| :--- | :--- | :--- | :--- |
| **NFR1** | Availability | System available 99% during business hours (8am-6pm) | P1 |
| **NFR2** | Performance | System should handle concurrent users without degradation | P2 |
| **NFR3** | Security | Role-based access and secure document storage | P2 |
| **NFR4** | Usability | Intuitive UI/UX for all user roles. Similar branding to OBYU Group website. Include organizational chart on the Power Pages site | P4 |
| **NFR5** | Scalability | Designed to accommodate future enhancements and integrations | P4 |
| **NFR6** | Maintainability| Modular design for ease of updates and maintenance | P4 |

---

## 6. User Stories

### 6.1 User Story 1 to 7 - Core Features User Stories (P1 & P2)

#### US1: Submit Contract Procurement Request
*   **As a** Requestor
*   **I want to** submit a contract procurement request
*   **So that** it can go through the required review and acknowledgement/endorsement process.
*   **Acceptance Criteria:**
    *   The Requestor can fill in and submit a web-based form with the necessary mandatory fields.
    *   System validates mandatory fields before submission.
    *   A unique request ID is generated upon submission.
    *   There are 9 request forms under GCPC category (RTP, PBL, JVP, ST/SP, CAA, PCCA, PP, VAP, and others) and 4 request forms under GCP category (R-PCCA, CI, CPR, and others).
    *   The form saves data to the Dataverse table in real-time.

#### US2: Verify Request Submission
*   **As a** Verifier
*   **I want to** verify request submission; allow the request to proceed to the next stage if no issue, or instruct the requestor to amend the request if needed.
*   **Acceptance Criteria:**
    *   The verifier sees a list of pending requests assigned to them.
    *   The verifier can view request details.
    *   The verifier can approve to proceed to next stage or initiate requestor to make changes with comments/justifications via a structured web-based form.
    *   Approved requests move to the appropriate engagement scheduling process.
    *   The verifier can view/download uploaded file in the request.

#### US3: Automatic Workflow Identification & Routing
*   **As a** System
*   **I want to** automatically identify whether a request is related to GCP or GCPC so that the correct workflow is triggered and the request is appropriately marked at each completed stage.
*   **Acceptance Criteria:**
    *   The page should be able to indicate GCP or GCPC classification.
    *   Based on classification, the system routes the request to the correct request submission flow.
    *   Upon the submission and acceptance of RTP request, a Project will be created and Contract Listing will be updated with project status mark as "Inactive".
    *   The project status for the related Project will remain "Inactive" throughout the PBL, JVP, and ST/SP requests.
    *   Upon the submission and acceptance of CAA request only that the project status will be updated to "Active".
    *   The system shall mark a request as **"FR"** (For Record) when request is closed without needing engagement session to resolve it.
    *   The system shall mark a request as **"R"** (Review) when an engagement date has been confirmed. **"R01"** for the first engagement session status, and incremental numbering would be added to the subsequent engagement session status.
    *   **For GCP requests:**
        *   The system shall mark a request outcome as **"ACK"** (Acknowledge) when Summary Review report is concluded as Code 1. Once the HOC signed the Acceptance of Review report, the Acknowledgement letter is generated.
        *   The system shall mark the request outcome (for request type 'Others' only) as **"FA"** (For Action) when Summary Review report is concluded as Code 1.
        *   The system shall mark a request outcome as **"RS"** (Resubmission) when rework is needed and Summary Review report is concluded as Code 2. A subsequent engagement session is required and the system shall update the request status to **"R\<engagement session number\>"** to reflect the required follow-up.
        *   The system shall mark a request outcome as **"NC"** (Non-compliant) when there is no rework submitted after 30 days request is marked "RS" and Summary Review report is concluded as Code 3.
    *   **For GCPC requests:**
        *   The system shall mark a request outcome as **"E"** (Endorse) when Summary Review report outcome is concluded as Code 1. Once the HOC signed the Acceptance of Review report, the Endorsement letter is generated.
        *   The system shall mark the request outcome (for request type 'Others' only) as **"FA"** (For Action) when Summary Review report is concluded as Code 1.
        *   The system shall mark a request outcome as **"RS"** (Resubmission) when rework is needed and Summary Review Report is concluded as Code 2. A subsequent engagement session is required and the system shall update the request status to **"R\<engagement session number\>"** to reflect the required follow-up.
        *   The system shall mark a request outcome as **"NC3"** (Non-compliant) when the review is being done after tender/proposal submission and Summary Review report is concluded as Code 3.
        *   The system shall mark a request outcome as **"NC4"** (Non-compliant) when there is no request for review from companies (LOA already received) and Summary Review report is concluded as Code 4.
        *   The system shall mark a request as **"W"** (Compliant) when the request is attached with a signed Waiver Form from Group CEO and Summary Review report is concluded as Code W.

#### US4: Schedule GCP Engagement Session
*   **As a** Requestor
*   **I want to** schedule an engagement session with the appropriate party (GCP) so that my request can be acknowledged before closure.
*   **Acceptance Criteria:**
    *   The requestor can view available time slots for engagement sessions.
    *   The requestor can successfully book a session aligned with the engagement type.
    *   A confirmation is provided upon successful scheduling.
    *   The request is updated based on the outcome of the engagement session (e.g., FR, R\<engagement session number\>, ACK).

#### US5: Schedule GCPC Engagement Session
*   **As a** Requestor
*   **I want to** schedule an engagement session with the appropriate party (GCPC) so that my request can be endorsed before closure.
*   **Acceptance Criteria:**
    *   The requestor can view available time slots for engagement sessions.
    *   The requestor can successfully book a session aligned with the engagement type.
    *   A confirmation is provided upon successful scheduling.
    *   The request is updated based on the outcome of the engagement session (e.g., FR, R\<engagement session number\>, E).

#### US6: Document Upload
*   **As a** Requestor
*   **I want to** upload documents (Word, Excel and/or PDF versions) as part of my submission so that the Verifier and GCP/GCPC has access to all required information.
*   **Acceptance Criteria:**
    *   Upload is mandatory before submission for certain types of requests.
    *   The file is viewable/downloadable by the Requestor, Verifier, Reviewer, and Main Committee.

#### US7: Guided Web Form Filling
*   **As a** Requestor
*   **I want to** fill in a guided web form with all required details so that my request is structured and easy to process.
*   **Acceptance Criteria:**
    *   All required fields are clearly marked and validated.
    *   The form saves data to the Dataverse table in real-time.
    *   Errors and missing fields are shown before submission.
    *   Supporting files can be uploaded (max 2MB each, PDF/DOCX only). *Note: Cross-reference with 10MB master constraint as per core technical boundaries.*

---

### 6.2 User Story 8 to 11, P4A, P4B & P4C - Additional Features User Stories (P3 & P4)

#### US8: System Notifications
*   **As a** User
*   **I want to** receive notifications at key steps so that I am aware of progress.
*   **Acceptance Criteria:**
    *   Notification sent when:
        *   Request is submitted (Requestor, GCP (for GCP requests) and GCPC (for GCPC requests)).
        *   Request is being verified (Requestor and Working GCP/GCPC).
        *   Engagement session is scheduled (Requestor, Working GCP/GCPC).
        *   Summary review Report draft readiness (Working GCP/GCPC).
        *   Summary Review Report signature invitation (Working GCP/GCPC).
    *   **For GCPC:**
        *   Summary Review Report generated and submitted to Company (Requestor, HOC, HOS, GCP/Working GCPC).
        *   If request to review is accepted, review report is Code 1 (Requestor, GCP/Working GCPC).
        *   Rework is required for Code 2 (Requestor, GCP/Working GCPC).
        *   If review is done after tender/proposal submission, Summary Review report is Code 3 and non-compliant (Requestor, GCP/Working GCPC).
        *   If no request to review is received until award/acceptance, review report is Code 4 which is non-compliant (Requestor, GCP/Working GCPC).
        *   If exemption from review is requested, review report is Code W (Requestor, GCP/Working GCPC).
    *   **For GCP:**
        *   Summary Review Report generated and submitted to Company (Requestor, HOC, HOS, GCP/Working GCPC).
        *   If request to review is accepted, review report is Code 1 (Requestor, GCP/Working GCPC).
        *   If request to review requires rework, review report is Code 2 (Requestor, GCP/Working GCPC).
        *   If there is no submission within 30 days after issuance of Code 2, the review report is Code 3 (Requestor, GCP/Working GCPC).
    *   Acceptance of Review Report generated and signed (HOC, HOS, GCP/Working GCPC).
    *   Endorsement letter is generated (Main GCPC, HOC and Sector Exco).
    *   Acknowledgment letter is generated (Main GCPC, HOC and Sector Exco).
    *   System prompt after each status change (R, E, Ack, RS, NC, NC3, NC4, W etc).

#### US9: Audit Timestamp Logging
*   **As a** System
*   **I want to** log timestamps for each workflow step so that time performance can be tracked.
*   **Acceptance Criteria:**
    *   Timestamp is recorded when: Request is submitted, Verified, Engagement scheduled and completed, Draft Summary Review Report created and completely signed, A signed Summary Review Report submission, Acceptance of Review Report submission, Acknowledgement letter signed and generated by GCP, Endorsement letter signed and generated by GCPC.
    *   Timestamps are viewable in request history/logs.

#### US10: SLA Breech Monitoring & Escalation
*   **As a** System
*   **I want to** flag requests that exceed time limits at any step so that delays can be escalated.
*   **Acceptance Criteria:**
    *   Each step has a defined SLA (e.g., 24 hours for review).
    *   If SLA is breached, request is flagged as "Violated".
    *   Flag is visible to GCP & GCPC, and included in reports.

#### US11: Role Management Administration
*   **As an** Admin
*   **I want to** manage user roles so that access control is enforced.
*   **Acceptance Criteria:**
    *   Roles defined: Requestor, Reviewer, GCP, GCPC, Admin, Main Committee.
    *   Role-based access control limits what users can view or edit.
    *   Admin can assign or revoke roles.

#### P4-A, B & C: Reporting Dashboard & Config Panel
*   **As an** Admin
*   **I want** a dashboard showing current requests and SLA performance and enable role-based access control settings for users.
*   **Acceptance Criteria:**
    *   Dashboard visualizes historical and current data of all requests.
    *   Dashboard tracks counts, average completion time, and flagged requests.
    *   A page to configure role access to users.
    *   Allow users to export reports in PDF/Excel formats.

---

## 7. Dependencies & Constraints

*   **Dependencies:**
    *   System will use Dataverse as the primary data source, and SharePoint as documents storage.
    *   All users will access via link to Power Pages, with access to pages according to their roles.
*   **Constraints:**
    *   No/limited licensing available; alternative UI solutions may be required. The alternative identified is Microsoft Forms free version.

## 8. Success Metrics

*   **Pre-deployment:**
    *   Requirements are reviewed during each Sprint Planning session.
    *   Each user story must meet all Acceptance Criteria before sprint closure.
    *   Product Owner (from GCP) validates functionality during Sprint Demo.
*   **Post-deployment:**
    *   Reduction in manual processing time.
    *   High user adoption and satisfaction.
    *   SLA compliance improvement.
    *   Accurate and timely reporting.

---

## 9. Timeline / Agile Milestones

| Milestone | Description | Goal | Target Date |
| :--- | :--- | :--- | :--- |
| **Sprint 0** | Project Kick-off | Preparation briefing | 23 June 2025 |
| **Sprint 1** | Core intake and review flow functional | BRD Sign-Off; Deliver Minimum Viable Product (MVP): FR1–FR13, NFR1–NFR3. Weekly Standup Meeting on Friday 8:30am. | 10 Sept 2025 (Planning: 15 Aug) |
| **Sprint 2** | System Enhancements | Deliver P3 features: FR14, FR15, FR16. Implementation of Notification System, Timestamp Capture, and SLA Tracking. | 24 Sept 2025 |
| **Sprint 3** | Admin Tools & Analytics | Deliver P4 features: FR17, FR18, FR19, FR20, NFR4, NFR5, NFR6. Build Dashboards, Config Panels, and Report Exports. | 15 Oct 2025 |
| **Sprint 4** | Data Migration | Migrate historical system records into new architecture data pools | 17 Oct 2025 |
| **Sprint 5** | UAT & Validation | All features tested and approved; complete full business UAT cycles | 21 Oct 2025 |
| **Sprint 6** | Deployment & Launch | Go-Live deployment, user onboarding, and training sessions (TBC: 21-23 Oct) | 23 Oct 2025 |
| **Sprint 7** | Hypercare Support | 2 weeks Post-Go-Live Support, stabilization hypercare, feedback loop execution | 23 Oct 2025 onwards |

---

## 10. Appendix

### 10.1 Contract Procurement Request Lifecycle

#### Lifecycle Step Process:
1.  **Requestor** submits request form.
2.  **Verifier** receives and reviews request.
    *   *If incomplete:* return to Requestor for rework.
    *   *If complete:* proceed to routing logic step.
3.  **System** determines route:
    *   *If GCP request:* proceed to GCP engagement booking.
    *   *If GCPC request:* proceed to GCPC engagement booking.
4.  **Engagement session** (GCP or GCPC) is held.
5.  **For GCPC requests:**
    *   Summary Review report and endorsement letter auto-generated upon completion (for Code 1 Summary Review conclusion).
    *   If engagement fails: return to Requestor for revision and resubmission (for Code 2 Summary Review conclusion).
    *   If submitted after tender/proposal submission: Review report states Code 3.
    *   If submitted after LOA received: Review report states Code 4.
    *   If defined as a special project: must attach signed Waiver form from GCEO office (Code W).
6.  **For GCP requests:**
    *   Summary Review report and acknowledgement auto-generated upon completion (Code 1).
    *   If review cannot conclude: return to Requestor for revision and resubmission (Code 2).
    *   If no resubmission within 30 days after issuance of Code 2: Review report states Code 3.

#### 10.1.1 User Flow Map - Requestor Experience
1.  Log in via Power Pages with user account.
2.  Access "Submit Request" webpage.
3.  Select "GCPC" link for GCPC requests, or "GPC" link for GCP requests.
4.  Choose your specific request type and click on the form link.
5.  Fill in required fields and attach documents.
6.  Submit and receive Confirmation message.
7.  Await notification of review outcome:
    *   *If rework requested:* edit and resubmit.
    *   *If verified:* view and book engagement session.
8.  Await notification of engagement invite details.
9.  **When awaiting notification of Summary Review Report (GCPC):**
    *   *Code 1:* Accepted.
    *   *Code 2:* Requires Rework.
    *   *Code 3:* Late request (after tender/proposal submission) — non-compliant.
    *   *Code 4:* Late request (after award/acceptance) — non-compliant.
    *   *Code W:* Exemption from review requested via signed GCEO Waiver.
10. **When awaiting notification of Summary Review Report (GCP):**
    *   *Code 1:* Accepted.
    *   *Code 2:* Requires Rework.
    *   *Code 3:* No resubmission within 30 days after Code 2 issuance.
11. Await signed Acceptance of Review by HOC.
12. Await notification of final acknowledgement/endorsement letter.

#### 10.1.2 User Flow Map - Verifier Experience
1.  Log in with Office 365 user account.
2.  Access "All Request" page.
3.  Filter requests based on statuses: `"New"`, `"R"` (Pending Engagement), `"Ack"`, `"E"`, `"FR"` (For Record), `"NC"`, `"NC3"`, `"NC4"`, `"FA"` (For Action).
4.  Choose a request with status `"New"` and open the link.
5.  Verify all form fields and attached compliance documents.
6.  Finalize verification outcome:
    *   *Rework required:* click Rework and enter structured justification comments.
    *   *Verified successfully:* click Set Engagement.
7.  After engagement scheduling is finalized, send engagement invitations to the Requestor and Reviewer group.

#### 10.1.3 User Flow Map - Reviewer Experience
1.  Log in with Office 365 user account.
2.  Access "All Request" page.
3.  Filter requests by target status types.
4.  Select request marked as `"R\<engagement session number\>"` and open details.
5.  Review fields and check all attached verification materials.
6.  **Finalize Summary Review outcome for GCPC:** Code 1 (Accept), Code 2 (Rework), Code 3 (Post-Tender), Code 4 (Post-Award), or Code W (Waiver).
7.  **Finalize Summary Review outcome for GCP:** Code 1 (Accept), Code 2 (Rework), or Code 3 (30-day Breach expiry).
8.  Await Acceptance of Review execution, then generate final acknowledgement/endorsement letter.
9.  Monitor dashboards and metrics; perform analytical report exports.

#### 10.1.5 User Flow Map - Main Committee Experience
1.  Log in with Office 365/organization credentials.
2.  Access Executive Dashboard (high-level KPI metric cards: total projects, total requests, new requests, pending actions).
3.  Click "View Projects" to access the master Contract Listing.
4.  Click "View Requests" to look through the global Request Listing.
5.  Open individual entries for read-only view access to reviews, justifications, endorsements, and letters.

#### 10.1.6 User Flow Map - Admin Experience
1.  Log in with Admin credentials.
2.  Access Admin Dashboard controls.
3.  Manage system access: assign or revoke user roles across categories.
4.  Configure specific SLA timeline thresholds per workflow stage.
5.  Update organization inventory details and company cross-references.

---

### 10.2 Screen Distribution Map

| Route | Type | Requestor Screens | Verifier Screens | Main Committee Screens | GCP / GCPC Screens | Admin Screens |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GCPC** | **RTP** | - RTP form<br>- Resubmit Notif.<br>- Update Listing Notif. | - Review RTP Form<br>- Resubmit Notif.<br>- Success Listing Notif. | - RTP Listing<br>- All RTP Requests | - Update RTP Listing<br>- Update Listing Notif. | |
| | **PBL / JVP** | - PBL form / JVP form<br>- Resubmit Notif.<br>- Engagement Inv. Notif. | - Review PBL/JVP Form<br>- Resubmit Notif.<br>- Engagement Inv. Notif. | - View PBL Summary<br>- Summary Report Form<br>- Endorsement Letter & Notif. | - PBL Endorsement Letter<br>- JVP Endorsement Letter<br>- Endorsement Notif. | |
| | **ST/SP** | - ST/SP form<br>- Resubmit Notif.<br>- Engagement Inv. Notif. | - Review ST/SP form<br>- Resubmit Notif.<br>- Engagement Invitation | - Summary Report Form<br>- Summary Report Notif.<br>- CAA Listing<br>- All CAA Listing | - ST/SP Endorsement Letter<br>- Endorsement Notif.<br>- Update CAA Listing<br>- Update Listing Notif. | |
| | **CAA** | - CAA form<br>- Update Listing Notif. | - Review CAA form<br>- Update Listing Notif. | | | |
| | **PCCA** | - PCCA form<br>- Resubmit Notif.<br>- Engagement Inv. Notif. | - Review PCCA form<br>- Resubmit Notif.<br>- Engagement Invitation | - PCCA Summary Report Form<br>- Summary Report Notif. | - PCCA Endorsement Letter<br>- Endorsement Notif. | |
| | **PP / VAP** | - PP Form / VAP form<br>- Resubmit Notif.<br>- Engagement Inv. Notif. | - Review PP/VAP Form<br>- Resubmit Notif.<br>- Engagement Invitation | - PP/VAP Summary Report Form<br>- Summary Report Notif. | - PP/VAP Endorsement Letter<br>- Endorsement Notif. & Letter Notif. | |
| | **Others** | - Others form<br>- Resubmit Notif.<br>- Engagement Inv. Notif. | - Review Others form<br>- Resubmit Notif.<br>- Engagement Invitation | - Others Summary Report Form<br>- Summary Report Notif. | - Update Others Listing<br>- Update Others Listing Notif. | |
| **GCP** | **PCCA-R / CI** | - RPCCA form / CI form<br>- Resubmit Notif.<br>- Engagement Inv. Notif. | - Review RPCCA/CI Form<br>- Resubmit Notif.<br>- Engagement Invitation | - RPCCA/CI Summary Report Form<br>- Summary Report Notif. | - RPCCA/CI Acknowledgement Letter<br>- Acknowledgement Letter Notif. | |
| | **CPR** | - CPR form<br>- CPR Update Listing | - Review CPR form<br>- Update Listing Notif. | *N/A* | - Update CPR Listing | |
| | **Others** | - Others form<br>- Resubmit Notif.<br>- Engagement Inv. Notif. | - Review Others form<br>- Resubmit Notif.<br>- Engagement Invitation | - Others Summary Report Form<br>- Summary Report Notif. | - Update Others Listing<br>- Update Others Listing Notif. | |
| **Global**| **Settings**| | | | | - Settings Page<br>- Company Details Listing |

---

### 10.3 Field Requirements for Screens

#### 10.3.1 GCPC > RTP Form [Requestor POV]

| Field Name | Field Type | Required? | Validation / Rules | Notes |
| :--- | :--- | :--- | :--- | :--- |
| Project Name | Text | Yes | Standard Validation | Master Project ID anchor |
| Brief Project Description | Text (Long) | Yes | Standard validation | |
| Project Ref. No. | Text | No | Optional alphanumeric | |
| Client's Name | Text | Yes | Alphanumeric entry | |
| Description of Matters for Review | Dropdown | Yes | Must select one | Options: Registration of Tender List, Registration of Proposal List |
| Request Title | Text (Single line) | Yes | Max 100 characters | Brief descriptive title |
| Tender Closing Date | Date Picker | Yes | Future parameters enforced | Appears when choosing Registration of Tender List |
| Special Project with Approved Waiver | Choices | Yes | Yes or No selection | Controls conditional waiver fields |
| Supporting Document | File upload | Yes | Max 10MB, up to 10 files | Compulsory: Signed Tender Review Form (for New Tender Listing), Approved Waiver if Special Project |
| Acknowledgement Checkbox | Checkbox | Yes | Must be checked before submission | Confirms user agrees with policy/process terms |

#### 10.3.2 GCPC > PBL Form [Requestor & Reviewer POV]

| Field Name | Field Type | Required? | Validation / Rules | Notes |
| :--- | :--- | :--- | :--- | :--- |
| Company | Autofilled | Yes | Retrieved from user profile | |
| Select Project: | Dropdown | Yes | List out all projects from requestor company | |
| Project Code | Autofilled | Yes | Retrieved from selected project details | |
| Date | Date picker | Yes | Must match the date in physical PBL form copy | |
| Method of Procurement | Dropdown | Yes | Choose one | Options: Selective Tendering, Direct Negotiation |
| **Prospective Bidders Table** | *Table Section*| | **New Section in a table layout format**| |
| ↳ Company Name | Text | Yes | Row array loop | |
| ↳ Person in Charge | Text | Yes | Row array loop | |
| ↳ Contact Number | Numbers | Yes | Integer format validation | |
| ↳ Sources From | Text | Yes | Row array loop | |
| ↳ Recommendation By | Text | Yes | Row array loop | |
| Justification for < 3 bidders | Text (Long) | Yes | Long text entry mandatory if total rows < 3 | |
| Supporting Document | File upload | Yes | Max 10MB, up to 10 files | Upload button located in the final column of the table matrix |
| Acknowledgement Checkbox | Checkbox | Yes | Must be checked before submission | Confirms user agrees with terms |
| Part 3: Review | Text (Long) | Yes | Long text entry | **Reviewer addition field only** |

#### 10.3.3 GCPC > JVP Form [Requestor & Reviewer POV]

| Field Name | Field Type | Required? | Validation / Rules | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Part 1: General Information** | | | | |
| Company | Autofilled | Yes | Retrieved from user profile | |
| Select Project: | Dropdown | Yes | List out projects from requestor company | |
| Project Code | Autofilled | Yes | Retrieved from selected project details | |
| Matters to Review | Autofilled | Yes | Retrieved based on request type selection | |
| Review No. | Autofilled | Yes | Autonumbered track | |
| Date of Review | Autofilled | Yes | TBC — populated only after engagement booking | Appears in summary form view only |
| **Part 2: Person in Charge of JV**| | | | |
| Team Leader | Text | Yes | Validation tracking | |
| Financial Matters | Text | Yes | Validation tracking | |
| Technical Matters | Numbers | Yes | Number validation | |
| Procurement Matters | Text | Yes | Validation tracking | |
| Costing and Estimation Matters | Text | Yes | Validation tracking | |
| Implementation Stage | Text | Yes | Validation tracking | |
| **Part 3: JV Formation Particulars** | | | | |
| 1. Background of Collaboration | Text (Long) | Yes | Detailed background notes | Includes reference notes |
| 2. Scope of Collaboration | Text (Long) | Yes | Detailed scope mapping | Includes reference notes |
| 3. Proposed Structure | Text (Long) | No | Structural workflow details | |
| Proposed Structure Image | File | No | Single image file capture | Only 1 image can be stored per record |
| 4. Key Terms | Text (Long) | Yes | Enforce compliance terms | |
| **5. Financial Overview Sub-Section** | | | | |
| ↳ a) Initial Capital Req. / Investment | Text | Yes | Entry per party breakdown | |
| ↳ b) Project Value | Text | Yes | Enforced if Project Specific | |
| ↳ c) Forecasted Returns/Profitability | Text | Yes | Metric calculations | |
| ↳ d) Cashflow Forecast | Text | Yes | Includes JV operational cost tracking | |
| ↳ e) Funding Strategy | Text | No | e.g., shareholder loan, external finance | |
| ↳ f) Financial Assumptions & Sensitivity | Text | No | Matrix tracking models | |
| 6. Technical Capabilities & Resources | Text | Yes | Asset mapping validation | |
| 7. Work Packages/Division of Resp. | Text | Yes | Scope assignment details | |
| 8. Resources Contribution | Text | Yes | Manpower, Design, Tools, etc. | |
| 9. Cost Structure/Breakdown | Text | Yes | Itemized accounting details | |
| 10. Risk Review & Mitigation | Text | Yes | Table matrix framework | |
| Supporting Documents | File upload | Yes | Max 10MB, 10 files | The copy of the form with signatures |
| Acknowledgement Checkbox | Checkbox | Yes | Must be checked before submission | Confirms compliance & approvals |
| Part 3: Review | Text (Long) | Yes | Long Text entry | **Reviewer additional field** |

#### 10.3.4 GCPC > ST/SP Form [Requestor & Reviewer POV]

| Field Name | Field Type | Required? | Validation / Rules | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Part 1: General Information** | | | | |
| Company / Select Project / Project Code | Autofilled/DD| Yes | Standard general profile pull | |
| Matters to Review / Review No / Date | Autofilled | Yes | Dynamic automation hooks | Date appears on summary only |
| **Part 2: Person in Charge** | | | | |
| Team Leader / Financial / Procurement | Text | Yes | Alphanumeric validation | |
| Technical Matters | Numbers | Yes | Number form parameters | |
| Costing & Estimation / Implementation | Text | Yes | Alphanumeric validation | |
| **Part 3: Tender/Proposal Particulars**| | | | |
| 1. Brief on background of matters | Text (Long) | Yes | Context notes | Include notes for reference |
| 2. Scope of Works | Text (Long) | Yes | Operational scope | Include notes for reference |
| 3. Construct Structure | Text (Long) | No | High level summary details | |
| Construct Structure Image | File | No | Supporting Image field | Only 1 image allowed per record |
| 4. Key Terms | Text (Long) | Yes | Compliance boundaries | |
| **5. Financial Overview Sub-Section** | | | | |
| ↳ a) Project Value | Text | Yes | Value validation | |
| ↳ b) Forecast Gross Margin | Text | Yes | Percent or currency value | |
| ↳ c) Revenue vs Cost | Text | Yes | PCCA category link; matches breakdown #9 | |
| ↳ d) Cashflow / e) Funding | Text | Yes | Financial status maps | |
| ↳ f) Sensitivity Analysis | Text | Yes | Risk modeling text box | For key assumptions |
| 6. Technical Capabilities & Resources | Text | Yes | Capabilities breakdown | |
| 7. Work Packages/Division of Resp. | Text | Yes | Allocation matrix | |
| 8. Resources Contribution | Text | Yes | Manpower, Design, Tools, etc. | |
| 9. Cost Structure/Breakdown | Text | Yes | Comprehensive itemized view | |
| **10. Risk Review & Mitigation Plan** | *Table Format*| Yes | Matrix loop configuration | Fields: No., Risk Identified, Mitigation Plan |
| Supporting Document | File upload | Yes | Max 10MB, 10 files | Form copy with signatures |
| Acknowledgement Checkbox | Checkbox | Yes | Must be checked before submission | Confirms policy terms agreement |
| Part 3: Review | Text (Long) | Yes | Long Text | **Reviewer additional field** |

#### 10.3.5 GCPC > CAA Form [Requestor POV]

| Field Name | Field Type | Required? | Validation / Rules | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **1. Key Information** | | | | |
| Company / Select Project / Project Code | Autofilled/DD| Yes | Standard validation profile pull | |
| Client Name | Autofilled | Yes | Linked metadata hooks | |
| Tender / Proposal Price during submission | Number | Yes | Currency validation rules | |
| Contract No. | Number | Yes | Numeric entry string | |
| Final Contract Amount | Number | Yes | Currency validation rules | |
| Estimated Budget Cost | Number | Yes | Currency validation rules | |
| Estimated Margin % | Number | Yes | Percentage bounds (0-100%) | |
| Letter of Award (LOA) Date | Datepicker | Yes | Date parameters checked | |
| Tender / Proposal Ref. No. | Number | Yes | Document reference tracking | |
| Contract Commencement / Completion Date | Datepicker | Yes | Chronological rule checks | |
| Contract Period (days) | Number | Yes | Calculated field or manual integer | |
| **Critical Activity Milestone Table** | *Table Format*| Yes | Structural grid format | Fields: No., Insert Critical Activity |
| Defect Liability Period (DLP) | Text | Yes | Matrix timeline limits | |
| Liquidated Damages (LAD) Rate | Number | Yes | Financial penalty parameters | |
| Payment Term | Text | Yes | Terms description tracking | |
| Type of Contract / Form of Contract | Text | Yes | Industry form variants descriptor | |
| Project Director (PD) | Text | Yes | Staff registry matching | |
| Contact Person at Site/Designation/No. | Text | Yes | Communication info block | |
| **2. Contract Requirements Section** | | | | |
| Performance Bond (PB) for Project | Text | Yes | Bond financial detail log | |
| Project Organisation & Manpower Chart | Text | Yes | Organization context parsing | |
| Stamp Duty (Inclusive of legal cost/fees) | Numbers | Yes | Pure currency value formatting | |
| Insurance / Bumiputera Participation | Text | Yes | Underwriting conditions text | |
| Formation of JV Company | Text | Yes | Structuring entity validation | |
| **3. Key Requirements Section** | | | | |
| Claim Management - Claim Application | Text (Long) | Yes | Fields: Description, No. Of days, Clause Ref.| |
| Claim Management - Claim Certification | Text (Long) | Yes | Fields: Description, No. Of days, Clause Ref.| |
| Change Management - VO Application | Text (Long) | Yes | Fields: Description, No. Of days, Clause Ref.| |
| Change Management - EOT Application | Text (Long) | Yes | Fields: Description, No. Of days, Clause Ref.| Table format format block |
| Commissioning & Completion Mgmt System | Text (Long) | Yes | Fields: Description, No. Of days, Clause Ref.| Standards Reference & Compliance |
| Key Delivery Milestone | Text (Long) | Yes | Fields: Description, No. Of days, Clause Ref.| |
| Mandatory Testing required to commission | Text (Long) | Yes | Fields: Description, No. Of days, Clause Ref.| |
| Doc required for CPC | Text (Long) | Yes | Fields: Description, No. Of days, Clause Ref.| Practical Completion Certificate |
| Pre-requisite documents for DLP completion| Text (Long) | Yes | Fields: Description, No. Of days, Clause Ref.| Defect Liability Period |
| Supporting Document | File upload | Yes | Max 10MB, 10 files | Full form copy with validation |
| Acknowledgement Checkbox | Checkbox | Yes | Must be checked before submission | Confirms policy terms agreement |

#### 10.3.6 GCPC > PCCA [Requestor & Reviewer POV]

| Field Name | Field Type | Required? | Validation / Rules | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Part 1: General Information** | | | | |
| Company / Select Project / Project Code | Autofilled/DD| Yes | Base metadata profile mapping | |
| Matters to Review | Autofilled | Yes | Selected request cross-link | |
| **Part 2: Price/Revenue (from Contract BQ)**| | | | |
| Work Description (BQ) | Text | Yes | Grid entry array loops | Description of the scope |
| Price / Revenue (RM) | Number | Yes | Currency scale calculation | Revenue value for that item |
| Add Revenue Item button | Repeating Sec| Yes | Appends data rows on demand | For multiple entries |
| **Part 3: Cost (from Contract BQ)** | | | | |
| Work Description (BQ) | Text | Yes | Matches baseline layout properties | Same as revenue section |
| Cost (RM) | Number | Yes | Grid numeric entry models | Cost value for that item |
| Add Cost Item button | Repeating Sec| No | Structural parity with revenue block | Matches Revenue structure |
| **Part 4: Summary Calculations** | | | | |
| Total Revenue (RM) | Auto-calc | *System* | Sum of all revenue array indices | Automated calculation (optional display) |
| Total Cost (RM) | Auto-calc | *System* | Sum of all cost array indices | Automated calculation (optional display) |
| Construction cost (RM) | Number | Yes | Balance calculations validation | Manual text box entry field |
| Internal Cost | Number | Yes | Cost balance calculation profiles | Manual text box entry field |
| Remarks | Text | No | Optional notes string | |
| Supporting Document | File upload | Yes | Max 10MB, 10 files | Core signed input documents |
| Acknowledgement Checkbox | Checkbox | Yes | Checked confirmation block | Confirms processing policy boundaries |
| **Summary Review Report (Reviewer POV)** | | | | |
| Part 2 / Part 3 Review Fields | Text | Yes | Long Text narrative inputs | **Reviewer-only commentary fields** |



