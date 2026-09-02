import type { ReactNode } from 'react';

export function Drawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="intake-drawer-overlay" onClick={onClose}>
      <div
        className="intake-drawer fo-record-overlay"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="intake-drawer-head">
          <h2>{title}</h2>
          <button type="button" className="intake-drawer-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="intake-drawer-body">{children}</div>
      </div>
    </div>
  );
}
