// src/components/detail/childSections.tsx
// Declarative section/field configuration per child request type, driven by the
// form → Dataverse mapping (see mapping.md). The Request Detail page renders
// these with buildFields() — no per-type JSX. Labels mirror the form steps so a
// reviewer sees the same wording the requestor filled in.

import {
  Banknote,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  FileSignature,
  Handshake,
  Layers,
  ListChecks,
  PackageCheck,
  ScrollText,
  Users,
} from 'lucide-react';
import type { SectionDef } from './fields';
import type { GcpRtpRequest } from '../../types/rtpRequest';
import type { GcpPblRequest } from '../../types/pblRequest';
import type { GcpJvpRequest } from '../../types/jvpRequest';
import type { GcpStspRequest } from '../../types/stspRequest';
import type { GcpCaaRequest } from '../../types/caaRequest';
import type { GcpPccaRequest } from '../../types/pccaRequest';
import type { GcpOtherRequest } from '../../types/otherRequest';
import type { GcpRpccaRequest } from '../../types/rpccaRequest';
import type { GcpCiRequest } from '../../types/ciRequest';
import type { GcpCprRequest } from '../../types/cprRequest';
import {
  procurementMethodChoices,
  registrationTypeChoices,
} from '../../data/requestChoices';
import { companyRoleInIssueChoices } from '../../data/companyChoices';
import { cprApplicationStatusChoices } from '../../data/cprChoices';

// ── RTP — Registration of Tender & Proposal List ────────────────────────────
const rtpSections: SectionDef<GcpRtpRequest>[] = [
  {
    title: 'Project & Registration',
    icon: ClipboardList,
    fields: [
      { label: 'Client Name', get: (r) => r.clientNameText },
      {
        label: 'Registration Type',
        kind: 'choice',
        choices: registrationTypeChoices,
        get: (r) => r.registrationType,
      },
      { label: 'Tender Closing Date', kind: 'date', get: (r) => r.tenderClosingDate },
      { label: 'Project Name', get: (r) => r.projectName },
      { label: 'Project Description', kind: 'multiline', get: (r) => r.projectDescription },
    ],
  },
  {
    title: 'Confirmation',
    icon: ClipboardCheck,
    fields: [
      { label: 'Special Project', kind: 'boolean', get: (r) => r.specialProject },
      {
        label: 'Special Project (Approved Waiver)',
        kind: 'boolean',
        get: (r) => r.specialProjectWithApprovedWaiver,
      },
      { label: 'Acknowledged', kind: 'boolean', get: (r) => r.acknowledged },
      { label: 'Verifier Comments', kind: 'multiline', get: (r) => r.verifierComments },
    ],
  },
];

// ── PBL — Prospective Bidders List ──────────────────────────────────────────
const pblSections: SectionDef<GcpPblRequest>[] = [
  {
    title: 'Procurement',
    icon: ClipboardList,
    fields: [
      {
        label: 'Procurement Method',
        kind: 'choice',
        choices: procurementMethodChoices,
        get: (r) => r.procurementMethod,
      },
      { label: 'Project Code', get: (r) => r.projectCode },
    ],
  },
];

// ── JVP — JV / Partnership ──────────────────────────────────────────────────
const jvpSections: SectionDef<GcpJvpRequest>[] = [
  {
    title: 'Persons In Charge (PIC)',
    icon: Users,
    fields: [
      { label: 'Team Lead', get: (r) => r.picTeamLeader },
      { label: 'Financial Matters', get: (r) => r.picFinancialMatters },
      { label: 'Technical Matters', get: (r) => r.picTechnicalMatters },
      { label: 'Contract Matters', get: (r) => r.picContractMatters },
      { label: 'Procurement Matters', get: (r) => r.picProcurementMatters },
      { label: 'Costing Estimation', get: (r) => r.picCostingEstimation },
      { label: 'Implementation Stage', get: (r) => r.picImplementationStage },
    ],
  },
  {
    title: 'Collaboration',
    icon: Handshake,
    fields: [
      { label: 'Background of Collaboration', kind: 'structured', get: (r) => r.backgroundOfCollaboration },
      { label: 'Scope of Collaboration', kind: 'structured', get: (r) => r.scopeOfCollaboration },
      { label: 'Proposed Structure', kind: 'structured', get: (r) => r.proposedStructure },
    ],
  },
  {
    title: 'Key Terms & Financials',
    icon: Banknote,
    fields: [
      { label: 'Key Terms', kind: 'structured', get: (r) => r.keyTerms },
      { label: 'Financial Overview', kind: 'structured', get: (r) => r.financialOverview },
      {
        label: 'Technical Capabilities & Resources',
        kind: 'structured',
        get: (r) => r.technicalCapabilitiesResources,
      },
    ],
  },
  {
    title: 'Work Packages, Resourcing & Risk',
    icon: Layers,
    fields: [
      {
        label: 'Work Packages / Division of Responsibilities',
        kind: 'structured',
        get: (r) => r.workPackagesDivisionOfResponsibilities,
      },
      { label: 'Resource Contribution', kind: 'structured', get: (r) => r.resourceContribution },
      { label: 'Risk Review & Mitigation', kind: 'structured', get: (r) => r.riskReviewMitigation },
    ],
  },
];

