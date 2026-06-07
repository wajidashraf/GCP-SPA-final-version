import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { hasAnyRole, hasAllRoles } from '../utils/authorization';

type RequireRoleProps = {
  children: ReactNode;
  roles: readonly string[];
  /** If true, user must have ALL roles. Default: any of them. */
  requireAll?: boolean;
  fallback?: ReactNode;
};

const RequireRole = ({
  children,
  roles,
  requireAll = false,
  fallback = null,
}: RequireRoleProps) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <>{fallback}</>;
  const allowed = requireAll ? hasAllRoles(roles) : hasAnyRole(roles);
  return <>{allowed ? children : fallback}</>;
};

export default RequireRole;
export { RequireRole };
