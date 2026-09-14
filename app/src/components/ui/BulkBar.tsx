import type { ReactNode } from 'react';

interface BulkBarProps {
  count: number;
  children: ReactNode;
}

export function BulkBar({ count, children }: BulkBarProps) {
  return (
    <div className="record-action-bar fo-list-action-bar">
      {children}
      <span className="text-secondary fo-bulk-hint">
        {count > 0 ? `${count} selected.` : ''}
      </span>
    </div>
  );
}