// ── ST/SP — Submission of Tender / Proposal ─────────────────────────────────
const stspSections: SectionDef<GcpStspRequest>[] = [
  {
    title: 'Project Details',
    icon: CalendarClock,
    fields: [
      {
        label: 'Tender / Proposal Submission Date',
        kind: 'datetime',
        get: (r) => r.tenderProposalSubmissionDate,
      },
      { label: 'Tender Validity Period (Days)', get: (r) => r.tenderValidityPeriod },
    ],
  },
  {
    title: 'Persons In Charge (PIC)',
    icon: Users,
    fields: [
      { label: 'Team Leader', get: (r) => r.teamLeader },
      { label: 'Financial Matters', get: (r) => r.financialMatters },
      { label: 'Technical Matters', get: (r) => r.technicalMatters },
      { label: 'Contract Matters', get: (r) => r.contractMatters },
      { label: 'Procurement Matters', get: (r) => r.procurementMatters },
      { label: 'Costing & Estimation Matters', get: (r) => r.costingAndEstimationMatters },
      { label: 'Implementation Stage', get: (r) => r.implementationStage },
    ],
  },
  {
    title: 'Submission Information',
    icon: ScrollText,
    fields: [
      { label: 'Background of Matters for Review', kind: 'multiline', get: (r) => r.backgroundReview },
      { label: 'Scope of Works', kind: 'multiline', get: (r) => r.scopeOfWorks },
      { label: 'Key Terms', kind: 'multiline', get: (r) => r.keyTerms },
      { label: 'Financial', kind: 'structured', get: (r) => r.financials },
      { label: 'Technical (Competency, Specification & Delivery)', kind: 'multiline', get: (r) => r.technical },
      {
        label: 'Procurement Strategy & Work Packages',
        kind: 'multiline',
        get: (r) => r.procurementStrategyWorkPackages,
      },
      { label: 'Sourcing Reference', kind: 'multiline', get: (r) => r.sourcingReference },
      { label: 'Cost Breakdown', kind: 'multiline', get: (r) => r.costBreakdown },
      {
        label: 'Risk Identification & Mitigation Plan',
        kind: 'structured',
        get: (r) => r.riskIdentificationMitigationPlan,
      },
    ],
  },
];

