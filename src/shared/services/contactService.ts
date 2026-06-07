// src/shared/services/contactService.ts
// Read-only service for the Dataverse `contact` system table.
// Used to resolve the logged-in portal user's contact GUID for lookup binding.

import {
  powerPagesFetch,
  buildODataQuery,
  combinePrefer,
  escapeODataString,
  includeFormattedValues,
  pageSizeHeader,
} from '../powerPagesApi';
import type { ODataListResponse } from '../powerPagesApi';
import {
  CONTACT_SELECT,
  mapContact,
  type Contact,
  type ContactEntity,
} from '../../types/contact';

const ENTITY_SET = 'contacts';
const API_BASE = `/_api/${ENTITY_SET}`;

/** Fetch a single contact by GUID. Returns null if not found. */
export async function getContactById(contactId: string): Promise<Contact | null> {
  const qs = buildODataQuery({ select: CONTACT_SELECT });
  try {
    const entity = await powerPagesFetch<ContactEntity>(
      `${API_BASE}(${contactId})${qs}`
    );
    return entity ? mapContact(entity) : null;
  } catch (err) {
    // Treat 404 as "not found" rather than a hard failure.
    if ((err as { status?: number })?.status === 404) return null;
    throw err;
  }
}

/** Lookup a single contact by email. Returns null if no match. */
export async function getContactByEmail(email: string): Promise<Contact | null> {
  const trimmed = email.trim();
  if (!trimmed) return null;
  const filter = `emailaddress1 eq '${escapeODataString(trimmed)}'`;
  const qs = buildODataQuery({
    select: CONTACT_SELECT,
    filter,
    top: 1,
    count: true,
  });
  const res = await powerPagesFetch<ODataListResponse<ContactEntity>>(
    `${API_BASE}${qs}`,
    {
      headers: combinePrefer(pageSizeHeader(1), includeFormattedValues()),
    }
  );
  const first = res?.value?.[0];
  return first ? mapContact(first) : null;
}

export interface ListContactsArgs {
  filter?: string;
  top?: number;
}

/** Paginated contact list (admin use). Defaults to maxpagesize 20. */
export async function listContacts(
  args: ListContactsArgs = {}
): Promise<{ items: Contact[]; totalCount?: number; nextLink?: string }> {
  const pageSize = args.top ?? 20;
  const qs = buildODataQuery({
    select: CONTACT_SELECT,
    filter: args.filter,
    orderby: 'fullname asc',
    count: true,
  });
  const res = await powerPagesFetch<ODataListResponse<ContactEntity>>(
    `${API_BASE}${qs}`,
    { headers: pageSizeHeader(pageSize) }
  );
  return {
    items: (res?.value ?? []).map(mapContact),
    totalCount: res?.['@odata.count'],
    nextLink: res?.['@odata.nextLink'],
  };
}
