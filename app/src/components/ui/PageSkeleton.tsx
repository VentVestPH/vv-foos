import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Skeleton } from './Skeleton';
import { TableSkeleton } from './TableSkeleton';

const ROUTE_DELAY_MS = 200;

export const USERS_COLUMNS = ['Name', 'Email', 'Role', 'Title', 'Sign-in', 'Last sign-in'];
const REPORT_SECTIONS = ['Pipeline by Stage', 'Requisition Aging', 'Recruiter/Sourcer Activity', 'Time in Stage', 'Source Effectiveness'];

function HeadSkeleton({ search = true }: { search?: boolean }) {
  return (
    <div className="fo-skeleton-card fo-skel-head" aria-hidden="true">
      <span className="skeleton-row fo-skel-crumb" />
      <span className="skeleton-row fo-skel-title" />
      <span className="skeleton-row fo-skel-line" />
      {search && <span className="skeleton-row fo-skel-search" />}
    </div>
  );
}

export function WidgetBodySkeleton({ kpis = 0, bars = 5 }: { kpis?: number; bars?: number }) {
  return (
    <div className="fo-skel-widget-body" aria-hidden="true">
      {kpis > 0 && (
        <div className="fo-skel-kpis">
          {Array.from({ length: kpis }, (_, index) => <span key={index} className="skeleton-card fo-skel-kpi" />)}
        </div>
      )}
      {Array.from({ length: bars }, (_, index) => (
        <div key={index} className="fo-skel-bar-row">
          <span className="skeleton-row fo-skel-bar-label" />
          <span className="skeleton-row fo-skel-bar-track" style={{ width: `${Math.max(18, 82 - index * 14)}%` }} />
          <span className="skeleton-row fo-skel-bar-count" />
        </div>
      ))}
    </div>
  );
}

export function ReportsSkeleton() {
  return (
    <div className="fo-page-skeleton" role="status" aria-label="Loading reports">
      <HeadSkeleton />
      {REPORT_SECTIONS.map((section, index) => (
        <div key={section} className="fo-skel-section" aria-hidden="true">
          <div className="fo-skel-section-head">
            {index === 0 ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            <span>{section}</span>
          </div>
          {index === 0 && (
            <div className="fo-skel-widgets">
              {[0, 1].map((widget) => (
                <div key={widget} className="fo-skel-widget">
                  <span className="skeleton-row fo-skel-widget-title" />
                  <span className="skeleton-row fo-skel-line" />
                  <WidgetBodySkeleton kpis={widget === 1 ? 2 : 0} bars={widget === 1 ? 4 : 6} />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function UsersSkeleton() {
  return (
    <div className="fo-page-skeleton" role="status" aria-label="Loading users">
      <HeadSkeleton />
      <div className="fo-skel-pager" aria-hidden="true"><span className="skeleton-row" /></div>
      <TableSkeleton columns={USERS_COLUMNS} label="Loading users" />
    </div>
  );
}

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
  const { pathname } = useLocation();

  useEffect(() => {
    const timer = window.setTimeout(() => setShow(true), ROUTE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!show) return null;
  if (pathname.startsWith('/reports')) return <ReportsSkeleton />;
  if (pathname.startsWith('/users')) return <UsersSkeleton />;
  return <PageSkeleton />;
}
