// src/components/letters/letterTemplates.ts
//
// ─────────────────────────────────────────────────────────────────────────────
//  Acknowledgement & Endorsement letter TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────
// These templates are transcribed from the official Word letter templates
// (acknowledgment/*.docx and Endorsement/*.docx). They are the single source
// of truth for the wording shown on the Letter page — EDIT THE WORDING HERE.
//
// Each template is built from:
//   • infoRowKeys  – variable keys rendered as the info table under the header
//   • paragraphs   – the letter body, segment by segment (string | { var })
//   • variables    – every fillable token, each either:
//        - AUTO  → has an `auto(ctx)` resolver that returns a value from the
//                  request. Shown read-only (we already have the value).
//        - MANUAL→ no auto value (auto missing or returns null/'') → the user
//                  types it in on the Letter page.
//
// To change wording: edit the `paragraphs` strings.
// To add a new variable: add it to `variables` and reference its `key` in a
// paragraph segment ({ var: 'myKey' }) or in `infoRowKeys`.
// To make a value auto-fill: give the variable an `auto(ctx)` resolver.

import type { GcpRequest } from '../../types/request';

export type LetterKind = 'ACK' | 'E';

/** Everything an auto-resolver can read to fill a variable from the request. */
export interface LetterContext {
  request: GcpRequest;
  /** Full matter label, e.g. "Prospective Bidders List (PBL)". */
  matterLabel: string;
  /** Short SoA label, e.g. "PBL". */
  soaLabel: string | null;
}

export interface LetterVariable {
  key: string;
  /** Used as the info-table row header and as the edit-field label. */
  label: string;
  /** Hint text shown in the manual input. */
  placeholder?: string;
  kind?: 'text' | 'date';
  /**
   * Auto-resolver. Return a non-empty string to auto-fill (read-only). Return
   * null / '' to leave it as a manual, user-editable variable.
   */
  auto?: (ctx: LetterContext) => string | null;
}

/** A body segment: plain text, or a reference to a variable by key. */
export type Segment = string | { var: string };

export interface LetterTemplate {
  /** Stable key persisted alongside the entered values. */
  key: string;
  kind: LetterKind;
  /** Parenthetical document subtitle, e.g. "(Prospective Bidders List)". */
  documentTitle: string;
  /** Ordered variable keys rendered in the info table. */
  infoRowKeys: string[];
  /** Letter body, paragraph by paragraph. */
  paragraphs: Segment[][];
  /** Closing line under the signature rule. */
  signoff: string;
  /** Attachment bullet lines. */
  attachments: string[];
  /** Variables referenced by infoRowKeys / paragraphs. */
  variables: LetterVariable[];
}

// ── Shared helpers ──────────────────────────────────────────────────────────

/** Format an ISO date (or datetime) string as dd/mm/yyyy; '' when missing. */
export const formatLetterDate = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
};

/** Shared "cc." recipients — edit names/roles here. */
export const CC_LIST = [
  'GEXCO',
  'GCPC Chairman — Dato Rosli b Husin',
  'GCPC Member — Mohammad Nadzif b Bustari',
  'GCPC Member — Hafitz b Khalid',
  'GCPC Member — Ivy Lau',
  'GCPC Member — Foong Pak Chee',
  'OEC',
  'Company Team Leader',
];

const SIGNOFF_GCP = 'On behalf of\nGroup Contracts and Procurement';
const SIGNOFF_GCPC = 'On behalf of\nGroup Contracts and Procurement Committee';

// ── Reusable variables (auto-filled from the request) ───────────────────────

