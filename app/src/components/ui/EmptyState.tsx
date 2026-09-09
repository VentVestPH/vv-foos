import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  hint?: string;
  compact?: boolean;
  children?: ReactNode;
}

export function EmptyState({ icon, title, hint, compact = false, children }: EmptyStateProps) {
  return (
    <div className="fo-empty-state" data-compact={compact ? 'true' : undefined}>
      <span className="fo-empty-state-icon" aria-hidden="true">
        {icon}
      </span>
      <p className="fo-empty-state-title">{title}</p>
      {hint && <p className="fo-empty-state-hint">{hint}</p>}
      {children}
    </div>
  );
}