// ── CAA — Client Acceptance of Award ────────────────────────────────────────
const caaSections: SectionDef<GcpCaaRequest>[] = [
  {
    title: 'Cost Information',
    icon: Banknote,
    fields: [
      { label: 'Tender / Proposal Price', kind: 'currency', get: (r) => r.tenderProposalPrice },
      { label: 'Final Contract Amount', kind: 'currency', get: (r) => r.finalContractAmount },
      { label: 'Estimated Budget Cost', kind: 'currency', get: (r) => r.estimatedBudgetCost },
      { label: 'Estimated Margin', kind: 'percent', get: (r) => r.estimatedMargin },
      { label: 'Tender / Proposal Ref. No.', get: (r) => r.tenderProposalRefNo },
      { label: 'Letter of Award (LOA) Date', kind: 'date', get: (r) => r.letterOfAwardDate },
      { label: 'Contract Commencement Date', kind: 'date', get: (r) => r.contractCommencementDate },
      { label: 'Contract Completion Date', kind: 'date', get: (r) => r.contractCompletionDate },
      { label: 'Contract Period (days)', kind: 'number', get: (r) => r.contractPeriodDays },
    ],
  },
  {
    title: 'Contract & Compliance',
    icon: FileSignature,
    fields: [
      { label: 'Performance Bond (PB)', get: (r) => r.performanceBond },
      { label: 'Stamp Duty (incl. legal fees)', kind: 'number', get: (r) => r.stampDuty },
      { label: 'Insurance', get: (r) => r.insurance },
      { label: 'Bumiputera Participation', get: (r) => r.bumiputeraParticipation },
      { label: 'Formation of JV Company', get: (r) => r.formationOfJvCompany },
      { label: 'Critical Activities & Milestones', get: (r) => r.criticalActivitiesMilestones },
      { label: 'Defect Liability Period (DLP)', get: (r) => r.defectLiabilityPeriod },
    ],
  },
  {
    title: 'Contract Terms',
    icon: ScrollText,
    fields: [
      { label: 'Liquidated Damages (LAD/day) Rate', kind: 'number', get: (r) => r.liquidatedDamagesRate },
      { label: 'Payment Term', get: (r) => r.paymentTerm },
      { label: 'Type of Contract', get: (r) => r.typeOfContract },
      { label: 'Form / Condition of Contract', get: (r) => r.formOfContract },
      { label: 'Project Director (PD)', get: (r) => r.projectDirector },
      { label: 'Contact Person at Site', get: (r) => r.contactPersonAtSite },
    ],
  },
  {
    title: 'Claims & Change Management',
    icon: ListChecks,
    fields: [
      { label: 'Claim Application Process', kind: 'structured', get: (r) => r.claimApplicationProcess },
      { label: 'Claim Certification Process', kind: 'structured', get: (r) => r.claimCertificationProcess },
      {
        label: 'Variation Order Application Process',
        kind: 'structured',
        get: (r) => r.variationOrderApplicationProcess,
      },
      {
        label: 'Extension of Time Application Process',
        kind: 'structured',
        get: (r) => r.extensionOfTimeApplicationProcess,
      },
      {
        label: 'Commissioning & Completion Management Systems',
        kind: 'structured',
        get: (r) => r.commissioningCompletionSystems,
      },
      { label: 'Key Delivery Milestone', kind: 'structured', get: (r) => r.keyDeliveryMilestone },
    ],
  },
  {
    title: 'Completion & Handover',
    icon: PackageCheck,
    fields: [
      { label: 'Mandatory Testing to Commission', kind: 'structured', get: (r) => r.mandatoryTesting },
      {
        label: 'Documents for Contractual Acceptance (CPC)',
        kind: 'structured',
        get: (r) => r.documentForContractualAcceptance,
      },
      {
        label: 'Pre-requisite Documents for DLP Completion',
        kind: 'structured',
        get: (r) => r.prerequisiteDocumentsForDlp,
      },
      { label: 'Acknowledged', kind: 'boolean', get: (r) => r.acknowledged },
    ],
  },
];

// ── PCCA — Project Cost & Construction Analysis ─────────────────────────────
const pccaSections: SectionDef<GcpPccaRequest>[] = [
  {
    title: 'Cost Information',
    icon: ClipboardList,
    fields: [
      {
        label: 'Price / Revenue (from Contract BQ)',
        kind: 'structured',
        get: (r) => r.priceRevenueFromContractBq,
      },
      {
        label: 'Cost (from Contract BQ)',
        kind: 'structured',
        get: (r) => r.costFromContractBq,
      },
    ],
  },
  {
    title: 'Cost Summary',
    icon: Banknote,
    fields: [
      { label: 'Total Revenue (RM)', kind: 'currency', get: (r) => r.totalRevenue },
      { label: 'Total Cost (RM)', kind: 'currency', get: (r) => r.totalCost },
      { label: 'Construction Cost (RM)', kind: 'currency', get: (r) => r.constructionCost },
      { label: 'Internal Cost', kind: 'currency', get: (r) => r.internalCost },
      { label: 'Remarks', kind: 'multiline', get: (r) => r.remarks },
    ],
  },
];

// ── Others — "Others Form" (GCPC) & "GCP - Others" (GCP) ────────────────────
const otherSections: SectionDef<GcpOtherRequest>[] = [
  {
    title: 'Matter Details',
    icon: ScrollText,
    fields: [
      {
        label: 'Description of Matter',
        kind: 'multiline',
        get: (r) => r.descriptionOfMatters,
      },
    ],
  },
];

// ── RPCCA — Revised PCCA ────────────────────────────────────────────────────
const rpccaSections: SectionDef<GcpRpccaRequest>[] = [
  {
    title: 'Work Items',
    icon: ListChecks,
    fields: [
      { label: 'Work Item Entry', kind: 'structured', get: (r) => r.workItemEntry },
      { label: 'Remarks', kind: 'multiline', get: (r) => r.remarks },
    ],
  },
];

