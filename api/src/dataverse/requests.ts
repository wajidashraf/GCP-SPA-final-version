// Read-side access to gcp_request for building notification placeholder data.
// Fetches the record app-only WITH formatted-value annotations so choice/lookup
// columns resolve to their display labels (status, type, decision code, verifier
// name, etc.) without us hardcoding the choice maps on the server.

import { dvGet } from './dataverseClient.js';

// Annotation name as it appears in the `odata.include-annotations` Prefer value
// — NO leading `@`. The `@` only prefixes the annotation when it suffixes a
// property in the RESPONSE (e.g. `gcp_requeststatus@OData...FormattedValue`).
// Putting the `@` in the Prefer header makes Dataverse match nothing and return
// no formatted values at all.
const FV_ANNOTATION = 'OData.Community.Display.V1.FormattedValue';
const FV = `@${FV_ANNOTATION}`;
const GUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export interface RequestNotificationData {
  /** Token → value map consumed by renderTemplate. */
  data: Record<string, string>;
  /** Requester email (gcp_requestoremail), for the 'requester' recipient role. */
  requesterEmail: string;
}

const SELECT = [
  'gcp_requestid',
  'gcp_requesttitle',
  'gcp_requestoremail',
  'gcp_reviewno',
  'gcp_submittedon',
  'gcp_requeststatus',
  'gcp_category',
  'gcp_mattertype',
  'gcp_type',
  'gcp_outcome',
  'gcp_decisioncode',
  'gcp_verifier_comment',
  'gcp_verifydate',
  'gcp_reviewdate',
  '_gcp_requestorname_value',
  '_gcp_verified_by_value',
  '_gcp_reviewedby_value',
].join(',');

const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleString('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    dateStyle: 'full',
    timeStyle: 'short',
  })} (MYT)`;
};

/**
 * Load the gcp_request record and project it into the placeholder data map +
 * requester email. `spaBaseUrl` is used to build the {{viewLink}} deep link.
 */
export const getRequestForNotification = async (
  recordId: string,
  spaBaseUrl: string
): Promise<RequestNotificationData> => {
  if (!GUID_RE.test(recordId)) {
    throw new Error('Invalid recordId: expected a GUID');
  }
  const r = await dvGet<Record<string, unknown>>(
    `gcp_requests(${recordId})?$select=${SELECT}`,
    { Prefer: `odata.include-annotations="${FV_ANNOTATION}"` }
  );

  const s = (key: string): string => {
    const v = r[key];
    return v == null ? '' : String(v);
  };
  const formatted = (key: string): string => s(`${key}${FV}`);
  const requesterEmail = s('gcp_requestoremail').trim().toLowerCase();

  const data: Record<string, string> = {
    requestName: s('gcp_requesttitle'),
    requestType: formatted('gcp_mattertype') || formatted('gcp_type'),
    requestNumber: s('gcp_reviewno') || recordId,
    requestCategory: formatted('gcp_category'),
    requestStatus: formatted('gcp_requeststatus'),
    requestorName: formatted('_gcp_requestorname_value'),
    requestorEmail: requesterEmail,
    submissionDate: fmtDate(s('gcp_submittedon')),
    viewLink: spaBaseUrl ? `${spaBaseUrl}/requests/${encodeURIComponent(recordId)}` : '',
    verifierName: formatted('_gcp_verified_by_value'),
    verifierComment: s('gcp_verifier_comment'),
    verifyDate: fmtDate(s('gcp_verifydate')),
    reviewerName: formatted('_gcp_reviewedby_value'),
    decisionCode: formatted('gcp_decisioncode'),
    outcome: formatted('gcp_outcome'),
    reviewDate: fmtDate(s('gcp_reviewdate')),
  };

  return { data, requesterEmail };
};
