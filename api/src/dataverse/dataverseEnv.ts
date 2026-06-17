// Per-invocation Dataverse environment routing.
//
// One Function App serves multiple Power Pages portals (dev + prod), and each
// portal is backed by its OWN Dataverse environment. Which environment a request
// targets is known only after token validation (from the token's issuing portal),
// so we pin the resolved Dataverse base URL for the rest of the invocation here
// and have the Dataverse client read it.
//
// We use `storage.run(url, fn)` (NOT `enterWith`) to scope the pinned URL. An
// earlier version called `enterWith` inside `validateToken` (an awaited callee)
// and relied on the value surviving back into the handler's continuation. Under
// the Azure Functions Node worker that propagation does NOT hold: the value set
// in the callee is lost when control returns to the handler, so every Dataverse
// call fell back to the default DATAVERSE_URL (dev) — breaking prod-portal
// requests while dev "worked" only because dev is the fallback. `run()` binds the
// value for the entire callback and all its descendant async calls reliably, so
// each handler wraps its Dataverse-touching body in `runForPortal`.

import { AsyncLocalStorage } from 'node:async_hooks';
import { getDataverseUrlForPortal, getPowerPageSiteIdForPortal } from '../config.js';

/** Per-invocation context pinned for the issuing portal. */
interface PortalContext {
  /** Dataverse base URL backing the portal (no trailing slash). */
  dataverseUrl: string;
  /** Power Pages site id used to scope web-role queries, if configured. */
  siteId?: string;
}

const storage = new AsyncLocalStorage<PortalContext>();

/**
 * Run `fn` with the Dataverse environment + site pinned to those backing
 * `portalBaseUrl`. Every Dataverse call inside `fn` (admin check, record reads,
 * writes) then targets the correct org, and web-role queries scope to the
 * correct site. Resolves via the per-portal maps, falling back to the single
 * DATAVERSE_URL when no per-portal entry exists.
 */
export const runForPortal = <T>(portalBaseUrl: string, fn: () => Promise<T>): Promise<T> =>
  storage.run(
    {
      dataverseUrl: getDataverseUrlForPortal(portalBaseUrl).replace(/\/+$/, ''),
      siteId: getPowerPageSiteIdForPortal(portalBaseUrl),
    },
    fn
  );

/** The Dataverse base URL pinned for this invocation, or undefined if unset. */
export const currentDataverseUrl = (): string | undefined =>
  storage.getStore()?.dataverseUrl;

/** The Power Pages site id pinned for this invocation, or undefined if unset. */
export const currentPowerPageSiteId = (): string | undefined =>
  storage.getStore()?.siteId;
