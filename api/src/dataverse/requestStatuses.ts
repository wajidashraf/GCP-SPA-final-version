import { BookingError, type BookingIdentity } from './engagementBooking.js';
import { dvGet } from './dataverseClient.js';
import { getContactWebRoles } from './webRoles.js';
import { readBookingCollection } from './engagementBookingIo.js';
import { bookingChoices } from '../../generated/bookingChoices.js';

type Row = Record<string, unknown>;
type RequestReadAccess = { roles: string[]; permissions: Row[]; accountId: string | null };
export interface RequestStatusIo {
  getAccess: (contactId: string, siteId: string) => Promise<RequestReadAccess>;
  listStatuses: (ids: string[], accessFilter: string) => Promise<Row[]>;
}
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sameId = (left: unknown, right: string) => typeof left === 'string' && left.toLowerCase() === right.toLowerCase();

/** Only the deployed request table's verified Global/Contact/Account read
 * grants are supported. Unknown relationships/scopes fail closed. No grants,
 * business records or schema are changed by this read path. */
export const requestStatusAccessFilter = (identity: BookingIdentity, access: RequestReadAccess): string | null => {
  const roles = new Set(access.roles.map(role => role.toLowerCase()));
  const filters = new Set<string>();
  for (const permission of access.permissions) {
    if (permission.entitylogicalname !== 'gcp_request' || permission.read !== true ||
        !sameId(permission.websiteid, identity.siteId) || permission.parententitypermission ||
        !Array.isArray(permission.adx_entitypermission_webrole) ||
        !permission.adx_entitypermission_webrole.some(role => typeof role === 'string' && roles.has(role.toLowerCase()))) continue;
    if (permission.scope === 756150000) return '';
    if (permission.scope === 756150001 && permission.contactrelationship === 'gcp_request_RequestorName_contact') {
      filters.add(`_gcp_requestorname_value eq ${identity.contactId.toLowerCase()}`);
    }
    if (permission.scope === 756150002 && permission.accountrelationship === 'gcp_request_Company_account' &&
        access.accountId && GUID.test(access.accountId)) {
      filters.add(`_gcp_company_value eq ${access.accountId.toLowerCase()}`);
    }
  }
  return filters.size ? [...filters].join(' or ') : null;
};

export const readRequestStatuses = async (rawIds: unknown, identity: BookingIdentity, io: RequestStatusIo) => {
  if (!GUID.test(identity.contactId ?? '')) throw new BookingError('A validated portal contact is required.', 403);
  if (!GUID.test(identity.siteId ?? '') || !identity.dataverseUrl) throw new BookingError('A portal environment and site mapping is required.', 503);
  if (!Array.isArray(rawIds) || rawIds.length > 100 || rawIds.some(id => typeof id !== 'string' || !GUID.test(id))) {
    throw new BookingError('Provide at most 100 valid request IDs.', 400);
  }
  const ids = [...new Set((rawIds as string[]).map(id => id.toLowerCase()))];
  if (!ids.length) return { ok: true as const, requests: [] };
  const access = await io.getAccess(identity.contactId, identity.siteId);
  const filter = requestStatusAccessFilter(identity, access);
  const rows = filter === null ? [] : await io.listStatuses(ids, filter);
  const requests = rows.map(row => {
    const id = typeof row.gcp_requestid === 'string' ? row.gcp_requestid.toLowerCase() : '';
    const status = row.gcp_requeststatus ?? null;
    if (!ids.includes(id) || (status !== null && !bookingChoices.requestStatusChoices.some(choice => choice.value === status))) {
      throw new BookingError('The current request statuses could not be verified.', 502);
    }
    return { id, status: status as number | null };
  });
  return { ok: true as const, requests };
};

export const createRequestStatusIo = (): RequestStatusIo => ({
  getAccess: async (contactId, siteId) => {
    const [components, assigned, contact] = await Promise.all([
      readBookingCollection(`powerpagecomponents?$select=powerpagecomponentid,powerpagecomponenttype,content&$filter=_powerpagesiteid_value eq ${siteId} and (powerpagecomponenttype eq 18 or powerpagecomponenttype eq 11)`),
      getContactWebRoles(contactId),
      dvGet<Row>(`contacts(${contactId})?$select=_parentcustomerid_value`, {
        Prefer: 'odata.include-annotations="Microsoft.Dynamics.CRM.lookuplogicalname"',
      }),
    ]);
    const roles = assigned.map(role => role.id);
    const permissions: Row[] = [];
    for (const component of components) {
      const content = JSON.parse(String(component.content)) as Row;
      if (!sameId(content.websiteid, siteId)) continue;
      if (component.powerpagecomponenttype === 18) permissions.push(content);
      // Power Pages applies the authenticated-users role implicitly; it is not
      // necessarily present in the contact's explicit N:N role collection.
      if (component.powerpagecomponenttype === 11 && content.authenticatedusersrole === true &&
          content.anonymoususersrole === false && typeof component.powerpagecomponentid === 'string') {
        roles.push(component.powerpagecomponentid);
      }
    }
    return { roles, permissions, accountId:
      contact['_parentcustomerid_value@Microsoft.Dynamics.CRM.lookuplogicalname'] === 'account' &&
      typeof contact._parentcustomerid_value === 'string' ? contact._parentcustomerid_value : null };
  },
  listStatuses: (ids, accessFilter) => {
    const idsFilter = ids.map(id => `gcp_requestid eq ${id}`).join(' or ');
    const filter = `(${idsFilter})${accessFilter ? ` and (${accessFilter})` : ''}`;
    return readBookingCollection(`gcp_requests?$select=gcp_requestid,gcp_requeststatus&$filter=${encodeURIComponent(filter)}`);
  },
});