const vCompany: LetterVariable = {
  key: 'company',
  label: 'Company Name',
  auto: (c) => c.request.companyName,
};
const vProjectName: LetterVariable = {
  key: 'projectName',
  label: 'Project Name',
  auto: (c) => c.request.projectName,
};
const vProjectCode: LetterVariable = {
  key: 'projectCode',
  label: 'Project Code',
  auto: (c) => c.request.projectCode,
};
const vMatters: LetterVariable = {
  key: 'matters',
  label: 'Matters to Review',
  auto: (c) => c.matterLabel,
};
const vReviewNo: LetterVariable = {
  key: 'reviewNo',
  label: 'Review No.',
  placeholder: 'e.g. R01',
};
const vDateOfReview: LetterVariable = {
  key: 'dateOfReview',
  label: 'Date of Review',
  kind: 'date',
  auto: (c) => formatLetterDate(c.request.reviewDate),
};
const vAcceptanceDate: LetterVariable = {
  key: 'acceptanceDate',
  label: 'Review Acceptance Date',
  kind: 'date',
  auto: (c) => formatLetterDate(c.request.acceptanceDate),
};
const vSubmittedOn: LetterVariable = {
  key: 'submittedOn',
  label: 'Submission Date',
  kind: 'date',
  auto: (c) => formatLetterDate(c.request.submittedOn),
};

/** Date the Summary Review was submitted to the company — manual (not stored). */
const vSummaryReviewDate: LetterVariable = {
  key: 'summaryReviewDate',
  label: 'Summary Review submission date',
  kind: 'date',
  placeholder: 'dd/mm/yyyy',
};
const vGrossMargin: LetterVariable = {
  key: 'grossMargin',
  label: 'Forecast gross margin',
  placeholder: 'e.g. 12%',
};

// Standard info-table layouts.
const ACK_INFO = [
  'projectCode',
  'company',
  'projectName',
  'matters',
  'reviewNo',
  'dateOfReview',
  'acceptanceDate',
];
const ENDORSE_INFO = ['projectCode', 'reviewNo', 'dateOfReview', 'acceptanceDate'];

// ─────────────────────────────────────────────────────────────────────────────
//  ACKNOWLEDGEMENT TEMPLATES (GCP channel)
// ─────────────────────────────────────────────────────────────────────────────

/** CI — Contractual Issue (Variation Order / Payment / EOT / L&E). */
const ackCI: LetterTemplate = {
  key: 'ack-ci',
  kind: 'ACK',
  documentTitle: 'For Variation Order / Payment / EOT / L&E',
  infoRowKeys: ACK_INFO,
  variables: [
    vProjectCode, vCompany, vProjectName, vMatters, vReviewNo, vDateOfReview,
    vAcceptanceDate, vSubmittedOn, vSummaryReviewDate,
    {
      key: 'issueDescription',
      label: 'Brief description of the matter',
      placeholder:
        'e.g. Variation Order for additional piling works / EOT for late information',
    },
    {
      key: 'claimValue',
      label: 'Claimed value / extension',
      placeholder: 'e.g. RM120,000.00 / extension of 30 calendar days',
    },
  ],
  paragraphs: [
    [
      'Based on the company’s internal review, we record that the matter relating to ',
      { var: 'issueDescription' },
      ' was submitted to us on ',
      { var: 'submittedOn' },
      ' with a claimed value of ',
      { var: 'claimValue' },
      '.',
    ],
    [
      'Following our internal assessment and reference to the GCP Summary Review for Contractual Issues submitted to you on ',
      { var: 'summaryReviewDate' },
      ', we hereby acknowledge and record that the matter has been reviewed, based on your Review Acceptance dated ',
      { var: 'acceptanceDate' },
      '.',
    ],
  ],
  signoff: SIGNOFF_GCP,
  attachments: ['Company Review Acceptance', 'GCP Summary Review signed by GCP'],
};

/** Revised Project Baseline (Revised PCCA). */
const ackRevisedBaseline: LetterTemplate = {
  key: 'ack-revised-baseline',
  kind: 'ACK',
  documentTitle: 'Revised Project Baseline',
  infoRowKeys: ['projectCode', 'company', 'projectName', 'matters', 'reviewNo', 'dateOfReview'],
  variables: [
    vProjectCode, vCompany, vProjectName, vMatters, vReviewNo, vDateOfReview,
    vAcceptanceDate, vSubmittedOn,
    {
      key: 'revenue',
      label: 'Updated project revenue',
      placeholder: 'e.g. RM 45,000,000',
    },
    vGrossMargin,
    {
      key: 'packages',
      label: 'No. of Procurement Packages',
      placeholder: 'e.g. 12',
    },
  ],
  paragraphs: [
    [
      'Based on the company’s internal review, we record that the revised project baseline was submitted on ',
      { var: 'submittedOn' },
      ', with an updated project revenue of ',
      { var: 'revenue' },
      ' and a gross margin of ',
      { var: 'grossMargin' },
      '. The number of Procurement Packages, as referred to in the updated PCCA, now stands at ',
      { var: 'packages' },
      '.',
    ],
    [
      'Following our internal review and reference to the GCP Summary Review for Revised Project Baseline, we hereby acknowledge and confirm that the revised submission has been reviewed, based on your Review Acceptance dated ',
      { var: 'acceptanceDate' },
      '.',
    ],
  ],
  signoff: SIGNOFF_GCP,
  attachments: ['Company Review Acceptance', 'GCP Summary Review signed by Members'],
};

