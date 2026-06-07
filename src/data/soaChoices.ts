import type { DataverseChoice } from './types';

const soaCodeChoices = [
  { label: 'RTP', value: 1 },
  { label: 'PBL', value: 2 },
  { label: 'JVP', value: 3 },
  { label: 'ST/SP', value: 4 },
  { label: 'CAA', value: 5 },
  { label: 'PCCA', value: 6 },
  { label: 'PP', value: 7 },
  { label: 'VAP', value: 8 },
  { label: 'GCPC - Others Form', value: 9 },
  { label: 'Revised PCCA', value: 10 },
  { label: 'CI', value: 11 },
  { label: 'CPR', value: 12 },
  { label: 'GCP - Others Form', value: 13 },
  { label: 'Revised PP', value: 14 },
] as const satisfies readonly DataverseChoice[];

type SoaCodeValue = (typeof soaCodeChoices)[number]['value'];

export { soaCodeChoices };
export type { SoaCodeValue };
