interface SkeletonProps {
  rows?: number;
  columns?: number;
  variant?: 'rows' | 'lines' | 'grid' | 'card';
  label?: string;
}

export function Skeleton({
  rows = 4,
  columns = 3,
  variant = 'rows',
  label = 'Loading',
}: SkeletonProps) {
  const count = Math.max(1, rows);

  if (variant === 'grid') {
    return (
      <div className="skeleton" role="status" aria-label={label} data-variant="grid">
        {Array.from({ length: count * Math.max(1, columns) }, (_, i) => (
          <span key={i} className="skeleton-cell" />
        ))}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className="skeleton" role="status" aria-label={label} data-variant="card">
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className="skeleton-card" />
        ))}
      </div>
    );
  }

  return (
    <div className="skeleton" role="status" aria-label={label} data-variant={variant}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="skeleton-row" data-short={variant === 'lines' && i % 3 === 2} />
      ))}
    </div>
  );
}