/** Fallback for any other GCP matter without a dedicated template. */
const ackGeneric: LetterTemplate = {
  key: 'ack-generic',
  kind: 'ACK',
  documentTitle: 'Acknowledgement',
  infoRowKeys: ACK_INFO,
  variables: [
    vProjectCode, vCompany, vProjectName, vMatters, vReviewNo, vDateOfReview,
    vAcceptanceDate,
    {
      key: 'body',
      label: 'Acknowledgement details',
      placeholder: 'Describe the matter that has been reviewed and acknowledged.',
    },
  ],
  paragraphs: [
    [{ var: 'body' }],
    [
      'Following our internal review, we hereby acknowledge and confirm that the submission has been reviewed, based on your Review Acceptance dated ',
      { var: 'acceptanceDate' },
      '.',
    ],
  ],
  signoff: SIGNOFF_GCP,
  attachments: ['Company Review Acceptance', 'GCP Summary Review signed by Members'],
};

// ─────────────────────────────────────────────────────────────────────────────
//  ENDORSEMENT TEMPLATES (GCPC channel)
// ─────────────────────────────────────────────────────────────────────────────

/** PBL — Prospective Bidders List. */
const ePBL: LetterTemplate = {
  key: 'e-pbl',
  kind: 'E',
  documentTitle: 'Prospective Bidders List',
  infoRowKeys: ENDORSE_INFO,
  variables: [
    vProjectCode, vReviewNo, vDateOfReview, vAcceptanceDate, vSummaryReviewDate,
    {
      key: 'packageValue',
      label: 'Approximate package value',
      placeholder: 'e.g. RM5,000,000.00',
    },
    { key: 'bidderCount', label: 'No. of potential bidders', placeholder: 'e.g. 5' },
    {
      key: 'procurementMethod',
      label: 'Method of procurement',
      placeholder: 'e.g. Selective Tendering',
    },
  ],
  paragraphs: [
    [
      'Based on company’s business decision, at the point of review we record that the approximate value of this package was estimated at ',
      { var: 'packageValue' },
      ' with ',
      { var: 'bidderCount' },
      ' numbers of potential bidders through ',
      { var: 'procurementMethod' },
      '.',
    ],
    [
      'From the guidelines and checklist, we are pleased to endorse your Prospective Bidder’s List based on your Review Acceptance dated ',
      { var: 'acceptanceDate' },
      ' of our final review via GCPC Summary Review for Prospective Bidders List submitted to you on ',
      { var: 'summaryReviewDate' },
      '.',
    ],
    ['Please use this Endorsement No. for related matters to this PBL.'],
  ],
  signoff: SIGNOFF_GCPC,
  attachments: ['Company Review Acceptance', 'GCPC Summary Review signed by Members'],
};

