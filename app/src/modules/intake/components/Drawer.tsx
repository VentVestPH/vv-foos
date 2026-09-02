import type { ReactNode } from 'react';
import { useOverlayDismiss } from '../../../hooks/useOverlayDismiss';

export function Drawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { closing, requestClose } = useOverlayDismiss(onClose);

  return (
    <div
      className="intake-drawer-overlay"
      data-closing={closing ? 'true' : undefined}
      onClick={requestClose}
    >
      <div
        className="intake-drawer fo-record-overlay"
        data-closing={closing ? 'true' : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="intake-drawer-head">
          <h2>{title}</h2>
          <button type="button" className="intake-drawer-x" onClick={requestClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="intake-drawer-body">{children}</div>
      </div>
    </div>
  );
}
