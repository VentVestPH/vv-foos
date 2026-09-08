import { Link } from 'react-router-dom';

interface AccessDeniedProps {
  what: string;
  backTo?: string;
  backLabel?: string;
}

export function AccessDenied({ what, backTo = '/', backLabel = 'Back to Home' }: AccessDeniedProps) {
  return (
    <div className="full-center">
      <div className="hold-card">
        <h1>You do not have access to {what}</h1>
        <p className="text-secondary">
          Your role does not include this area. Ask an admin if you need it.
        </p>
        <Link to={backTo}>{backLabel}</Link>
      </div>
    </div>
  );
}