/** JVP — JV Formation / Collaboration Partners. */
const eJVP: LetterTemplate = {
  key: 'e-jvp',
  kind: 'E',
  documentTitle: 'JV Formation / Collaboration Partners Submission',
  infoRowKeys: ENDORSE_INFO,
  variables: [
    vProjectCode, vReviewNo, vDateOfReview, vAcceptanceDate, vSummaryReviewDate,
    {
      key: 'jvName',
      label: 'JV Company Name',
      placeholder: 'e.g. ABC–XYZ JV Sdn Bhd',
    },
    {
      key: 'projectValue',
      label: 'Indicative project value',
      placeholder: 'e.g. RM80,000,000.00',
    },
    vGrossMargin,
  ],
  paragraphs: [
    [
      'Based on the company’s business decision, we note that at the point of review, the proposed collaboration for the formation of ',
      { var: 'jvName' },
      ' was evaluated with an indicative project value of ',
      { var: 'projectValue' },
      ' and a forecast gross margin of ',
      { var: 'grossMargin' },
      '.',
    ],
    [
      'Referring to the information submitted and discussions held, we are pleased to ENDORSE the formation of the JV/Partnership under the entity name ',
      { var: 'jvName' },
      ', based on your Review Acceptance dated ',
      { var: 'acceptanceDate' },
      ', following our final review via the GCPC Summary Review for JV/Partnership Formation submitted to you on ',
      { var: 'summaryReviewDate' },
      '.',
    ],
    ['Please use this Endorsement No. for related matters to this JV/Partnership formation.'],
  ],
  signoff: SIGNOFF_GCPC,
  attachments: ['Company Review Acceptance', 'GCPC Summary Review signed by Members'],
};

/** ST/SP — Tender and Proposal Submission. */
const eSTSP: LetterTemplate = {
  key: 'e-stsp',
  kind: 'E',
  documentTitle: 'Tender and Proposal Submission',
  infoRowKeys: ENDORSE_INFO,
  variables: [
    vProjectCode, vReviewNo, vDateOfReview, vAcceptanceDate, vSummaryReviewDate,
    {
      key: 'tenderValue',
      label: 'Approximate tender/proposal value',
      placeholder: 'e.g. RM60,000,000.00',
    },
    vGrossMargin,
  ],
  paragraphs: [
    [
      'Based on company’s business decision, at the point of review we record that the approximate value of this tender/proposal was estimated at ',
      { var: 'tenderValue' },
      ' with a forecast gross margin of ',
      { var: 'grossMargin' },
      '.',
    ],
    [
      'From the guidelines and checklist, we are pleased to ENDORSE your submission of tender/proposal based on your Review Acceptance dated ',
      { var: 'acceptanceDate' },
      ' of our final review via GCPC Summary Review for Tender and Proposal submission submitted to you on ',
      { var: 'summaryReviewDate' },
      '.',
    ],
    ['Please use this Endorsement No. for related matters to this Tender/Proposal Submission.'],
  ],
  signoff: SIGNOFF_GCPC,
  attachments: ['Company Review Acceptance', 'GCPC Summary Review signed by Members'],
};

/** PCCA / PP — Project Baseline. */
const ePCCABaseline: LetterTemplate = {
  key: 'e-pcca-baseline',
  kind: 'E',
  documentTitle: 'Project Baseline',
  infoRowKeys: ENDORSE_INFO,
  variables: [
    vProjectCode, vReviewNo, vDateOfReview, vAcceptanceDate, vSummaryReviewDate,
    { key: 'revenue', label: 'Project revenue', placeholder: 'e.g. RM 45,000,000' },
    vGrossMargin,
    { key: 'packages', label: 'Initial Procurement Packages', placeholder: 'e.g. 12' },
  ],
  paragraphs: [
    [
      'Based on company’s business decision, at the point of review we record that the revenue of the project is at ',
      { var: 'revenue' },
      ' with a gross margin of ',
      { var: 'grossMargin' },
      '. The initial Procurement Packages for this project with reference to the PCCA is at ',
      { var: 'packages' },
      ' numbers.',
    ],
    [
      'From the guidelines and checklist, we are pleased to ENDORSE your submission of Initial Project Cost Control Analysis (PCCA) and Procurement Plan based on your Review Acceptance dated ',
      { var: 'acceptanceDate' },
      ' of our final review via GCPC Summary Review for Baseline submitted to you on ',
      { var: 'summaryReviewDate' },
      '.',
    ],
    ['Please use this Endorsement No. for related matters to this PCCA and PP.'],
  ],
  signoff: SIGNOFF_GCPC,
  attachments: ['Company Review Acceptance', 'GCPC Summary Review signed by Members'],
};

