import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from './SessionProvider';
import { AccessDenied } from '../components/ui/AccessDenied';
import { LoadingPane } from '../components/ui/LoadingPane';
import type { StaffRole } from '../lib/database.types';

interface RequireAuthProps {
  children: ReactNode;

  roles?: StaffRole[];

  deniedLabel?: string;
}

export function RequireAuth({ children, roles, deniedLabel }: RequireAuthProps) {
  const { session, staff, role, loading } = useSession();
  const location = useLocation();

  if (loading) {
    return <LoadingPane what="Front Office OS" />;
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
    return <AccessDenied what={deniedLabel ?? 'this area'} />;
  }

  return <>{children}</>;
}
