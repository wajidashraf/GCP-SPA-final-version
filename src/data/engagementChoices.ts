import type { DataverseChoice } from './types';
import type { SelectOption } from './types';

// gcp_engagements.gcp_engagementtype — Dataverse choice.
const engagementTypeChoices = [
  { label: 'In-Person', value: 1 },
  { label: 'Virtual', value: 2 },
] as const satisfies readonly DataverseChoice[];

// gcp_engagements.gcp_engagementstatus — Dataverse choice.
const engagementStatusChoices = [
  { label: 'Cancelled', value: 0 },
  { label: 'Scheduled', value: 1 },
  { label: 'Completed', value: 2 },
] as const satisfies readonly DataverseChoice[];

/** Convenience constants for the engagement lifecycle. */
const ENGAGEMENT_TYPE_PHYSICAL = 1 as const;
const ENGAGEMENT_TYPE_VIRTUAL = 2 as const;
const ENGAGEMENT_STATUS_CANCELLED = 0 as const;
const ENGAGEMENT_STATUS_SCHEDULED = 1 as const;
const ENGAGEMENT_STATUS_COMPLETED = 2 as const;

// UI-only (NOT a Dataverse choice): suggested meeting locations for in-person
// engagements. `gcp_location` is a free-text column; "OTHER" reveals a manual
// entry box. Kept here rather than inlined per the no-inline-options rule.
const OTHER_LOCATION_VALUE = 'OTHER';
const engagementLocationOptions: readonly SelectOption[] = [
  { label: 'O3CS Meeting Room', value: 'O3CS Meeting Room' },
  { label: 'Hyrangea Meeting Room', value: 'Hyrangea Meeting Room' },
  { label: 'Petunia Meeting Room', value: 'Petunia Meeting Room' },
  { label: 'Other (enter manually)', value: OTHER_LOCATION_VALUE },
];

type EngagementTypeValue = (typeof engagementTypeChoices)[number]['value'];
type EngagementStatusValue = (typeof engagementStatusChoices)[number]['value'];

export {
  engagementTypeChoices,
  engagementStatusChoices,
  engagementLocationOptions,
  OTHER_LOCATION_VALUE,
  ENGAGEMENT_TYPE_PHYSICAL,
  ENGAGEMENT_TYPE_VIRTUAL,
  ENGAGEMENT_STATUS_CANCELLED,
  ENGAGEMENT_STATUS_SCHEDULED,
  ENGAGEMENT_STATUS_COMPLETED,
};
export type { EngagementTypeValue, EngagementStatusValue };
