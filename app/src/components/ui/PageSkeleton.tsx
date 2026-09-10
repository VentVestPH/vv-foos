import { useEffect, useState } from 'react';
import { Skeleton } from './Skeleton';

const ROUTE_DELAY_MS = 200;

function PageSkeleton({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="fo-page-skeleton">
      <div className="fo-skeleton-card">
        <Skeleton rows={2} label={label} />
      </div>
      <div className="fo-skeleton-card" aria-hidden="true">
        <Skeleton rows={6} label={label} />
      </div>
    </div>
  );
}

export function RouteSkeleton() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setShow(true), ROUTE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return show ? <PageSkeleton /> : null;
}
