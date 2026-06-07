// Signatory group management via the custom `gcp_signatorymember1` table.
//
// Each row represents one group membership — a person in both Prepared AND
// Confirmed will have two rows (same name/email, different gcp_group values).
// gcp_group choice values: Prepared = 1, Confirmed = 2.

import { dvGet, dvPost, dvPatch, dvDelete } from './dataverseClient.js';
import { assertGuid } from './webRoles.js';

export interface SignatoryMemberDto {
  id: string;
  group: 'prepared' | 'confirmed';
  name: string;
  email: string;
  sortOrder: number;
}

interface ODataList<T> {
  value: T[];
}

interface SignatoryRow {
  gcp_signatorymember1id: string;
  gcp_name?: string | null;
  gcp_email?: string | null;
  gcp_group?: number | null;
  gcp_sortorder?: number | null;
}

const ENTITY_SET = 'gcp_signatorymember1s';

const VALUE_GROUP: Record<number, 'prepared' | 'confirmed'> = {
  1: 'prepared',
  2: 'confirmed',
};

const GROUP_VALUE: Record<'prepared' | 'confirmed', number> = {
  prepared: 1,
  confirmed: 2,
};

/** All signatory members, ordered by group then sort order then name. */
export const listSignatoryMembers = async (): Promise<SignatoryMemberDto[]> => {
  const data = await dvGet<ODataList<SignatoryRow>>(
    `${ENTITY_SET}?$select=gcp_signatorymember1id,gcp_name,gcp_email,gcp_group,gcp_sortorder` +
      `&$orderby=gcp_group asc,gcp_sortorder asc,gcp_name asc`
  );
  return data.value
    .filter((r) => r.gcp_group != null && r.gcp_group in VALUE_GROUP)
    .map((r) => ({
      id: r.gcp_signatorymember1id,
      group: VALUE_GROUP[r.gcp_group!],
      name: r.gcp_name ?? '',
      email: r.gcp_email ?? '',
      sortOrder: r.gcp_sortorder ?? 0,
    }));
};

/** Add a new signatory member row. */
export const addSignatoryMember = async (input: {
  name: string;
  email: string;
  group: 'prepared' | 'confirmed';
  sortOrder?: number;
}): Promise<void> => {
  await dvPost(ENTITY_SET, {
    gcp_name: input.name.trim(),
    gcp_email: input.email.trim(),
    gcp_group: GROUP_VALUE[input.group],
    gcp_sortorder: input.sortOrder ?? 0,
  });
};

/** Delete a signatory member row by its record GUID. */
export const removeSignatoryMember = async (id: string): Promise<void> => {
  assertGuid(id, 'id');
  await dvDelete(`${ENTITY_SET}(${id})`);
};

export interface SignatoryThresholds {
  preparedCount: number;
  confirmCount: number;
}

interface ThresholdRow {
  gcp_signatorymember1id: string;
  gcp_preparedcount?: number | null;
  gcp_confirmcount?: number | null;
}

// Sentinel record: gcp_group is null so it's excluded from listSignatoryMembers.
const THRESHOLD_FILTER = 'gcp_group eq null';

/** Read the global signature thresholds. Returns defaults (1/2) if no config record exists. */
export const getThresholds = async (): Promise<SignatoryThresholds> => {
  const data = await dvGet<ODataList<ThresholdRow>>(
    `${ENTITY_SET}?$select=gcp_signatorymember1id,gcp_preparedcount,gcp_confirmcount&$filter=${THRESHOLD_FILTER}&$top=1`
  );
  const row = data.value[0];
  return {
    preparedCount: row?.gcp_preparedcount ?? 1,
    confirmCount: row?.gcp_confirmcount ?? 2,
  };
};

/** Upsert the global signature thresholds (creates sentinel record if absent). */
export const setThresholds = async (
  preparedCount: number,
  confirmCount: number
): Promise<void> => {
  const data = await dvGet<ODataList<ThresholdRow>>(
    `${ENTITY_SET}?$select=gcp_signatorymember1id&$filter=${THRESHOLD_FILTER}&$top=1`
  );
  const existing = data.value[0];
  if (existing) {
    await dvPatch(`${ENTITY_SET}(${existing.gcp_signatorymember1id})`, {
      gcp_preparedcount: preparedCount,
      gcp_confirmcount: confirmCount,
    });
  } else {
    await dvPost(ENTITY_SET, {
      gcp_preparedcount: preparedCount,
      gcp_confirmcount: confirmCount,
    });
  }
};
