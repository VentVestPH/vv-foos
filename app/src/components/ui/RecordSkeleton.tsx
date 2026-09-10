import { Skeleton } from './Skeleton';

interface RecordSkeletonProps {
  label: string;
  sections: number;
  panel?: boolean;
}

export function RecordSkeleton({ label, sections, panel = false }: RecordSkeletonProps) {
  const list = (
    <div className="fo-skeleton-sections" role="status" aria-label={label}>
      {Array.from({ length: Math.max(1, sections) }, (_, index) => (
        <div key={index} className="fo-skeleton-section" aria-hidden="true">
          <span className="fo-skeleton-section-head">
            <span className="skeleton-row" />
          </span>
          <span className="fo-skeleton-section-body">
            <span className="skeleton-row" />
            <span className="skeleton-row" />
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="record-page">
      <div className="fo-page-head">
        <span className="fo-head-skeleton" aria-hidden="true">
          <Skeleton rows={2} />
        </span>
      </div>
      {panel ? <div className="fo-skeleton-panel">{list}</div> : list}
    </div>
  );
}
