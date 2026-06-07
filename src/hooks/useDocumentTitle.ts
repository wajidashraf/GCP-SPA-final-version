import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { findMatter } from '../data/matterChoices';

const SITE_NAME = 'GCP Nexus';

/** Static path -> page title. The dynamic submit route is handled below. */
const staticTitles: Record<string, string> = {
  '/': 'Home',
  '/login': 'Sign In',
  '/submit': 'Create Request',
  '/requests': 'My Requests',
  '/admin': 'Admin',
  '/profile': 'Profile',
};

function resolveTitle(pathname: string): string {
  const staticTitle = staticTitles[pathname];
  if (staticTitle) return staticTitle;

  // /submit/:channel/:formCode
  const submitMatch = pathname.match(/^\/submit\/([^/]+)\/([^/]+)\/?$/);
  if (submitMatch) {
    const [, channel, formCode] = submitMatch;
    const matter = findMatter(channel, formCode);
    return matter ? matter.label : 'Form not found';
  }

  return '';
}

/**
 * Power Pages only has web pages for a few routes (home, profile, search, …).
 * Any SPA route without a matching web page is served by the "Page Not Found"
 * web page, so the server-rendered tab title reads "Page not found" even though
 * the React route renders correctly. Setting document.title client-side on every
 * navigation overrides that stale title.
 */
export function useDocumentTitle(): void {
  const { pathname } = useLocation();

  useEffect(() => {
    const pageTitle = resolveTitle(pathname);
    document.title = pageTitle ? `${pageTitle} | ${SITE_NAME}` : SITE_NAME;
  }, [pathname]);
}
