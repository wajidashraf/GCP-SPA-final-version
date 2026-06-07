import type { DataverseChoice } from './types';

const companyCodeChoices = [
  { label: 'US01', value: 1 },
  { label: 'US02', value: 2 },
  { label: 'US03', value: 3 },
  { label: 'US04', value: 4 },
  { label: 'CNS01', value: 5 },
  { label: 'CNS02', value: 6 },
  { label: 'HSS01', value: 7 },
  { label: 'SS01', value: 8 },
  { label: 'SS02', value: 9 },
  { label: 'SS03', value: 10 },
  { label: 'HIM01', value: 11 },
  { label: 'PRO01', value: 12 },
  { label: 'PRO02', value: 13 },
  { label: 'PRO03', value: 14 },
  { label: 'PRO04', value: 15 },
  { label: 'GCEO', value: 16 },
] as const satisfies readonly DataverseChoice[];

const companyRoleInIssueChoices = [
  { label: 'Client Developer / Project Owner', value: 1 },
  { label: 'DB Contractor / Main Contractor Tier1', value: 2 },
  { label: 'Subcontractor Tier 2 and below 2', value: 3 },
] as const satisfies readonly DataverseChoice[];

type CompanyCodeValue = (typeof companyCodeChoices)[number]['value'];
type CompanyRoleInIssueValue =
  (typeof companyRoleInIssueChoices)[number]['value'];

export { companyCodeChoices, companyRoleInIssueChoices };
export type { CompanyCodeValue, CompanyRoleInIssueValue };
