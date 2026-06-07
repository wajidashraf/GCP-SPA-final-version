import type { DataverseChoice } from './types';

const projectStatusChoices = [
  { label: 'Inactive', value: 0 },
  { label: 'Active', value: 1 },
  { label: 'Completed', value: 2 },
  { label: 'Dead', value: 3 },
] as const satisfies readonly DataverseChoice[];

const sectorChoices = [
  { label: 'Utility', value: 1 },
  { label: 'Construction', value: 2 },
  { label: 'Hospital', value: 3 },
  { label: 'Services', value: 4 },
  { label: 'IT', value: 5 },
  { label: 'Property', value: 6 },
  { label: 'GCEO Office', value: 7 },
] as const satisfies readonly DataverseChoice[];

type ProjectStatusValue = (typeof projectStatusChoices)[number]['value'];
type SectorValue = (typeof sectorChoices)[number]['value'];

export { projectStatusChoices, sectorChoices };
export type { ProjectStatusValue, SectorValue };
