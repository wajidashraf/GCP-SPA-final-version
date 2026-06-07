// Web-role data access against the Dataverse Web API.
//
// A "web role" is a Dataverse record (mspp_webrole / adx_webrole) and assigning
// one to a user is writing the N:N relationship between `contact` and the web
// role table. All table/relationship logical names come from RoleConfig so an
// environment on the classic adx_* schema can be supported by config alone.

import { dvGet, dvPost, dvDelete, dataverseUrl, DataverseError } from './dataverseClient.js';
import { getRoleConfig } from '../config.js';

export interface WebRoleDto {
  id: string;
  name: string;
}

interface ODataList<T> {
  value: T[];
}

const escapeOData = (value: string): string => value.replace(/'/g, "''");

// Guard against path injection — Dataverse keys are GUIDs.
const GUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const assertGuid = (value: string, label: string): string => {
  if (!GUID_RE.test(value)) {
    throw new DataverseError(`Invalid ${label}: expected a GUID`, 400);
  }
  return value;
};

/** All web roles in the environment, ordered by name. */
export const listWebRoles = async (): Promise<WebRoleDto[]> => {
  const cfg = getRoleConfig();
  const filter = cfg.webRoleListFilter
    ? `&$filter=${encodeURIComponent(cfg.webRoleListFilter)}`
    : '';
  const data = await dvGet<ODataList<Record<string, unknown>>>(
    `${cfg.webRoleEntitySet}?$select=${cfg.webRoleIdAttr},${cfg.webRoleNameAttr}` +
      `&$orderby=${cfg.webRoleNameAttr} asc${filter}`
  );
  return data.value.map((r) => ({
    id: String(r[cfg.webRoleIdAttr] ?? ''),
    name: String(r[cfg.webRoleNameAttr] ?? ''),
  }));
};

/** Web roles currently assigned to a contact. */
export const getContactWebRoles = async (contactId: string): Promise<WebRoleDto[]> => {
  const cfg = getRoleConfig();
  assertGuid(contactId, 'contactId');
  const data = await dvGet<{ value: Array<Record<string, unknown>> }>(
    `contacts(${contactId})/${cfg.webRoleContactNav}?$select=${cfg.webRoleIdAttr},${cfg.webRoleNameAttr}`
  );
  return data.value.map((r) => ({
    id: String(r[cfg.webRoleIdAttr] ?? ''),
    name: String(r[cfg.webRoleNameAttr] ?? ''),
  }));
};

export interface ContactEmailDto {
  contactId: string;
  email: string;
  name: string;
}

/**
 * Active contacts holding a given web role, with their email. Filters contacts
 * by the same N:N navigation property used elsewhere (`webRoleContactNav`) via
 * an OData any() lambda — no reverse-navigation guesswork, and it tracks the
 * same config that `getContactWebRoles` / `isAdminByEmail` already rely on.
 */
export const getContactsInWebRole = async (
  roleName: string
): Promise<ContactEmailDto[]> => {
  const cfg = getRoleConfig();
  const safe = escapeOData(roleName);
  const data = await dvGet<ODataList<Record<string, unknown>>>(
    `contacts?$select=contactid,emailaddress1,fullname` +
      `&$filter=statecode eq 0 and ` +
      `${cfg.webRoleContactNav}/any(r:r/${cfg.webRoleNameAttr} eq '${safe}')`
  );
  return data.value
    .map((c) => ({
      contactId: String(c.contactid ?? ''),
      email: String(c.emailaddress1 ?? '').trim().toLowerCase(),
      name: String(c.fullname ?? '').trim(),
    }))
    .filter((c) => c.email !== '');
};

/** Assign a web role to a contact (associate the N:N relationship). */
export const assignWebRole = async (contactId: string, webRoleId: string): Promise<void> => {
  const cfg = getRoleConfig();
  assertGuid(contactId, 'contactId');
  assertGuid(webRoleId, 'webRoleId');
  await dvPost(`contacts(${contactId})/${cfg.webRoleContactNav}/$ref`, {
    '@odata.id': dataverseUrl(`${cfg.webRoleEntitySet}(${webRoleId})`),
  });
};

/** Remove a web role from a contact (disassociate the N:N relationship). */
export const unassignWebRole = async (contactId: string, webRoleId: string): Promise<void> => {
  const cfg = getRoleConfig();
  assertGuid(contactId, 'contactId');
  assertGuid(webRoleId, 'webRoleId');
  await dvDelete(`contacts(${contactId})/${cfg.webRoleContactNav}(${webRoleId})/$ref`);
};

/**
 * Returns true if the contact identified by `contactId` holds the admin web
 * role. Preferred over {@link isAdminByEmail}: the Power Pages portal token
 * always carries the contact id (`sub`), so we authorize directly off the
 * signed identity with no email lookup. Returns false if the contact is unknown.
 */
export const isAdminByContactId = async (contactId: string): Promise<boolean> => {
  const cfg = getRoleConfig();
  assertGuid(contactId, 'contactId');

  const data = await dvGet<ODataList<{ [k: string]: unknown }>>(
    `contacts(${contactId})/${cfg.webRoleContactNav}?$select=${cfg.webRoleNameAttr}`
  );

  const adminName = cfg.adminWebRoleName.toLowerCase();
  return data.value.some(
    (r) => String(r[cfg.webRoleNameAttr] ?? '').toLowerCase() === adminName
  );
};

/**
 * Returns true if the contact identified by `email` holds the admin web role.
 * Used to authorize the calling portal user server-side (client-side role
 * checks are UX only). Returns false if no contact matches the email.
 */
export const isAdminByEmail = async (email: string): Promise<boolean> => {
  const cfg = getRoleConfig();
  const trimmed = email.trim();
  if (!trimmed) return false;

  const data = await dvGet<ODataList<{ [k: string]: unknown }>>(
    `contacts?$select=contactid` +
      `&$filter=emailaddress1 eq '${escapeOData(trimmed)}'` +
      `&$expand=${cfg.webRoleContactNav}($select=${cfg.webRoleNameAttr})` +
      `&$top=1`
  );

  const contact = data.value[0];
  if (!contact) return false;

  const roles = (contact[cfg.webRoleContactNav] as Array<Record<string, unknown>>) ?? [];
  const adminName = cfg.adminWebRoleName.toLowerCase();
  return roles.some(
    (r) => String(r[cfg.webRoleNameAttr] ?? '').toLowerCase() === adminName
  );
};
