import { dvGet, dataverseUrl, DataverseError } from './dataverseClient.js';
import { executeChangeSet } from './dataverseBatch.js';
import { isAdminByContactId } from './webRoles.js';
import { BookingError, type BookingIo } from './engagementBooking.js';
import { bookingChoices } from '../../generated/bookingChoices.js';

type Row = Record<string, unknown>;
const REQUEST_SELECT = 'gcp_requestid,gcp_requeststatus,_gcp_requestorname_value';
const ENGAGEMENT_SELECT = 'gcp_engagementsid,gcp_name,gcp_engagementnumber,gcp_engagementstatus,gcp_engagementtype,gcp_location,gcp_engagementdate,gcp_starttime,gcp_endtime,_gcp_request_value,_gcp_slot_value,createdon';
const SLOT_SELECT = 'gcp_slotid,gcp_type,gcp_slotstatus,gcp_date,gcp_start,gcp_end,_gcp_attendee_value,_gcp_attendee_1_value,_gcp_attendee_2_value,gcp_attendeeemail,gcp_attendeeemail_1,gcp_attendeeemail_2';
const readRecord = async (path: string, get: <T>(path: string) => Promise<T> = dvGet): Promise<Row | null> => {
  try { return await get<Row>(path); }
  catch (error) { if (error instanceof DataverseError && error.status === 404) return null; throw error; }
};

/** Read the already verified navigation properties rather than assuming raw
 * contact lookup attribute spellings. Normalize to internal orchestration keys
 * only; these two normalized keys are never sent as Dataverse attributes. */
export const readBookingEngagement = async (
  id: string,
  get: <T>(path: string) => Promise<T> = dvGet,
): Promise<Row | null> => {
  const row = await readRecord(`gcp_engagementses(${id})?$select=${ENGAGEMENT_SELECT}` +
    '&$expand=gcp_EngagementCreatedBy($select=contactid),gcp_AttendeeEmail($select=contactid)', get);
  if (!row) return null;
  const contactId = (navigation: unknown): string | null => {
    if (!navigation || typeof navigation !== 'object') return null;
    const value = (navigation as Row).contactid;
    return typeof value === 'string' ? value : null;
  };
  return { ...row, _gcp_engagementcreatedby_value: contactId(row.gcp_EngagementCreatedBy),
    _gcp_attendeeemail_value: contactId(row.gcp_AttendeeEmail) };
};

/** Follow all collection pages without letting a nextLink change org or API. */
export const readBookingCollection = async (
  path: string,
  get: <T>(path: string) => Promise<T> = dvGet,
  apiBase = dataverseUrl(''),
): Promise<Row[]> => {
  const base = new URL(apiBase);
  const collection = path.split('?')[0];
  const seen = new Set<string>();
  const rows: Row[] = [];
  while (path) {
    if (seen.has(path)) throw new BookingError('Dataverse returned a repeated booking page.', 502);
    seen.add(path);
    const page = await get<{ value: Row[]; '@odata.nextLink'?: string }>(path);
    if (!Array.isArray(page.value)) throw new BookingError('Dataverse returned an invalid booking collection.', 502);
    rows.push(...page.value);
    const next = page['@odata.nextLink'];
    if (!next) break;
    const url = new URL(next, base);
    if (url.origin !== base.origin || url.pathname !== `${base.pathname}${collection}` || url.hash || url.username || url.password) {
      throw new BookingError('Dataverse returned a booking page outside this environment.', 502);
    }
    path = `${url.pathname.slice(base.pathname.length)}${url.search}`;
  }
  return rows;
};

// Metadata is checked per environment. A table that cannot enforce If-Match
// cannot provide this endpoint's transaction guarantee. Never alter metadata.
const concurrencyChecks = new Map<string, Promise<void>>();
const ensureConcurrency = async (): Promise<void> => {
  const environment = dataverseUrl('');
  let check = concurrencyChecks.get(environment);
  if (!check) {
    check = (async () => {
      for (const logicalName of ['gcp_request', 'gcp_engagements', 'gcp_slot']) {
        const metadata = await dvGet<{ IsOptimisticConcurrencyEnabled?: boolean }>(
          `EntityDefinitions(LogicalName='${logicalName}')?$select=IsOptimisticConcurrencyEnabled`,
        );
        if (metadata.IsOptimisticConcurrencyEnabled !== true) {
          throw new BookingError(`Booking requires optimistic concurrency on ${logicalName}; contact support.`, 503);
        }
      }
    })();
    concurrencyChecks.set(environment, check);
  }
  try { await check; }
  catch (error) { concurrencyChecks.delete(environment); throw error; }
};

export const createBookingIo = (): BookingIo => ({
  getRequest: (id) => readRecord(`gcp_requests(${id})?$select=${REQUEST_SELECT}`),
  getEngagement: readBookingEngagement,
  getSlot: (id) => readRecord(`gcp_slots(${id})?$select=${SLOT_SELECT}`),
  listForRequest: (id) => readBookingCollection(`gcp_engagementses?$select=${ENGAGEMENT_SELECT}&$filter=_gcp_request_value eq ${id}`),
  listForSlot: (id) => readBookingCollection(`gcp_engagementses?$select=${ENGAGEMENT_SELECT}&$filter=_gcp_slot_value eq ${id}`),
  listSlots: () => readBookingCollection(`gcp_slots?$select=${SLOT_SELECT}&$orderby=gcp_start asc`,
    <T>(path: string) => dvGet<T>(path, { Prefer: 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"' })),
  listScheduledSlots: () => readBookingCollection(`gcp_engagementses?$select=_gcp_slot_value&$filter=gcp_engagementstatus eq ${bookingChoices.ENGAGEMENT_STATUS_SCHEDULED}`),
  listAllEngagements: () => readBookingCollection(`gcp_engagementses?$select=${ENGAGEMENT_SELECT}&$orderby=gcp_engagementdate desc,createdon desc`),
  isAdmin: isAdminByContactId,
  ensureConcurrency,
  transact: executeChangeSet,
  now: Date.now,
});
