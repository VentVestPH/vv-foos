import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from './SessionProvider';
import type { StaffRole } from '../lib/database.types';

interface RequireAuthProps {
  children: ReactNode;
  /** When set, only these roles may enter; others are sent to /. */
  roles?: StaffRole[];
}

/**
 * Route guard. Unauthenticated users go to /login (with the intended path
 * preserved so login can return them). Authenticated users whose staff row is
 * missing see a hold screen — an account exists in Auth but not in staff, so
 * an admin has to add them. Role checks here are a UI convenience; RLS in
 * Postgres is the actual boundary (architecture section 5).
 */
export function RequireAuth({ children, roles }: RequireAuthProps) {
  const { session, staff, role, loading } = useSession();
  const location = useLocation();

  if (loading) {
    return <div className="full-center text-secondary">Loading…</div>;
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!staff || !staff.is_active) {
    return (
      <div className="full-center">
        <div className="hold-card">
          <h1>Account not provisioned</h1>
          <p className="text-secondary">
            You're signed in, but no active staff record matches your account.
            Ask an admin to add you to Staff, then reload.
          </p>
        </div>
      </div>
    );
  }

  if (roles && role && !roles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
