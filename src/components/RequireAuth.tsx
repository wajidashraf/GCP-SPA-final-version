import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';

type RequireAuthProps = {
  children: ReactNode;
  /** Rendered when the user is not authenticated. */
  fallback?: ReactNode;
};

const RequireAuth = ({ children, fallback = null }: RequireAuthProps) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  return <>{isAuthenticated ? children : fallback}</>;
};

export default RequireAuth;
export { RequireAuth };
