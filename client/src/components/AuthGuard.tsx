import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

interface Props {
  children: React.ReactNode;
  /** Comma-separated list of roles, if provided. Omit for "any authed user". */
  roles?: Array<'CUSTOMER' | 'ADMIN' | 'SUPERADMIN'>;
}

/**
 * Wraps a route subtree. Shows nothing while the initial `/auth/me` probe
 * is in flight (avoids redirect flicker on refresh when the cookie is
 * valid). Redirects to `/login?next=/current/path` if unauthenticated.
 * Renders 403 for authenticated users without the required role.
 */
export const AuthGuard: React.FC<Props> = ({ children, roles }) => {
  const { user, status } = useAuthStore();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-[60dvh] text-ink-hint font-body text-sm">
        Loading…
      </div>
    );
  }

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (roles && !roles.includes(user.role as any)) {
    return (
      <div className="flex items-center justify-center h-[60dvh] text-ink font-cute">
        Access denied — role not permitted.
      </div>
    );
  }

  return <>{children}</>;
};
