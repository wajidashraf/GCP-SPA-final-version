// IMPORTANT: Client-side authorization is for UX only, not security.
// Server-side table permissions enforce actual access control.
// Always configure table permissions via /power-pages:integrate-webapi.

import { getCurrentUser, isAuthenticated } from '../services/authService';

const normalize = (s: string): string => s.trim().toLowerCase();

const getUserRoles = (): string[] => getCurrentUser()?.userRoles ?? [];

const hasRole = (roleName: string): boolean => {
  const target = normalize(roleName);
  return getUserRoles().some((r) => normalize(r) === target);
};

const hasAnyRole = (roleNames: readonly string[]): boolean =>
  roleNames.some(hasRole);

const hasAllRoles = (roleNames: readonly string[]): boolean =>
  roleNames.every(hasRole);

const isAdmin = (): boolean => hasRole('Administrators');

const hasElevatedAccess = (additionalRoles: readonly string[] = []): boolean =>
  isAdmin() || hasAnyRole(additionalRoles);

export {
  getUserRoles,
  hasRole,
  hasAnyRole,
  hasAllRoles,
  isAuthenticated,
  isAdmin,
  hasElevatedAccess,
};