/** VAP — Vendor Appointments and Procurements. */
const eVAP: LetterTemplate = {
  key: 'e-vap',
  kind: 'E',
  documentTitle: 'Vendor Appointments and Procurements',
  infoRowKeys: ENDORSE_INFO,
  variables: [
    vProjectCode, vReviewNo, vDateOfReview, vAcceptanceDate, vSummaryReviewDate,
    {
      key: 'appointmentRole',
      label: 'Appointment role',
      placeholder: 'main contractor / sub-contractor / consultant / supplier',
    },
    { key: 'clientName', label: 'Client Name', placeholder: 'e.g. ABC Holdings Bhd' },
    { key: 'loaRef', label: 'LOA / Service Order Ref. No.', placeholder: 'e.g. LOA/2026/001' },
    { key: 'loaDate', label: 'LOA / Service Order date', kind: 'date', placeholder: 'dd/mm/yy' },
    { key: 'contractValue', label: 'Contract value', placeholder: 'e.g. RM50,000,000.00' },
    vGrossMargin,
  ],
  paragraphs: [
    [
      'Based on company’s business decision, at the point of review we record that you have received an appointment as ',
      { var: 'appointmentRole' },
      ' by ',
      { var: 'clientName' },
      ' via Letter of Award/Service Order Ref. ',
      { var: 'loaRef' },
      ' dated ',
      { var: 'loaDate' },
      '. The contract value is at ',
      { var: 'contractValue' },
      ' with a forecast gross margin of ',
      { var: 'grossMargin' },
      '.',
    ],
    [
      'From the guidelines and checklist, we are pleased to ENDORSE your acceptance of LOA based on your Review Acceptance dated ',
      { var: 'acceptanceDate' },
      ' of our final review via GCPC Summary Review for Acceptance of LOA submitted to you on ',
      { var: 'summaryReviewDate' },
      '.',
    ],
    ['Please use this Endorsement No. for related matters to this Vendor Appointments and Procurements.'],
  ],
  signoff: SIGNOFF_GCPC,
  attachments: ['Company Review Acceptance', 'GCPC Summary Review signed by Members'],
};

/** Fallback for any other GCPC matter without a dedicated template. */
const eGeneric: LetterTemplate = {
  key: 'e-generic',
  kind: 'E',
  documentTitle: 'Endorsement',
  infoRowKeys: ENDORSE_INFO,
  variables: [
    vProjectCode, vReviewNo, vDateOfReview, vAcceptanceDate, vSummaryReviewDate,
    {
      key: 'body',
      label: 'Endorsement details',
      placeholder: 'Describe the matter that has been reviewed and endorsed.',
    },
  ],
  paragraphs: [
    [{ var: 'body' }],
    [
      'From the guidelines and checklist, we are pleased to ENDORSE your submission based on your Review Acceptance dated ',
      { var: 'acceptanceDate' },
      ' of our final review via GCPC Summary Review submitted to you on ',
      { var: 'summaryReviewDate' },
      '.',
    ],
    ['Please use this Endorsement No. for related matters to this submission.'],
  ],
  signoff: SIGNOFF_GCPC,
  attachments: ['Company Review Acceptance', 'GCPC Summary Review signed by Members'],
};

// ── Matter-code → template selection ────────────────────────────────────────
// Codes come from src/data/matterChoices.ts (MatterChoice.code).

const ACK_BY_CODE: Record<string, LetterTemplate> = {
  CI: ackCI,
  'R-PCCA': ackRevisedBaseline,
};

const ENDORSE_BY_CODE: Record<string, LetterTemplate> = {
  PBL: ePBL,
  JVP: eJVP,
  'ST/SP': eSTSP,
  PCCA: ePCCABaseline,
  PP: ePCCABaseline,
  VAP: eVAP,
};

/**
 * Pick the letter template for a matter. `kind` decides ACK vs Endorsement
 * (driven by the request's channel); `code` is the MatterChoice.code.
 */
export const selectLetterTemplate = (
  kind: LetterKind,
  code: string | null | undefined,
): LetterTemplate => {
  if (kind === 'ACK') return (code && ACK_BY_CODE[code]) || ackGeneric;
  return (code && ENDORSE_BY_CODE[code]) || eGeneric;
};

export const ALL_LETTER_TEMPLATES = [
  ackCI, ackRevisedBaseline, ackGeneric,
  ePBL, eJVP, eSTSP, ePCCABaseline, eVAP, eGeneric,
];
