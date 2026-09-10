interface SkeletonProps {
  rows?: number;
  variant?: 'rows' | 'card';
  label?: string;
}

export function Skeleton({ rows = 4, variant = 'rows', label = 'Loading' }: SkeletonProps) {
  const count = Math.max(1, rows);

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
        <span key={i} className="skeleton-row" />
      ))}
    </div>
  );
}
