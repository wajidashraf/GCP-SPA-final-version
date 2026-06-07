import type { DataverseChoice } from './types';

// Global option set `gcp_cprapplicationstatuschoices`, used by both
// gcp_statusofneweotapplication and gcp_statusofnewvoapplication on
// gcp_cprrequestgcp. Dataverse labels are "active" / "Inactive".
const cprApplicationStatusChoices = [
  { label: 'Active', value: 1 },
  { label: 'Inactive', value: 2 },
] as const satisfies readonly DataverseChoice[];

type CprApplicationStatusValue =
  (typeof cprApplicationStatusChoices)[number]['value'];

export { cprApplicationStatusChoices };
export type { CprApplicationStatusValue };
