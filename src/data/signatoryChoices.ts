import type { DataverseChoice } from './types';

const signatoryGroupChoices = [
  { label: 'Prepared', value: 1 },
  { label: 'Confirmed', value: 2 },
] as const satisfies readonly DataverseChoice[];

type SignatoryGroupValue = (typeof signatoryGroupChoices)[number]['value'];

export { signatoryGroupChoices };
export type { SignatoryGroupValue };
