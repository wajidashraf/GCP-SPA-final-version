import type { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { AuthError, validateToken, type CallerIdentity } from '../auth/validateToken.js';
import { currentDataverseUrl, currentPowerPageSiteId, runForPortal } from '../dataverse/dataverseEnv.js';
import { BookingError, executeEngagementBooking, readEngagementBooking, type BookingIdentity, type BookingIo } from '../dataverse/engagementBooking.js';
import { createBookingIo } from '../dataverse/engagementBookingIo.js';
import { DataverseError } from '../dataverse/dataverseClient.js';
import { createRequestStatusIo, readRequestStatuses, type RequestStatusIo } from '../dataverse/requestStatuses.js';

const json = (status: number, body: unknown): HttpResponseInit => ({
  status, jsonBody: body, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

/** Older endpoints can fall back to one default org/site. This mutation must
 * have an explicit index-aligned mapping when multiple portals are configured. */
export const assertBookingPortalMapping = (portal: string, env: NodeJS.ProcessEnv = process.env): void => {
  const urls = (env.PORTAL_BASE_URLS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  const host = (url: string): string => new URL(url).host.toLowerCase();
  const index = urls.findIndex((url) => host(url) === host(portal));
  if (index < 0) throw new BookingError('The issuing portal has no booking environment mapping.', 503);
  const dataverse = (env.DATAVERSE_URLS ?? '').split(',')[index]?.trim() || (urls.length === 1 ? env.DATAVERSE_URL?.trim() : '');
  const site = (env.POWERPAGE_SITE_IDS ?? '').split(',')[index]?.trim() || (urls.length === 1 ? env.POWERPAGE_SITE_ID?.trim() : '');
  if (!dataverse || !site) throw new BookingError('This portal requires explicit booking environment and site mappings.', 503);
  let target: URL;
  try { target = new URL(dataverse); }
  catch { throw new BookingError('The booking Dataverse environment mapping is invalid.', 503); }
  if (target.protocol !== 'https:' || target.pathname !== '/' || target.search || target.hash || target.username || target.password ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(site)) {
    throw new BookingError('The booking environment or site mapping is invalid.', 503);
  }
};

interface HandlerDependencies {
  authenticate: (authorization: string | null) => Promise<CallerIdentity>;
  assertMapping: (portal: string) => void;
  runForPortal: <T>(portal: string, callback: () => Promise<T>) => Promise<T>;
  getIdentity: (caller: CallerIdentity) => BookingIdentity;
  createIo: () => BookingIo;
  createStatusIo?: () => RequestStatusIo;
}
const defaultDependencies: HandlerDependencies = {
  authenticate: validateToken,
  assertMapping: assertBookingPortalMapping,
  runForPortal,
  getIdentity: (caller) => ({ contactId: caller.contactId,
    siteId: currentPowerPageSiteId() ?? '', dataverseUrl: currentDataverseUrl() ?? '' }),
  createIo: createBookingIo,
};

export const createEngagementBookingHandler = (dependencies: HandlerDependencies = defaultDependencies) =>
  async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const caller = await dependencies.authenticate(request.headers.get('authorization'));
      if (!caller.contactId) throw new AuthError('A validated portal contact is required.', 403);
      dependencies.assertMapping(caller.portalBaseUrl);
      if (request.method === 'GET') {
        if (request.query.get('scope') === 'request-statuses') {
          return await dependencies.runForPortal(caller.portalBaseUrl, async () => json(200,
            await readRequestStatuses(request.query.get('requestIds')?.split(','), dependencies.getIdentity(caller),
              (dependencies.createStatusIo ?? createRequestStatusIo)())));
        }
        return await dependencies.runForPortal(caller.portalBaseUrl, async () => json(200,
          await readEngagementBooking({ requestId: request.query.get('requestId') ?? undefined,
            scope: request.query.get('scope') ?? undefined }, dependencies.getIdentity(caller), dependencies.createIo())));
      }
      let body: unknown;
      try { body = await request.json(); }
      catch { return json(400, { ok: false, error: 'Expected a JSON booking object.' }); }
      return await dependencies.runForPortal(caller.portalBaseUrl, async () => {
        const result = await executeEngagementBooking(body, dependencies.getIdentity(caller), dependencies.createIo());
        return json(200, result);
      });
    } catch (error) {
      if (error instanceof AuthError || error instanceof BookingError) {
        return json(error.status, { ok: false, error: error.message });
      }
      context.error('Engagement booking failed', error);
      return json(error instanceof DataverseError ? 502 : 500, {
        ok: false, error: 'The booking service is unavailable. Refresh the request before trying again.',
      });
    }
  };
