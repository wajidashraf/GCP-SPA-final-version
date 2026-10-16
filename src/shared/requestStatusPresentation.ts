import { requestStatusChoices } from '../data/requestChoices.ts';
import { getChoiceLabel, toSelectOptions } from '../data/types.ts';
import type { RequestStatusValue } from '../data/requestChoices.ts';

export type RequestStatusSnapshot = { id: string; status: RequestStatusValue | null };

/** Refresh before filters/paging so a newly booked request enters Booked and
 * leaves Ready for Engagement. Missing/deauthorized records are not retained. */
export const refreshRequestListStatuses = async <T extends RequestStatusSnapshot>(
  requests: T[], load: (ids: string[]) => Promise<RequestStatusSnapshot[]>,
): Promise<T[]> => {
  if (!requests.length) return requests;
  const fresh = new Map<string, RequestStatusValue | null>();
  const ids = [...new Set(requests.map(request => request.id.toLowerCase()))];
  for (let offset = 0; offset < ids.length; offset += 100) {
    for (const snapshot of await load(ids.slice(offset, offset + 100))) fresh.set(snapshot.id.toLowerCase(), snapshot.status);
  }
  return requests.filter(request => fresh.has(request.id.toLowerCase()))
    .map(request => ({ ...request, status: fresh.get(request.id.toLowerCase())! }));
};

// Presentation only: workflow comparisons keep using the canonical choices.
const statusDisplayLabels: Readonly<Record<string, string>> = {
  FR: 'For Record (FR)',
  R: 'Booked (R)',
  'Pending Ack': 'Pending Acknowledgement',
  ACK: 'Acknowledged (ACK)',
  'Pending Endorse': 'Pending Endorsement',
  E: 'Endorsed (E)',
  RS: 'Re-Submit (RS)',
  NC3: 'Non-compliant (NC3)',
  NC4: 'Non-compliant (NC4)',
  W: 'Waived (W)',
};

export const getRequestStatusDisplayLabel = (
  status: number | null | undefined,
): string => {
  if (status == null) return '\u2014';
  const label = getChoiceLabel(requestStatusChoices, status);
  return label ? statusDisplayLabels[label] ?? label : '\u2014';
};

export const requestStatusFilterOptions = toSelectOptions(requestStatusChoices).map(
  (option) => ({
    ...option,
    label: getRequestStatusDisplayLabel(Number(option.value)),
  }),
);