// ── CI — Contractual Issue Relating to Payment ──────────────────────────────
const ciSections: SectionDef<GcpCiRequest>[] = [
  {
    title: 'Issue Details',
    icon: ClipboardList,
    fields: [
      {
        label: 'Company Role in this Issue',
        kind: 'choice',
        choices: companyRoleInIssueChoices,
        get: (r) => r.companyRole,
      },
      { label: 'Category', get: (r) => r.category },
    ],
  },
  {
    title: 'VO / EOT / L&E Information',
    icon: ScrollText,
    fields: [
      { label: 'Contract Clause', get: (r) => r.contractClause },
      { label: 'Chronology of Event', kind: 'multiline', get: (r) => r.chronologyOfEventVo },
      { label: 'Brief of Issues', kind: 'multiline', get: (r) => r.briefOfIssuesVo },
      { label: 'Time and Cost Impact', kind: 'multiline', get: (r) => r.timeAndCostImpactVo },
      {
        label: 'Advisory Required from GCP',
        kind: 'multiline',
        get: (r) => r.advisoryRequiredVo,
      },
    ],
  },
  {
    title: 'Payments Information',
    icon: Banknote,
    fields: [
      { label: 'Contract Clause (Payment)', get: (r) => r.contractClausePayment },
      {
        label: 'Brief of Issues (Payments)',
        kind: 'multiline',
        get: (r) => r.briefOfIssuesPayments,
      },
      {
        label: 'Chronology of Event (Payments)',
        kind: 'multiline',
        get: (r) => r.chronologyOfEventPayments,
      },
      {
        label: 'Advisory Required from GCP (Payments)',
        kind: 'multiline',
        get: (r) => r.advisoryRequiredPayments,
      },
    ],
  },
];

// ── CPR — Contract Progress Report ──────────────────────────────────────────
const cprSections: SectionDef<GcpCprRequest>[] = [
  {
    title: 'EOT Information',
    icon: CalendarClock,
    fields: [
      { label: 'EOT Latest No.', get: (r) => r.eotLatestNo },
      { label: 'EOT Latest Date', kind: 'date', get: (r) => r.eotLatestDate },
      { label: 'EOT New Application Date', kind: 'date', get: (r) => r.eotNewApplicationDate },
      { label: 'EOT New Completion Date', kind: 'date', get: (r) => r.eotNewCompletionDate },
      {
        label: 'Status of New EOT Application',
        kind: 'choice',
        choices: cprApplicationStatusChoices,
        get: (r) => r.eotStatus,
      },
      { label: 'EOT New Justifications', kind: 'multiline', get: (r) => r.eotNewJustifications },
    ],
  },
  {
    title: 'VO Information',
    icon: Layers,
    fields: [
      { label: 'VO Latest No.', get: (r) => r.voLatestNo },
      {
        label: 'Latest Approved VO Cumulative Amount',
        kind: 'currency',
        get: (r) => r.voLatestApprovedCumulativeAmount,
      },
      { label: 'New VO Application Amount', kind: 'currency', get: (r) => r.voNewApplicationAmount },
      { label: 'VO New Application No.', get: (r) => r.voNewApplicationNo },
      { label: 'VO New Application Date', kind: 'date', get: (r) => r.voNewApplicationDate },
      {
        label: 'Status of New VO Application',
        kind: 'choice',
        choices: cprApplicationStatusChoices,
        get: (r) => r.voStatus,
      },
      { label: 'VO New Justification', kind: 'multiline', get: (r) => r.voNewJustification },
    ],
  },
  {
    title: 'Claims to Client',
    icon: Banknote,
    fields: [
      {
        label: 'Cumulative Claim Application Amount to Date',
        kind: 'currency',
        get: (r) => r.cumulativeClaimApplicationAmount,
      },
      {
        label: 'Cumulative Claim Certified Amount to Date',
        kind: 'currency',
        get: (r) => r.cumulativeClaimCertifiedAmount,
      },
      {
        label: 'Pending Certified Amount to Date',
        kind: 'currency',
        get: (r) => r.pendingCertifiedAmount,
      },
      {
        label: 'No. of Claims for Pending Certified Amount',
        kind: 'number',
        get: (r) => r.noOfClaimsForPendingCertified,
      },
      { label: 'New Net Certified Amount', kind: 'currency', get: (r) => r.newNetCertifiedAmount },
      {
        label: 'Date of Claim Pending Certified Amount',
        kind: 'date',
        get: (r) => r.dateOfClaimPendingCertified,
      },
    ],
  },
];

export {
  rtpSections,
  pblSections,
  jvpSections,
  stspSections,
  caaSections,
  pccaSections,
  otherSections,
  rpccaSections,
  ciSections,
  cprSections,
};
