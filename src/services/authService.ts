// Power Pages authentication service.
//
// Auth is SERVER-SIDE: login posts an HTML form to /Account/Login/ExternalLogin
// with an anti-forgery token + the Entra ID provider URL. The server sets a
// session cookie and redirects. There is no client-side token storage.
//
// On localhost, we return mock user data so dev still works (the /_api/ and
// /_layout/ endpoints don't exist outside Power Pages).

import type { PowerPagesUser } from '../types/powerPages';

const isLocalhost = (): boolean =>
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1');

const MOCK_USER: PowerPagesUser = {
  userName: 'wajid.ashraf@democompany.com',
  firstName: 'Wajid',
  lastName: 'Ashraf',
  email: 'wajid.ashraf@democompany.com',
  contactId: undefined,
  userRoles: ['Authenticated Users'],
};

const getPortal = (): PowerPagesPortal | undefined =>
  typeof window !== 'undefined' ? window.Microsoft?.Dynamic365?.Portal : undefined;

type PowerPagesPortal = NonNullable<NonNullable<NonNullable<Window['Microsoft']>['Dynamic365']>['Portal']>;

const getCurrentUser = (): PowerPagesUser | null => {
  if (isLocalhost()) return MOCK_USER;
  const portalUser = getPortal()?.User;
  if (!portalUser?.userName) return null;
  return portalUser;
};

const isAuthenticated = (): boolean => {
  const u = getCurrentUser();
  return !!u && !!u.userName;
};

const getTenantId = (): string | null => {
  if (isLocalhost()) return 'mock-tenant-id';
  return getPortal()?.tenant ?? null;
};

const getUserDisplayName = (): string => {
  const u = getCurrentUser();
  if (!u) return '';
  const full = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return full || u.userName || '';
};

const getUserInitials = (): string => {
  const u = getCurrentUser();
  if (!u) return '?';
  const first = u.firstName?.[0] ?? '';
  const last = u.lastName?.[0] ?? '';
  if (first || last) return (first + last).toUpperCase();
  // Fallback: first letter of userName/email
  return (u.userName ?? '?').charAt(0).toUpperCase();
};

const fetchAntiForgeryToken = async (): Promise<string> => {
  const res = await fetch('/_layout/tokenhtml', { credentials: 'same-origin' });
  if (!res.ok) {
    throw new Error(`Failed to fetch anti-forgery token: ${res.status}`);
  }
  const html = await res.text();
  // Token is rendered as: <input name="__RequestVerificationToken" type="hidden" value="..." />
  const match = html.match(
    /name="__RequestVerificationToken"[^>]*value="([^"]+)"/i
  );
  if (!match?.[1]) {
    throw new Error('Anti-forgery token not found in /_layout/tokenhtml response');
  }
  return match[1];
};

/**
 * Triggers an Entra ID login by submitting a hidden form to
 * /Account/Login/ExternalLogin. The browser is then redirected to Entra and
 * back to `returnUrl` (defaults to the current page).
 */
const login = async (returnUrl?: string): Promise<void> => {
  if (isLocalhost()) {
    // In dev there's nothing to post to; just no-op and let the caller reload.
    console.warn('[authService] login() called on localhost — server auth unavailable in dev.');
    return;
  }

  const tenantId = getTenantId();
  if (!tenantId) {
    throw new Error('Tenant ID not available — cannot construct Entra ID provider URL.');
  }

  const token = await fetchAntiForgeryToken();
  const target = returnUrl ?? window.location.pathname + window.location.search;

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = '/Account/Login/ExternalLogin';
  form.style.display = 'none';

  const append = (name: string, value: string) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  };

  append('__RequestVerificationToken', token);
  append('provider', `https://login.windows.net/${tenantId}/`);
  append('returnUrl', target);

  document.body.appendChild(form);
  form.submit();
};

const logout = (returnUrl?: string): void => {
  if (isLocalhost()) {
    console.warn('[authService] logout() called on localhost — server auth unavailable in dev.');
    return;
  }
  const target = returnUrl ?? '/';
  window.location.href = `/Account/Login/LogOff?returnUrl=${encodeURIComponent(target)}`;
};

export {
  getCurrentUser,
  isAuthenticated,
  getTenantId,
  getUserDisplayName,
  getUserInitials,
  fetchAntiForgeryToken,
  login,
  logout,
};
