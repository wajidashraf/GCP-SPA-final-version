import type { DataverseChoice } from './types';

const decisionCodeChoices = [
  { label: 'Code 1', value: 1 },
  { label: 'Code 2', value: 2 },
  { label: 'Code 3', value: 3 },
  { label: 'Code 4', value: 4 },
  { label: 'W', value: 5 },
] as const satisfies readonly DataverseChoice[];

// UI copy (NOT Dataverse values): full descriptions shown beside each decision
// code on the reviewer Review Request screen. Keyed by the choice `value`.
const decisionCodeDescriptions: Record<number, string> = {
  1: 'Proceed with acceptance of review.',
  2: 'Resubmit for review, critical information missing.',
  3: 'No submission for review. Non-compliance.',
  4: 'Exempted for review and approved by Main GCPC (signed letter as attached).',
  5: 'Waived for review. Company attached signed Waiver Form from Group CEO.',
};

const outcomeChoices = [
  { label: 'FR', value: 0 },
  { label: 'FA', value: 1 },
  { label: 'ACK', value: 2 },
  { label: 'E', value: 3 },
  { label: 'RS', value: 4 },
  { label: 'NC', value: 5 },
  { label: 'NC3', value: 6 },
  { label: 'NC4', value: 7 },
  { label: 'W', value: 8 },
] as const satisfies readonly DataverseChoice[];

const procurementMethodChoices = [
  { label: 'Selective Trending', value: 0 },
  { label: 'Direct Negotiation', value: 1 },
] as const satisfies readonly DataverseChoice[];

const registrationTypeChoices = [
  { label: 'Tender List', value: 1 },
  { label: 'Proposal list', value: 2 },
] as const satisfies readonly DataverseChoice[];

const requestCategoryChoices = [
  { label: 'GCP', value: 1 },
  { label: 'GCPC', value: 2 },
] as const satisfies readonly DataverseChoice[];

const requestStatusChoices = [
  { label: 'FR', value: 0 },
  { label: 'New', value: 1 },
  { label: 'Ready for Engagement', value: 2 },
  { label: 'R', value: 3 },
  { label: 'Draft Review', value: 4 },
  { label: 'Pending Review', value: 5 },
  { label: 'Complete Review', value: 6 },
  { label: 'Pending Acceptance', value: 7 },
  { label: 'Complete Acceptance', value: 8 },
  { label: 'Pending Ack', value: 9 },
  { label: 'ACK', value: 10 },
  { label: 'Pending Endorse', value: 11 },
  { label: 'E', value: 12 },
  { label: 'Submitted', value: 13 },
  { label: 'Under Verification', value: 14 },
  { label: 'Scheduled', value: 15 },
  { label: 'RS', value: 16 },
  { label: 'NC3', value: 17 },
  { label: 'NC4', value: 18 },
  { label: 'W', value: 19 },
] as const satisfies readonly DataverseChoice[];

type DecisionCodeValue = (typeof decisionCodeChoices)[number]['value'];
type OutcomeValue = (typeof outcomeChoices)[number]['value'];
type ProcurementMethodValue =
  (typeof procurementMethodChoices)[number]['value'];
type RegistrationTypeValue = (typeof registrationTypeChoices)[number]['value'];
type RequestCategoryValue = (typeof requestCategoryChoices)[number]['value'];
type RequestStatusValue = (typeof requestStatusChoices)[number]['value'];

export {
  decisionCodeChoices,
  decisionCodeDescriptions,
  outcomeChoices,
  procurementMethodChoices,
  registrationTypeChoices,
  requestCategoryChoices,
  requestStatusChoices,
};
export type {
  DecisionCodeValue,
  OutcomeValue,
  ProcurementMethodValue,
  RegistrationTypeValue,
  RequestCategoryValue,
  RequestStatusValue,
};
