import type { SelectOption } from '../forms/types';

// gcp_category on gcp_requestcigcp is a free TEXT column (nvarchar), not a
// Dataverse choice set — the UI constrains it to these three values and stores
// the label string verbatim. Hence plain SelectOption[] (string value), NOT a
// numeric DataverseChoice list.
const ciCategoryOptions: SelectOption[] = [
  { label: 'VARIATION ORDER (VO)', value: 'VARIATION ORDER (VO)' },
  { label: 'EXTENSION OF TIME (EOT)', value: 'EXTENSION OF TIME (EOT)' },
  { label: 'LOSS & EXPENSE (L&E)', value: 'LOSS & EXPENSE (L&E)' },
];

export { ciCategoryOptions };
