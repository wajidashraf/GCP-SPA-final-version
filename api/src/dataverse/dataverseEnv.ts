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
import { getDataverseUrlForPortal } from '../config.js';

const storage = new AsyncLocalStorage<string>();

/**
 * Run `fn` with the Dataverse environment pinned to the one backing `portalBaseUrl`.
 * Every Dataverse call inside `fn` (admin check, record reads, writes) then targets
 * the correct org. Resolves the URL via the per-portal map, falling back to the
 * single DATAVERSE_URL when no per-portal entry exists.
 */
export const runForPortal = <T>(portalBaseUrl: string, fn: () => Promise<T>): Promise<T> =>
  storage.run(getDataverseUrlForPortal(portalBaseUrl).replace(/\/+$/, ''), fn);

/** The Dataverse base URL pinned for this invocation, or undefined if unset. */
export const currentDataverseUrl = (): string | undefined => storage.getStore();
