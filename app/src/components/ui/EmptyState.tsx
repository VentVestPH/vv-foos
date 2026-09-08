import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  hint?: string;
  children?: ReactNode;
}

export function EmptyState({ icon, title, hint, children }: EmptyStateProps) {
  return (
    <div className="fo-empty-state">
      <span className="fo-empty-state-icon" aria-hidden="true">
        {icon}
      </span>
      <p className="fo-empty-state-title">{title}</p>
      {hint && <p className="fo-empty-state-hint">{hint}</p>}
      {children}
    </div>
  );
}
