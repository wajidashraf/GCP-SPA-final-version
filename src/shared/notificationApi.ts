// Frontend client for the lifecycle-notification Function.
//
// Reuses the same portal token + Function base URL as the SharePoint uploader
// (see portalToken / uploadConfig). Fire-and-forget: this never throws, because a
// successful action (submit/verify/review) must not depend on the email being sent.
//
// The SPA only reports "event X happened on record Y" — the Function loads the
// matching admin-editable templates (gcp_emailtemplate), enriches placeholders from
// the request record, resolves recipients per role, renders and sends.

import { acquirePortalToken } from './portalToken';
import { uploadConfig } from './uploadConfig';

// Event keys must match src/data/emailTemplateEvents.ts and the send-side Function.
export type NotificationEventKey =
  | 'request_submitted'
  | 'request_verified'
  | 'request_reviewed';

/**
 * Fire a lifecycle notification for a request. Resolves `true` if the Function
 * accepted it, `false` on any failure (misconfig, network, non-2xx). Never rejects —
 * callers use the boolean only to choose which toast to show.
 */
export const notifyEvent = async (
  recordId: string,
  eventKey: NotificationEventKey,
  loginHint?: string
): Promise<boolean> => {
  if (!uploadConfig.isConfigured) return false;
  try {
    const token = await acquirePortalToken();
    const res = await fetch(`${uploadConfig.functionBaseUrl}/api/notifications/event`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recordId, eventKey }),
      signal: AbortSignal.timeout(15_000),
    });
    return res.ok;
  } catch (err) {
    console.error('Notification email call failed:', err);
    return false;
  }
};

export interface RequestNotificationInput {
  recordId: string;
  requestName: string;
  requestType: string;
  submissionDate: string; // ISO 8601
  requestNumber?: string;
}

/**
 * Back-compat wrapper for the original submission notification. The Function now
 * derives all content from the request record, so only `recordId` is used.
 */
export const sendRequestNotification = async (
  input: RequestNotificationInput,
  loginHint?: string
): Promise<boolean> => notifyEvent(input.recordId, 'request_submitted', loginHint);
